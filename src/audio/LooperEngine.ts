import * as Tone from 'tone';
import { SynthEngine } from './SynthEngine';
import { DrumMachine } from './DrumMachine';
import { PRESETS, PresetConfig, deepClonePreset } from './presets';
import { KeyNoteInfo } from './scales';
import { SamplerEngine } from './SamplerEngine';

export type TrackState = 'EMPTY' | 'RECORDING' | 'OVERDUBBING' | 'PLAYING';
export type QuantizeMode = '16n' | '8n' | '4n' | 'free';

export interface LoopNoteEvent {
  id: string;
  step: number;             // Active integer step (0 to totalSteps - 1) used by playback scheduler
  microOffsetSteps: number; // Sub-step offset (0.0 to 0.999) when quantizeMode === 'free'; 0 when grid-snapped
  rawStep: number;          // Exact unquantized floating-point step (0.0 to totalSteps) for non-destructive switching
  code: string;             // Physical key code (e.g. "KeyA") for real-time scale re-harmonization
  isChord: boolean;         // Whether Triad Chord mode was active when recorded
  notes: string[];          // Current scale-locked note pitch array, e.g. ["C4", "E4", "G4"]
  durationSteps: number;    // In 16th note increments
  preset?: PresetConfig;    // Exact preset active when this note was recorded
  recordedAtAudioTime?: number; // Prevents double-triggering if an early note quantizes forward to the very next step
}

export interface LooperTrack {
  id: number;
  name: string;
  color: string;
  state: TrackState;
  isMuted: boolean;
  volumeDb: number;
  preset: PresetConfig;
  quantizeMode: QuantizeMode;
  customSampleLabel?: string;
  events: LoopNoteEvent[];
  recordStepCounter: number;
}

export function computeQuantizedTiming(
  rawStepInput: number,
  mode: QuantizeMode,
  totalSteps: number
): { step: number; microOffsetSteps: number; normalizedRawStep: number } {
  const normalizedRawStep = ((rawStepInput % totalSteps) + totalSteps) % totalSteps;

  if (mode === 'free') {
    const step = Math.floor(normalizedRawStep) % totalSteps;
    const microOffsetSteps = Math.max(0, Math.min(0.98, normalizedRawStep - Math.floor(normalizedRawStep)));
    return { step, microOffsetSteps, normalizedRawStep };
  }

  const gridUnit = mode === '4n' ? 4 : mode === '8n' ? 2 : 1;
  const snappedStep = (Math.round(normalizedRawStep / gridUnit) * gridUnit) % totalSteps;
  return {
    step: snappedStep,
    microOffsetSteps: 0,
    normalizedRawStep,
  };
}

export class LooperEngine {
  private static instance: LooperEngine | null = null;
  public isReady: boolean = false;

  public tracks: LooperTrack[] = [];
  public selectedTrackIndex: number = 0;
  public bars: 2 | 4 | 8 = 4;
  public totalSteps: number = 64; // bars * 16
  public currentStep: number = 0;
  public bpm: number = 100;
  public isPlaying: boolean = false;

  private lastTickStep: number = 0;
  private lastTickAudioTime: number = 0;

  private repeatEventId: number | null = null;
  private pendingNotes: Map<
    string,
    { trackIdx: number; eventId: string; step: number; code: string; isChord: boolean; notes: string[]; startAudioTime: number }
  > = new Map();

  // Listeners
  public onStepChange?: (step: number, totalSteps: number) => void;
  public onTracksUpdate?: (tracks: LooperTrack[]) => void;

  private constructor() {
    const trackColors = ['#f59e0b', '#06b6d4', '#a855f7', '#10b981'];
    for (let i = 0; i < 4; i++) {
      this.tracks.push({
        id: i,
        name: `Track ${i + 1}`,
        color: trackColors[i],
        state: 'EMPTY',
        isMuted: false,
        volumeDb: -3,
        preset: PRESETS[0],
        quantizeMode: '16n',
        events: [],
        recordStepCounter: 0,
      });
    }
  }

  public static getInstance(): LooperEngine {
    if (!LooperEngine.instance) {
      LooperEngine.instance = new LooperEngine();
    }
    return LooperEngine.instance;
  }

  public init() {
    if (this.isReady) return;

    Tone.Transport.bpm.value = this.bpm;
    this.totalSteps = this.bars * 16;

    // Schedule 16th note repeat
    this.repeatEventId = Tone.Transport.scheduleRepeat((time) => {
      this.handleStepTick(time);
    }, '16n');

    this.isReady = true;
  }

  public start() {
    if (!this.isPlaying) {
      Tone.Transport.start();
      this.isPlaying = true;
    }
  }

  public stop() {
    if (this.isPlaying) {
      Tone.Transport.stop();
      this.isPlaying = false;
      this.currentStep = 0;
      if (this.onStepChange) {
        this.onStepChange(0, this.totalSteps);
      }
    }
  }

  public setBpm(newBpm: number) {
    this.bpm = Math.max(60, Math.min(180, newBpm));
    Tone.Transport.bpm.rampTo(this.bpm, 0.05);
  }

  public setBars(bars: 2 | 4 | 8) {
    this.bars = bars;
    this.totalSteps = bars * 16;
    this.tracks.forEach((tr) => {
      tr.events = tr.events.filter((ev) => ev.step < this.totalSteps && ev.rawStep < this.totalSteps);
    });
    this.notifyTracksUpdate();
  }

  /**
   * Automatically re-pitches all recorded synth and sampler loop events across Tracks 1-4
   * whenever the user switches the Root Key or Musical Scale in the TopBar.
   */
  public reharmonizeTracks(keyboardMap: Map<string, KeyNoteInfo>) {
    let changed = false;
    this.tracks.forEach((track) => {
      if (track.events.length === 0) return;
      track.events.forEach((ev) => {
        const keyInfo = keyboardMap.get(ev.code);
        if (keyInfo) {
          ev.notes = ev.isChord ? [...keyInfo.chordNotes] : [keyInfo.note];
          changed = true;
        }
      });
    });

    if (changed) {
      this.notifyTracksUpdate();
    }
  }

  private stepRafPending: boolean = false;
  private latestDispatchedStep: number = 0;

  private handleStepTick(time: number) {
    const step = this.currentStep;
    this.lastTickStep = step;
    this.lastTickAudioTime = time;

    const synthEngine = SynthEngine.getInstance();
    const drumMachine = DrumMachine.getInstance();

    // 1. Trigger procedural / custom drum beat
    drumMachine.triggerStep(step % 16, time);

    // 2. Play events on each track (zero-allocation loop)
    const stepBaseSec = 60 / (this.bpm * 4);
    for (let trackIdx = 0; trackIdx < this.tracks.length; trackIdx++) {
      const track = this.tracks[trackIdx];

      // If track is recording for 1 full cycle, seamlessly transition to OVERDUBBING
      if (track.state === 'RECORDING') {
        track.recordStepCounter++;
        if (track.recordStepCounter >= this.totalSteps) {
          track.state = 'OVERDUBBING';
          track.recordStepCounter = 0;
          this.notifyTracksUpdate();
        }
      }

      if (track.isMuted) continue;

      if (track.state === 'PLAYING' || track.state === 'OVERDUBBING' || track.state === 'RECORDING') {
        const events = track.events;
        for (let j = 0; j < events.length; j++) {
          const ev = events[j];
          if (ev.step !== step) continue;
          // If the player is currently actively holding down this key, or just recorded this note within this step window, do not double-trigger
          if (this.pendingNotes.has(ev.code)) continue;
          if (ev.recordedAtAudioTime && Math.abs(time - ev.recordedAtAudioTime) < stepBaseSec * 0.9) {
            continue;
          }
          const stepDurationSeconds = stepBaseSec * ev.durationSteps * 0.95;
          const microOffsetSec = track.quantizeMode === 'free' ? (ev.microOffsetSteps || 0) * stepBaseSec : 0;
          synthEngine.triggerTrackEvent(
            trackIdx,
            ev.notes,
            stepDurationSeconds,
            time + microOffsetSec,
            ev.preset || track.preset,
            ev.code
          );
        }
      }
    }

    // Notify UI of step change asynchronously via coalesced rAF to decouple audio scheduling from React rendering
    this.latestDispatchedStep = step;
    if (this.onStepChange && !this.stepRafPending) {
      this.stepRafPending = true;
      requestAnimationFrame(() => {
        this.stepRafPending = false;
        if (this.onStepChange) {
          this.onStepChange(this.latestDispatchedStep, this.totalSteps);
        }
      });
    }

    // Advance step
    this.currentStep = (this.currentStep + 1) % this.totalSteps;
  }

  /**
   * Called when a user hits a key on the PC keyboard.
   * If the selected track is RECORDING or OVERDUBBING, record the note with both exact rawStep and quantized step!
   */
  public handleNoteOn(code: string, rawNotes: string[], isChord: boolean = false) {
    // 1. Prioritize the currently selected track if it is RECORDING or OVERDUBBING
    let trackIdx = this.selectedTrackIndex;
    let track = this.tracks[trackIdx];

    if (!track || (track.state !== 'RECORDING' && track.state !== 'OVERDUBBING')) {
      // 2. Fall back to any track actively RECORDING first, then OVERDUBBING
      trackIdx = this.tracks.findIndex((t) => t.state === 'RECORDING');
      if (trackIdx === -1) {
        trackIdx = this.tracks.findIndex((t) => t.state === 'OVERDUBBING');
      }
    }
    track = this.tracks[trackIdx];
    if (!track) return;

    if (track.state === 'RECORDING' || track.state === 'OVERDUBBING') {
      const synthEngine = SynthEngine.getInstance();
      const activePreset = synthEngine.currentPreset;

      // Always keep the track's preset & synth synced to the live sound being recorded!
      const clonedPreset = deepClonePreset(activePreset);
      if (track.preset.id !== clonedPreset.id || track.events.length === 0) {
        track.preset = clonedPreset;
        if (clonedPreset.isSamplerVoice) {
          const sample = SamplerEngine.getInstance().currentSample;
          track.customSampleLabel = sample
            ? `${sample.name} (${sample.analysis.detectedNote})`
            : 'Auto-Pitch Sample';
        } else {
          track.customSampleLabel = undefined;
        }
        synthEngine.lockPresetToTrack(trackIdx, clonedPreset);
      }

      const nowAudioTime = Tone.now();
      const stepBaseSec = 60 / (this.bpm * 4);
      let rawStep: number;
      if (this.lastTickAudioTime > 0 && this.isPlaying) {
        const elapsedSteps = Math.max(
          -0.49,
          Math.min(1.49, (nowAudioTime - this.lastTickAudioTime) / stepBaseSec)
        );
        rawStep = ((this.lastTickStep + elapsedSteps) % this.totalSteps + this.totalSteps) % this.totalSteps;
      } else {
        const ticksPerSixteenth = Tone.Transport.PPQ / 4;
        const currentTicks = Tone.Transport.ticks;
        rawStep = ((currentTicks / ticksPerSixteenth) % this.totalSteps + this.totalSteps) % this.totalSteps;
      }

      const { step: quantizedStep, microOffsetSteps, normalizedRawStep } = computeQuantizedTiming(
        rawStep,
        track.quantizeMode,
        this.totalSteps
      );

      // Commit note event immediately with duration 1 so notes are NEVER dropped on quick taps!
      const eventId = `${quantizedStep}-${code}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const event: LoopNoteEvent = {
        id: eventId,
        step: quantizedStep,
        microOffsetSteps,
        rawStep: normalizedRawStep,
        code,
        isChord,
        notes: [...rawNotes],
        durationSteps: 1,
        preset: clonedPreset,
        recordedAtAudioTime: nowAudioTime,
      };

      // Avoid duplicate overlapping hits on the same step (or within 0.25 step in free mode)
      const existingIdx = track.events.findIndex((e) => {
        if (e.code !== code) return false;
        if (track.quantizeMode === 'free') {
          return Math.abs(e.rawStep - normalizedRawStep) < 0.25;
        }
        return e.step === quantizedStep;
      });
      if (existingIdx !== -1) {
        track.events[existingIdx] = event;
      } else {
        track.events.push(event);
      }
      this.notifyTracksUpdate();

      this.pendingNotes.set(code, {
        trackIdx,
        eventId,
        step: quantizedStep,
        code,
        isChord,
        notes: [...rawNotes],
        startAudioTime: nowAudioTime,
      });
    }
  }

  /**
   * Called when key is released. Finalizes the duration and commits to loop track.
   */
  public handleNoteOff(code: string) {
    const pending = this.pendingNotes.get(code);
    if (!pending) return;

    const stepBaseSec = 60 / (this.bpm * 4);
    const heldSeconds = Math.max(stepBaseSec, Tone.now() - pending.startAudioTime);
    const durationSteps = Math.max(1, Math.min(16, Math.round(heldSeconds / stepBaseSec)));

    const track = this.tracks[pending.trackIdx];
    if (track && durationSteps > 1) {
      // Find the committed event and expand its duration
      const ev = track.events.find((e) => e.id === pending.eventId);
      if (ev) {
        ev.durationSteps = durationSteps;
        this.notifyTracksUpdate();
      }
    }

    this.pendingNotes.delete(code);
  }

  /**
   * Changes the timing quantization mode of a track ('16n' | '8n' | '4n' | 'free').
   * Non-destructively updates all already-recorded notes on that track from their original rawStep!
   */
  public setTrackQuantizeMode(trackIndex: number, mode: QuantizeMode) {
    const track = this.tracks[trackIndex];
    if (!track) return;

    track.quantizeMode = mode;
    for (let i = 0; i < track.events.length; i++) {
      const ev = track.events[i];
      const { step, microOffsetSteps } = computeQuantizedTiming(ev.rawStep, mode, this.totalSteps);
      ev.step = step;
      ev.microOffsetSteps = microOffsetSteps;
    }
    this.notifyTracksUpdate();
  }

  /**
   * Permanently snaps and commits all recorded events on a track to the nearest grid step.
   */
  public snapTrackEventsToGrid(trackIndex: number, gridMode: '16n' | '8n' | '4n' = '16n') {
    const track = this.tracks[trackIndex];
    if (!track || track.events.length === 0) return;

    track.quantizeMode = gridMode;
    for (let i = 0; i < track.events.length; i++) {
      const ev = track.events[i];
      const { step } = computeQuantizedTiming(ev.rawStep, gridMode, this.totalSteps);
      ev.step = step;
      ev.rawStep = step;
      ev.microOffsetSteps = 0;
    }
    this.notifyTracksUpdate();
  }

  /**
   * Shifts (nudges) all recorded notes on a track earlier or later in time after recording.
   */
  public nudgeTrackTiming(trackIndex: number, deltaSteps: number) {
    const track = this.tracks[trackIndex];
    if (!track || track.events.length === 0) return;

    for (let i = 0; i < track.events.length; i++) {
      const ev = track.events[i];
      const nextRaw = ((ev.rawStep + deltaSteps) % this.totalSteps + this.totalSteps) % this.totalSteps;
      const { step, microOffsetSteps, normalizedRawStep } = computeQuantizedTiming(
        nextRaw,
        track.quantizeMode,
        this.totalSteps
      );
      ev.rawStep = normalizedRawStep;
      ev.step = step;
      ev.microOffsetSteps = microOffsetSteps;
    }
    this.notifyTracksUpdate();
  }

  /**
   * Moves an individual recorded note to a new timing position on the track timeline after recording.
   */
  public moveNoteEvent(trackIndex: number, eventId: string, targetRawStep: number) {
    const track = this.tracks[trackIndex];
    if (!track) return;

    const ev = track.events.find((e) => e.id === eventId);
    if (!ev) return;

    const { step, microOffsetSteps, normalizedRawStep } = computeQuantizedTiming(
      targetRawStep,
      track.quantizeMode,
      this.totalSteps
    );

    ev.step = step;
    ev.microOffsetSteps = microOffsetSteps;
    ev.rawStep = track.quantizeMode === 'free' ? normalizedRawStep : step;
    this.notifyTracksUpdate();
  }

  /**
   * Deletes a single recorded note event from a track without clearing the entire track.
   */
  public deleteNoteEvent(trackIndex: number, eventId: string) {
    const track = this.tracks[trackIndex];
    if (!track) return;

    const beforeLen = track.events.length;
    track.events = track.events.filter((e) => e.id !== eventId);
    if (track.events.length !== beforeLen) {
      if (track.events.length === 0 && track.state === 'PLAYING') {
        track.state = 'EMPTY';
      }
      this.notifyTracksUpdate();
    }
  }

  /**
   * Track Actions
   */
  public selectTrack(index: number) {
    if (index >= 0 && index < this.tracks.length) {
      this.selectedTrackIndex = index;
    }
  }

  /**
   * Synchronizes the newly selected live preset onto any EMPTY or actively RECORDING/OVERDUBBING track
   * so the track badge and playback voice always match the user's selected sound.
   */
  public syncLivePreset(preset: PresetConfig) {
    const synthEngine = SynthEngine.getInstance();
    let updated = false;
    const cloned = deepClonePreset(preset);

    for (let i = 0; i < this.tracks.length; i++) {
      const track = this.tracks[i];
      if (
        track.state === 'EMPTY' ||
        track.state === 'RECORDING' ||
        (track.state === 'OVERDUBBING' && track.events.length === 0)
      ) {
        track.preset = deepClonePreset(cloned);
        if (cloned.isSamplerVoice) {
          const sample = SamplerEngine.getInstance().currentSample;
          track.customSampleLabel = sample
            ? `${sample.name} (${sample.analysis.detectedNote})`
            : 'Auto-Pitch Sample';
        } else {
          track.customSampleLabel = undefined;
        }
        synthEngine.lockPresetToTrack(i, track.preset);
        updated = true;
      }
    }

    if (updated) {
      this.notifyTracksUpdate();
    }
  }

  /**
   * Hot-swaps the instrument preset of a specific Looper track (even while a recorded loop is playing!).
   */
  public setTrackPreset(trackIndex: number, preset: PresetConfig) {
    const track = this.tracks[trackIndex];
    if (!track) return;

    const cloned = deepClonePreset(preset);
    track.preset = cloned;
    if (cloned.isSamplerVoice) {
      const sample = SamplerEngine.getInstance().currentSample;
      track.customSampleLabel = sample
        ? `${sample.name} (${sample.analysis.detectedNote})`
        : 'Multi-Voice Sampler';
    } else {
      track.customSampleLabel = undefined;
    }

    for (let i = 0; i < track.events.length; i++) {
      track.events[i].preset = cloned;
    }

    SynthEngine.getInstance().lockPresetToTrack(trackIndex, cloned);
    this.notifyTracksUpdate();
  }

  public toggleRecordTrack(trackIndex: number) {
    const track = this.tracks[trackIndex];
    if (!track) return;

    const synthEngine = SynthEngine.getInstance();

    if (track.state === 'EMPTY') {
      // Disarm any other recording or overdubbing tracks
      this.tracks.forEach((t, i) => {
        if (i !== trackIndex && (t.state === 'RECORDING' || t.state === 'OVERDUBBING')) {
          t.state = 'PLAYING';
        }
      });

      track.state = 'RECORDING';
      track.recordStepCounter = 0;
      track.preset = synthEngine.currentPreset;
      if (track.preset.isSamplerVoice) {
        const sample = SamplerEngine.getInstance().currentSample;
        track.customSampleLabel = sample
          ? `${sample.name} (${sample.analysis.detectedNote})`
          : 'Auto-Pitch Sample';
      } else {
        track.customSampleLabel = undefined;
      }
      synthEngine.lockPresetToTrack(trackIndex, track.preset);
      this.start();
    } else if (track.state === 'RECORDING') {
      track.state = 'PLAYING';
    } else if (track.state === 'PLAYING') {
      // Disarm other tracks when switching to OVERDUBBING
      this.tracks.forEach((t, i) => {
        if (i !== trackIndex && (t.state === 'RECORDING' || t.state === 'OVERDUBBING')) {
          t.state = 'PLAYING';
        }
      });
      track.state = 'OVERDUBBING';
    } else if (track.state === 'OVERDUBBING') {
      track.state = 'PLAYING';
    }

    this.selectedTrackIndex = trackIndex;
    this.notifyTracksUpdate();
  }

  public toggleMuteTrack(trackIndex: number) {
    const track = this.tracks[trackIndex];
    if (!track) return;

    track.isMuted = !track.isMuted;
    SynthEngine.getInstance().setTrackVolume(trackIndex, track.volumeDb, track.isMuted);
    this.notifyTracksUpdate();
  }

  public clearTrack(trackIndex: number) {
    const track = this.tracks[trackIndex];
    if (!track) return;

    track.events = [];
    track.state = 'EMPTY';
    track.preset = SynthEngine.getInstance().currentPreset;
    track.customSampleLabel = undefined;
    track.recordStepCounter = 0;

    // Purge any pending note registrations for this track
    for (const [code, p] of this.pendingNotes.entries()) {
      if (p.trackIdx === trackIndex) {
        this.pendingNotes.delete(code);
      }
    }

    this.notifyTracksUpdate();
  }

  public setTrackVolume(trackIndex: number, volDb: number) {
    const track = this.tracks[trackIndex];
    if (!track) return;

    track.volumeDb = Math.max(-36, Math.min(4, volDb));
    SynthEngine.getInstance().setTrackVolume(trackIndex, track.volumeDb, track.isMuted);
    this.notifyTracksUpdate();
  }

  private notifyTracksUpdatePending: boolean = false;
  private notifyTracksUpdate() {
    if (this.notifyTracksUpdatePending) return;
    this.notifyTracksUpdatePending = true;
    requestAnimationFrame(() => {
      this.notifyTracksUpdatePending = false;
      if (this.onTracksUpdate) {
        this.onTracksUpdate(this.tracks.map((t) => ({ ...t, events: [...t.events] })));
      }
    });
  }
}
