import * as Tone from 'tone';
import { SynthEngine } from './SynthEngine';
import { DrumMachine } from './DrumMachine';
import { PRESETS, PresetConfig } from './presets';
import { KeyNoteInfo } from './scales';
import { SamplerEngine } from './SamplerEngine';

export type TrackState = 'EMPTY' | 'RECORDING' | 'OVERDUBBING' | 'PLAYING';

export interface LoopNoteEvent {
  id: string;
  step: number;          // 0 to totalSteps - 1
  code: string;          // Physical key code (e.g. "KeyA") for real-time scale re-harmonization
  isChord: boolean;      // Whether Triad Chord mode was active when recorded
  notes: string[];       // Current scale-locked note pitch array, e.g. ["C4", "E4", "G4"]
  durationSteps: number; // In 16th note increments
}

export interface LooperTrack {
  id: number;
  name: string;
  color: string;
  state: TrackState;
  isMuted: boolean;
  volumeDb: number;
  preset: PresetConfig;
  customSampleLabel?: string;
  events: LoopNoteEvent[];
  recordStepCounter: number;
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

  private repeatEventId: number | null = null;
  private pendingNotes: Map<
    string,
    { trackIdx: number; eventId: string; step: number; code: string; isChord: boolean; notes: string[]; startTick: number }
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
        preset: PRESETS[i % 5],
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
      tr.events = tr.events.filter((ev) => ev.step < this.totalSteps);
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

  private handleStepTick(time: number) {
    const step = this.currentStep;
    const synthEngine = SynthEngine.getInstance();
    const drumMachine = DrumMachine.getInstance();

    // 1. Trigger procedural / custom drum beat
    drumMachine.triggerStep(step % 16, time);

    // 2. Play events on each track
    this.tracks.forEach((track, trackIdx) => {
      // If track is recording for 1 full cycle, seamlessly transition to OVERDUBBING
      // so the loop keeps playing and the player can continue capturing additional notes & phrases!
      if (track.state === 'RECORDING') {
        track.recordStepCounter++;
        if (track.recordStepCounter >= this.totalSteps) {
          track.state = 'OVERDUBBING';
          track.recordStepCounter = 0;
          this.notifyTracksUpdate();
        }
      }

      if (track.isMuted) return;

      if (track.state === 'PLAYING' || track.state === 'OVERDUBBING' || track.state === 'RECORDING') {
        const eventsAtStep = track.events.filter((e) => e.step === step);
        if (eventsAtStep.length > 0) {
          eventsAtStep.forEach((ev) => {
            // If the player is currently actively holding down this key, do not double-trigger it from playback
            if (this.pendingNotes.has(ev.code)) return;
            const stepDurationSeconds = (60 / (this.bpm * 4)) * ev.durationSteps * 0.95;
            synthEngine.triggerTrackEvent(
              trackIdx,
              ev.notes,
              stepDurationSeconds,
              time,
              track.preset,
              ev.code
            );
          });
        }
      }
    });

    // Notify UI of step change asynchronously via rAF to decouple audio scheduling from React rendering
    if (this.onStepChange) {
      const cb = this.onStepChange;
      const curStep = step;
      const totSteps = this.totalSteps;
      requestAnimationFrame(() => {
        cb(curStep, totSteps);
      });
    }

    // Advance step
    this.currentStep = (this.currentStep + 1) % this.totalSteps;
  }

  /**
   * Called when a user hits a key on the PC keyboard.
   * If the selected track is RECORDING or OVERDUBBING, record the note!
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
      const ticksPerSixteenth = Tone.Transport.PPQ / 4;
      const currentTicks = Tone.Transport.ticks;
      let quantizedStep = Math.round(currentTicks / ticksPerSixteenth) % this.totalSteps;
      if (quantizedStep < 0) quantizedStep += this.totalSteps;

      // Commit note event immediately with duration 1 so notes are NEVER dropped on quick taps!
      const eventId = `${quantizedStep}-${code}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const event: LoopNoteEvent = {
        id: eventId,
        step: quantizedStep,
        code,
        isChord,
        notes: [...rawNotes],
        durationSteps: 1,
      };

      // Avoid duplicate overlapping hits on the same step
      const existingIdx = track.events.findIndex((e) => e.step === quantizedStep && e.code === code);
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
        startTick: currentTicks,
      });
    }
  }

  /**
   * Called when key is released. Finalizes the duration and commits to loop track.
   */
  public handleNoteOff(code: string) {
    const pending = this.pendingNotes.get(code);
    if (!pending) return;

    const ticksPerSixteenth = Tone.Transport.PPQ / 4;
    const durationTicks = Math.max(ticksPerSixteenth, Tone.Transport.ticks - pending.startTick);
    const durationSteps = Math.max(1, Math.min(16, Math.round(durationTicks / ticksPerSixteenth)));

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
   * Track Actions
   */
  public selectTrack(index: number) {
    if (index >= 0 && index < this.tracks.length) {
      this.selectedTrackIndex = index;
    }
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
        this.onTracksUpdate([...this.tracks]);
      }
    });
  }
}
