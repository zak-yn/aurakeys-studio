import * as Tone from 'tone';
import { PRESETS, PresetConfig } from './presets';
import { CustomSampleData, RegisteredVoice, SamplerEngine } from './SamplerEngine';

export interface MacroControls {
  warmth: number; // 0 - 100
  space: number;  // 0 - 100
  snap: number;   // 0 - 100
  echo: number;   // 0 - 100
}

export class SynthEngine {
  private static instance: SynthEngine | null = null;
  public isReady: boolean = false;

  // PolySynths
  public liveSynth!: Tone.PolySynth;
  public trackSynths: Tone.PolySynth[] = [];
  public trackVolumes: Tone.Volume[] = [];
  public currentPreset: PresetConfig = PRESETS[0];

  // Auto-Pitch Multi-Voice Samplers (Live Pool + 4 Tracks)
  public liveSampler: Tone.Sampler | null = null;
  public liveSamplers: Map<string, Tone.Sampler> = new Map();
  public liveSamplerFineCentsMap: Map<string, number> = new Map();
  public liveSamplerOctaveShiftMap: Map<string, number> = new Map();

  public trackSamplers: (Tone.Sampler | null)[] = [null, null, null, null];
  private trackUsesSampler: boolean[] = [false, false, false, false];
  private trackSamplerFineCents: number[] = [0, 0, 0, 0];
  private trackSamplerOctaveShift: number[] = [0, 0, 0, 0];

  private liveSamplerFineCents: number = 0;
  private liveSamplerOctaveShift: number = 0;

  // Master Effects Bus
  public masterFilter!: Tone.Filter;
  public chorus!: Tone.Chorus;
  public delay!: Tone.FeedbackDelay;
  public reverb!: Tone.Reverb;
  public masterBus!: Tone.Volume;
  public limiter!: Tone.Limiter;
  public analyser!: Tone.Analyser;
  public recorder!: Tone.Recorder;

  // Active Key Note Tracking: code -> { notes, usedSampler, samplerVoiceId }
  private activeCodeNotes: Map<
    string,
    { notes: any[]; usedSampler: boolean; samplerVoiceId?: string }
  > = new Map();

  // Macros (0 - 100)
  public macros: MacroControls = {
    warmth: 65,
    space: 35,
    snap: 40,
    echo: 20,
  };

  private constructor() {}

  public static getInstance(): SynthEngine {
    if (!SynthEngine.instance) {
      SynthEngine.instance = new SynthEngine();
    }
    return SynthEngine.instance;
  }

  /**
   * Initializes Web Audio context and builds the multi-voice graph.
   */
  public async init(): Promise<void> {
    if (this.isReady) return;

    await Tone.start();

    // Set optimized lookahead (45ms) for rock-solid audio stability without crackling/dropouts on older laptop CPUs
    Tone.context.lookAhead = 0.045;

    // 1. Master Chain: Filter -> Chorus -> Delay -> Reverb -> Limiter -> Destination
    this.limiter = new Tone.Limiter(-1).toDestination();
    this.masterBus = new Tone.Volume(0).connect(this.limiter);

    this.reverb = new Tone.Reverb({
      decay: 2.0,
      preDelay: 0.01,
      wet: 0.25,
    });
    await this.reverb.generate();
    this.reverb.connect(this.masterBus);

    this.delay = new Tone.FeedbackDelay({
      delayTime: '8n.',
      feedback: 0.2,
      wet: 0.15,
    }).connect(this.reverb);

    this.chorus = new Tone.Chorus({
      frequency: 1.5,
      delayTime: 3.5,
      depth: 0.4,
      wet: 0.2,
    }).connect(this.delay);
    this.chorus.start();

    this.masterFilter = new Tone.Filter({
      frequency: 4500,
      type: 'lowpass',
      rolloff: -12,
      Q: 0.9,
    }).connect(this.chorus);

    // 2. Waveform Analyser & Master Recorder connected at Destination
    this.analyser = new Tone.Analyser('waveform', 512);
    Tone.Destination.connect(this.analyser);

    this.recorder = new Tone.Recorder();
    Tone.Destination.connect(this.recorder);

    // 3. Live Synth (Polyphony: 16) with -6 dB clean headroom to prevent chord clipping
    this.liveSynth = new Tone.PolySynth(Tone.Synth);
    this.liveSynth.maxPolyphony = 16;
    this.liveSynth.volume.value = -6;
    this.applyPresetToSynth(this.liveSynth, this.currentPreset);
    this.liveSynth.connect(this.masterFilter);

    // 4. 4 Track Synths with dedicated volume controls
    for (let i = 0; i < 4; i++) {
      const vol = new Tone.Volume(-6).connect(this.masterFilter);
      const synth = new Tone.PolySynth(Tone.Synth);
      synth.maxPolyphony = 12;
      synth.volume.value = -6;
      this.applyPresetToSynth(synth, PRESETS[i % 5]);
      synth.connect(vol);

      this.trackVolumes.push(vol);
      this.trackSynths.push(synth);
    }

    this.isReady = true;

    // 5. Initialize default Auto-Pitch Sampler buffer so Preset [0] works out of the box
    SamplerEngine.getInstance().initDefaultSample();

    // Apply initial macro values
    this.applyMacros();
  }

  /**
   * Synchronizes the multi-voice Tone.Sampler pool with the active voice library.
   * Creates or cleans up dedicated samplers per registered voice.
   */
  public syncVoices(voices: RegisteredVoice[]) {
    if (!this.isReady) return;

    const currentVoiceIds = new Set(voices.map((v) => v.id));

    // 1. Dispose removed samplers
    for (const [id, sampler] of this.liveSamplers.entries()) {
      if (!currentVoiceIds.has(id)) {
        try {
          sampler.dispose();
        } catch {}
        this.liveSamplers.delete(id);
        this.liveSamplerFineCentsMap.delete(id);
        this.liveSamplerOctaveShiftMap.delete(id);
      }
    }

    // 2. Build or update samplers for each voice
    for (const voice of voices) {
      const anchorNote =
        voice.rootNoteOverride ||
        (voice.autoPitchEnabled ? voice.analysis.detectedNote : 'C4');
      const fineCents = voice.autoPitchEnabled ? voice.analysis.centsCorrection : 0;
      this.liveSamplerFineCentsMap.set(voice.id, fineCents);
      this.liveSamplerOctaveShiftMap.set(voice.id, voice.octaveShift);

      // Recreate sampler with updated buffer
      const existing = this.liveSamplers.get(voice.id);
      if (existing) {
        try {
          existing.dispose();
        } catch {}
      }

      const toneBuffer = new Tone.ToneAudioBuffer(voice.analysis.trimmedBuffer);
      const sampler = new Tone.Sampler({
        urls: {
          [anchorNote]: toneBuffer,
        },
        attack: 0.005,
        release: 0.4,
      }).connect(this.masterFilter);

      this.liveSamplers.set(voice.id, sampler);
    }

    // Keep primary liveSampler pointing to first voice for backwards compatibility
    if (voices[0]) {
      this.liveSampler = this.liveSamplers.get(voices[0].id) || null;
      this.liveSamplerFineCents = this.liveSamplerFineCentsMap.get(voices[0].id) || 0;
      this.liveSamplerOctaveShift = this.liveSamplerOctaveShiftMap.get(voices[0].id) || 0;
    }
  }

  /**
   * Loads a user-recorded or uploaded sample into the live Tone.Sampler.
   * Anchors the sample at its detected pitch (when autoPitchEnabled is true) or C4 (when raw).
   */
  public loadUserSample(sampleData: CustomSampleData) {
    if (!this.isReady) return;

    const anchorNote = sampleData.autoPitchEnabled
      ? sampleData.analysis.detectedNote
      : 'C4';

    this.liveSamplerFineCents = sampleData.autoPitchEnabled
      ? sampleData.analysis.centsCorrection
      : 0;
    this.liveSamplerOctaveShift = sampleData.octaveShift;

    if (this.liveSampler) {
      try {
        this.liveSampler.dispose();
      } catch {
        // ignore
      }
    }

    const toneBuffer = new Tone.ToneAudioBuffer(sampleData.analysis.trimmedBuffer);
    this.liveSampler = new Tone.Sampler({
      urls: {
        [anchorNote]: toneBuffer,
      },
      attack: 0.005,
      release: 0.4,
    }).connect(this.masterFilter);
  }

  /**
   * Clones the currently loaded user sample onto a specific Looper Track's dedicated Sampler.
   */
  public lockUserSampleToTrack(trackIndex: number) {
    const sampleData = SamplerEngine.getInstance().currentSample;
    if (!sampleData || !this.trackVolumes[trackIndex]) return;

    const anchorNote = sampleData.autoPitchEnabled
      ? sampleData.analysis.detectedNote
      : 'C4';

    this.trackSamplerFineCents[trackIndex] = sampleData.autoPitchEnabled
      ? sampleData.analysis.centsCorrection
      : 0;
    this.trackSamplerOctaveShift[trackIndex] = sampleData.octaveShift;

    if (this.trackSamplers[trackIndex]) {
      try {
        this.trackSamplers[trackIndex]!.dispose();
      } catch {
        // ignore
      }
    }

    const toneBuffer = new Tone.ToneAudioBuffer(sampleData.analysis.trimmedBuffer);
    this.trackSamplers[trackIndex] = new Tone.Sampler({
      urls: {
        [anchorNote]: toneBuffer,
      },
      attack: 0.005,
      release: 0.4,
    }).connect(this.trackVolumes[trackIndex]);
  }

  /**
   * Plays a quick audition of a specific registered voice.
   */
  public previewVoice(voice: RegisteredVoice) {
    if (!this.isReady) return;
    const sampler = this.liveSamplers.get(voice.id) || this.liveSampler;
    if (!sampler) return;
    const anchorNote =
      voice.rootNoteOverride ||
      (voice.autoPitchEnabled ? voice.analysis.detectedNote : 'C4');
    try {
      sampler.triggerAttackRelease(anchorNote, '4n');
    } catch (e) {
      console.warn('Preview voice error:', e);
    }
  }

  /**
   * Plays a quick C4 audition of the currently loaded user sample.
   */
  public previewUserSample() {
    const voice = SamplerEngine.getInstance().currentSample;
    if (voice) {
      this.previewVoice(voice);
    }
  }

  /**
   * Applies preset oscillator & envelope configuration onto a target PolySynth.
   */
  public applyPresetToSynth(synth: Tone.PolySynth, preset: PresetConfig) {
    try {
      synth.set({
        oscillator: preset.synthOptions.oscillator,
        envelope: preset.synthOptions.envelope,
      });
    } catch (e) {
      console.warn('Error applying preset to synth:', e);
    }
  }

  /**
   * Sets the live synth instrument preset.
   */
  public setLivePreset(preset: PresetConfig) {
    if (this.currentPreset.id === preset.id) return;
    this.currentPreset = preset;
    if (this.isReady && this.liveSynth && !preset.isSamplerVoice) {
      try {
        this.liveSynth.releaseAll();
      } catch {
        // ignore
      }
      this.applyPresetToSynth(this.liveSynth, preset);
    }
  }

  /**
   * Clones current live preset configuration (or user sampler) onto a specific looper track.
   */
  public lockPresetToTrack(trackIndex: number, preset: PresetConfig) {
    if (preset.isSamplerVoice) {
      this.trackUsesSampler[trackIndex] = true;
      this.lockUserSampleToTrack(trackIndex);
    } else {
      this.trackUsesSampler[trackIndex] = false;
      if (!this.trackSynths[trackIndex]) return;
      this.applyPresetToSynth(this.trackSynths[trackIndex], preset);
    }
  }

  /**
   * Triggers a quantized event on a looper track (automatically routes to Track Sampler or Track PolySynth).
   */
  public triggerTrackEvent(
    trackIndex: number,
    rawNotes: string[],
    durationSeconds: number,
    time: number,
    preset: PresetConfig,
    code?: string
  ) {
    if (preset.isSamplerVoice || this.trackUsesSampler[trackIndex]) {
      let voice: RegisteredVoice | null = null;
      if (code) {
        voice = SamplerEngine.getInstance().getVoiceForKey(code);
      }
      if (!voice) {
        voice = SamplerEngine.getInstance().currentSample;
      }
      if (!voice) return;

      const sampler =
        this.liveSamplers.get(voice.id) ||
        this.trackSamplers[trackIndex] ||
        this.liveSampler;
      if (!sampler) return;

      const fineCents =
        this.liveSamplerFineCentsMap.get(voice.id) ??
        this.trackSamplerFineCents[trackIndex] ??
        0;
      const octaveShift =
        this.liveSamplerOctaveShiftMap.get(voice.id) ??
        this.trackSamplerOctaveShift[trackIndex] ??
        0;

      // Decision 5: Single voice solo for vocal clips (rawNotes[0])
      const noteToPlay = rawNotes[0] || 'C4';
      const tunedNotes = this.transposeAndFineTuneNotes(
        [noteToPlay],
        octaveShift,
        fineCents
      );
      try {
        sampler.triggerAttackRelease(tunedNotes, durationSeconds, time);
      } catch (err) {
        console.warn('Track sampler trigger error', err);
      }
    } else {
      const synth = this.trackSynths[trackIndex];
      if (!synth) return;
      const transposed = this.transposeNotes(rawNotes, preset.octaveOffset);
      try {
        synth.triggerAttackRelease(transposed, durationSeconds, time);
      } catch (err) {
        console.warn('Track synth trigger error', err);
      }
    }
  }

  /**
   * Adjusts track volume in dB (-36dB to +4dB, or -Infinity if muted).
   */
  public setTrackVolume(trackIndex: number, volumeDb: number, muted: boolean = false) {
    if (!this.trackVolumes[trackIndex]) return;
    if (muted) {
      this.trackVolumes[trackIndex].volume.rampTo(-Infinity, 0.05);
    } else {
      this.trackVolumes[trackIndex].volume.rampTo(volumeDb, 0.05);
    }
  }

  /**
   * Transposes notes based on preset octave offset (e.g. -1 for sub bass).
   */
  public transposeNotes(notes: string[], octaveOffset: number): string[] {
    if (octaveOffset === 0) return notes;
    const semitones = octaveOffset * 12;
    return notes.map((n) => Tone.Frequency(n).transpose(semitones).toNote());
  }

  /**
   * Applies both octave shift and microtonal cents correction (returning exact Hz strings or notes)
   * so Tone.Sampler plays out-of-tune mic recordings in concert pitch.
   */
  public transposeAndFineTuneNotes(
    notes: string[],
    octaveOffset: number,
    fineCents: number
  ): any[] {
    const semitoneShift = octaveOffset * 12 + fineCents / 100;
    if (Math.abs(semitoneShift) < 0.001) return notes;
    return notes.map((n) => {
      const baseHz = Tone.Frequency(n).toFrequency();
      return baseHz * Math.pow(2, semitoneShift / 12);
    });
  }

  /**
   * Live Key Press: Triggers attack with zero latency and tracks notes for release.
   */
  public triggerLiveAttack(code: string, rawNotes: string[]) {
    if (!this.isReady) return;

    if (this.activeCodeNotes.has(code)) {
      this.triggerLiveRelease(code);
    }

    const now = Tone.now();

    if (this.currentPreset.isSamplerVoice) {
      const voice = SamplerEngine.getInstance().getVoiceForKey(code);
      if (!voice) {
        // Unmapped key in Preset 0: Silent! (As decided in Decision 4)
        return;
      }

      const sampler = this.liveSamplers.get(voice.id) || this.liveSampler;
      if (!sampler) return;

      // Decision 5: Single Voice Solo even if Shift/Chord mode is active (rawNotes[0])
      const noteToPlay = rawNotes[0] || 'C4';
      const fineCents =
        this.liveSamplerFineCentsMap.get(voice.id) ??
        (voice.autoPitchEnabled ? voice.analysis.centsCorrection : 0);
      const octaveShift =
        this.liveSamplerOctaveShiftMap.get(voice.id) ?? voice.octaveShift;

      const tunedNotes = this.transposeAndFineTuneNotes(
        [noteToPlay],
        octaveShift,
        fineCents
      );

      // Decision 6: Per-key monophonic choke
      try {
        sampler.triggerRelease(tunedNotes, now);
      } catch {}

      this.activeCodeNotes.set(code, {
        notes: tunedNotes,
        usedSampler: true,
        samplerVoiceId: voice.id,
      });

      try {
        sampler.triggerAttack(tunedNotes, now);
      } catch (err) {
        console.warn('Sampler triggerAttack error', err);
      }
      return;
    }

    if (!this.liveSynth) return;
    const notes = this.transposeNotes(rawNotes, this.currentPreset.octaveOffset);
    this.activeCodeNotes.set(code, { notes, usedSampler: false });
    try {
      this.liveSynth.triggerAttack(notes, now);
    } catch (err) {
      console.warn('Synth triggerAttack error', err);
    }
  }

  /**
   * Live Key Release: Releases the exact frequencies triggered by this physical code.
   */
  public triggerLiveRelease(code: string) {
    if (!this.isReady) return;
    const active = this.activeCodeNotes.get(code);
    if (active && active.notes.length > 0) {
      const now = Tone.now();
      try {
        if (active.usedSampler) {
          const sampler =
            (active.samplerVoiceId && this.liveSamplers.get(active.samplerVoiceId)) ||
            this.liveSampler;
          if (sampler) {
            sampler.triggerRelease(active.notes, now);
          }
        } else if (this.liveSynth) {
          this.liveSynth.triggerRelease(active.notes, now);
        }
      } catch (err) {
        console.warn('triggerRelease error', err);
      }
      this.activeCodeNotes.delete(code);
    }
  }

  /**
   * Safety catch: Releases all currently sounding voices (e.g. on blur or panic).
   */
  public releaseAllLiveNotes() {
    if (!this.isReady) return;
    try {
      if (this.liveSynth) this.liveSynth.releaseAll();
      if (this.liveSampler) this.liveSampler.releaseAll();
      for (const sampler of this.liveSamplers.values()) {
        try {
          sampler.releaseAll();
        } catch {}
      }
    } catch {
      // ignore
    }
    this.activeCodeNotes.clear();
  }

  /**
   * Updates macro controls with smooth ramped transitions.
   */
  public setMacro(key: keyof MacroControls, val: number) {
    this.macros[key] = Math.max(0, Math.min(100, val));
    this.applyMacros();
  }

  public setXYMood(x: number, y: number) {
    this.macros.warmth = Math.max(0, Math.min(100, x));
    this.macros.space = Math.max(0, Math.min(100, y));
    this.applyMacros();
  }

  private applyMacros() {
    if (!this.isReady) return;

    // Warmth: 250 Hz to 9000 Hz exponential
    const warmthNorm = this.macros.warmth / 100;
    const minFreq = 250;
    const maxFreq = 9000;
    const filterFreq = minFreq * Math.pow(maxFreq / minFreq, warmthNorm);
    this.masterFilter.frequency.rampTo(filterFreq, 0.05);

    // Space: Reverb wet 0.05 - 0.85
    const spaceNorm = this.macros.space / 100;
    const reverbWet = 0.05 + spaceNorm * 0.8;
    this.reverb.wet.rampTo(reverbWet, 0.05);

    // Echo: Delay wet 0.0 - 0.55, feedback 0.1 - 0.6
    const echoNorm = this.macros.echo / 100;
    const delayWet = echoNorm * 0.55;
    const delayFb = 0.1 + echoNorm * 0.5;
    this.delay.wet.rampTo(delayWet, 0.05);
    this.delay.feedback.rampTo(delayFb, 0.05);

    // Snap: Envelope attack (5ms - 30ms) & release (0.2s - 1.5s) on live synth & sampler with zero click noise
    const snapNorm = this.macros.snap / 100;
    const attack = 0.005 + (1 - snapNorm) * 0.025;
    const release = 0.2 + (1 - snapNorm) * 1.3;
    const presetEnv = this.currentPreset.synthOptions.envelope;
    this.liveSynth.set({
      envelope: {
        attack,
        decay: presetEnv.decay,
        sustain: presetEnv.sustain,
        release,
      },
    });
    if (this.liveSampler) {
      this.liveSampler.attack = attack;
      this.liveSampler.release = release;
    }
  }

  /**
   * Export Master Audio
   */
  public async startRecording(): Promise<void> {
    if (!this.isReady) return;
    if (this.recorder.state === 'started') return;
    this.recorder.start();
  }

  public async stopRecordingAndDownload(filename: string = 'aurakeys-jam.webm'): Promise<void> {
    if (!this.isReady || this.recorder.state !== 'started') return;
    const recordingBlob = await this.recorder.stop();
    const url = URL.createObjectURL(recordingBlob);
    const anchor = document.createElement('a');
    anchor.download = filename;
    anchor.href = url;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}
