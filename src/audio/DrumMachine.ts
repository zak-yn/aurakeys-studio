import * as Tone from 'tone';

export type DrumStyle = 'off' | 'lofi' | 'synthwave' | 'minimal' | 'metronome';
export type DrumLaneId = 'kick' | 'snare' | 'hihat' | 'perc';
export type StepVelocity = 0 | 1 | 2; // 0 = Off, 1 = Normal, 2 = Accent

export interface DrumBeatDef {
  id: DrumStyle;
  name: string;
  subtitle: string;
}

export interface DrumLaneState {
  id: DrumLaneId;
  name: string;
  shortLabel: string;
  hotkeyLabel: string;
  color: string;
  isMuted: boolean;
  volumeDb: number;
  customSampleName: string | null;
  steps: StepVelocity[]; // 16 steps
}

export const DRUM_BEATS: DrumBeatDef[] = [
  { id: 'off', name: 'Mute', subtitle: 'Silent' },
  { id: 'lofi', name: 'Lo-Fi Chill', subtitle: 'Boom-Bap' },
  { id: 'synthwave', name: 'Synthwave', subtitle: '4-on-Floor' },
  { id: 'minimal', name: 'Minimal Pulse', subtitle: 'Heartbeat' },
  { id: 'metronome', name: 'Metronome', subtitle: 'Clean Click' },
];

const PRESET_PATTERNS: Record<DrumStyle, Record<DrumLaneId, StepVelocity[]>> = {
  off: {
    kick:  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    snare: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    hihat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    perc:  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  lofi: {
    kick:  [2, 0, 0, 0, 0, 0, 0, 1, 0, 0, 2, 0, 0, 0, 0, 0],
    snare: [0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0],
    hihat: [1, 0, 2, 0, 1, 0, 2, 0, 1, 0, 2, 0, 1, 0, 2, 0],
    perc:  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  },
  synthwave: {
    kick:  [2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0],
    snare: [0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0],
    hihat: [1, 1, 2, 1, 1, 1, 2, 1, 1, 1, 2, 1, 1, 1, 2, 1],
    perc:  [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0],
  },
  minimal: {
    kick:  [2, 0, 1, 0, 0, 0, 0, 0, 2, 0, 1, 0, 0, 0, 0, 0],
    snare: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    hihat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
    perc:  [0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0],
  },
  metronome: {
    kick:  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    snare: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    hihat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    perc:  [2, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
  },
};

export class DrumMachine {
  private static instance: DrumMachine | null = null;
  public isReady: boolean = false;

  // Dedicated sound generators for dry, crisp drum sounds (with 2-voice alternating pairs for noise-free rapid hits)
  public kick!: Tone.MembraneSynth;
  public kickB!: Tone.MembraneSynth;
  public synthwaveKick!: Tone.MembraneSynth;
  public snareBody!: Tone.MembraneSynth;
  public snareBodyB!: Tone.MembraneSynth;
  public snare!: Tone.NoiseSynth;
  public snareB!: Tone.NoiseSynth;
  public synthwaveSnare!: Tone.NoiseSynth;
  public hihat!: Tone.MetalSynth;
  public hihatB!: Tone.MetalSynth;
  public rimshot!: Tone.MembraneSynth;
  public clickSynth!: Tone.MembraneSynth;
  public volumeNode!: Tone.Volume;

  private kickVoiceToggle: number = 0;
  private snareVoiceToggle: number = 0;
  private hihatVoiceToggle: number = 0;

  // Per-lane volume nodes & optional custom sample players
  private laneVolumes: Record<DrumLaneId, Tone.Volume | null> = {
    kick: null,
    snare: null,
    hihat: null,
    perc: null,
  };
  private customPlayers: Record<DrumLaneId, Tone.Player | null> = {
    kick: null,
    snare: null,
    hihat: null,
    perc: null,
  };

  public currentStyle: DrumStyle = 'lofi';
  public isMuted: boolean = false;
  public volumeDb: number = -6;
  public isDrumRecording: boolean = false;
  public currentStepInBar: number = 0;

  public lanes: DrumLaneState[] = [
    {
      id: 'kick',
      name: 'Sub Kick',
      shortLabel: 'KICK',
      hotkeyLabel: '`',
      color: '#f59e0b',
      isMuted: false,
      volumeDb: 0,
      customSampleName: null,
      steps: [...PRESET_PATTERNS.lofi.kick],
    },
    {
      id: 'snare',
      name: 'Crisp Snare',
      shortLabel: 'SNARE',
      hotkeyLabel: '-',
      color: '#06b6d4',
      isMuted: false,
      volumeDb: 0,
      customSampleName: null,
      steps: [...PRESET_PATTERNS.lofi.snare],
    },
    {
      id: 'hihat',
      name: 'Closed Hat',
      shortLabel: 'HI-HAT',
      hotkeyLabel: '=',
      color: '#a855f7',
      isMuted: false,
      volumeDb: -3,
      customSampleName: null,
      steps: [...PRESET_PATTERNS.lofi.hihat],
    },
    {
      id: 'perc',
      name: 'Rim / Click',
      shortLabel: 'PERC',
      hotkeyLabel: '[',
      color: '#10b981',
      isMuted: false,
      volumeDb: 0,
      customSampleName: null,
      steps: [...PRESET_PATTERNS.lofi.perc],
    },
  ];

  public onLanesUpdate?: (lanes: DrumLaneState[]) => void;

  private constructor() {}

  public static getInstance(): DrumMachine {
    if (!DrumMachine.instance) {
      DrumMachine.instance = new DrumMachine();
    }
    return DrumMachine.instance;
  }

  public init(destination: Tone.ToneAudioNode) {
    if (this.isReady) return;

    this.volumeNode = new Tone.Volume(this.volumeDb).connect(destination);

    // Initialize per-lane volume buses
    this.lanes.forEach((lane) => {
      this.laneVolumes[lane.id] = new Tone.Volume(lane.volumeDb).connect(this.volumeNode);
    });

    // 1. Lo-Fi Boom-Bap Kick: warm, rounded, sub-heavy (Pair A & B)
    const kickOptions = {
      pitchDecay: 0.08,
      octaves: 4,
      oscillator: { type: 'sine' as const },
      envelope: {
        attack: 0.005,
        decay: 0.35,
        sustain: 0.01,
        release: 0.3,
      },
    };
    this.kick = new Tone.MembraneSynth(kickOptions).connect(this.laneVolumes.kick!);
    this.kickB = new Tone.MembraneSynth(kickOptions).connect(this.laneVolumes.kick!);

    // 2. Synthwave Electro Kick: punchy, high-impact transient
    this.synthwaveKick = new Tone.MembraneSynth({
      pitchDecay: 0.04,
      octaves: 7,
      oscillator: { type: 'sine' },
      envelope: {
        attack: 0.001,
        decay: 0.25,
        sustain: 0,
        release: 0.2,
      },
    }).connect(this.laneVolumes.kick!);

    // 3a. Snare Acoustic Body: tuned 180Hz punchy knock/thump for physical presence (Pair A & B)
    const snareBodyOptions = {
      pitchDecay: 0.015,
      octaves: 2.2,
      oscillator: { type: 'triangle' as const },
      envelope: {
        attack: 0.001,
        decay: 0.14,
        sustain: 0,
        release: 0.1,
      },
    };
    this.snareBody = new Tone.MembraneSynth(snareBodyOptions).connect(this.laneVolumes.snare!);
    this.snareBody.volume.value = 1;
    this.snareBodyB = new Tone.MembraneSynth(snareBodyOptions).connect(this.laneVolumes.snare!);
    this.snareBodyB.volume.value = 1;

    // 3b. Lo-Fi Snare Wires: mellow pink noise with warm body (Pair A & B)
    const snareNoiseOptions = {
      noise: { type: 'pink' as const },
      envelope: {
        attack: 0.001,
        decay: 0.18,
        sustain: 0,
        release: 0.12,
      },
    };
    this.snare = new Tone.NoiseSynth(snareNoiseOptions).connect(this.laneVolumes.snare!);
    this.snare.volume.value = 2;
    this.snareB = new Tone.NoiseSynth(snareNoiseOptions).connect(this.laneVolumes.snare!);
    this.snareB.volume.value = 2;

    // 4. Synthwave Gated 80s Snare Wires: sharp white noise with crisp snap
    this.synthwaveSnare = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: {
        attack: 0.001,
        decay: 0.22,
        sustain: 0.01,
        release: 0.16,
      },
    }).connect(this.laneVolumes.snare!);
    this.synthwaveSnare.volume.value = 2;

    // 5. Hi-Hat: metallic cymbal tick calibrated to sit cleanly in the mix without masking the snare (Pair A & B)
    const hihatOptions = {
      envelope: {
        attack: 0.001,
        decay: 0.045,
        release: 0.03,
      },
      harmonicity: 5.1,
      modulationIndex: 28,
      resonance: 4000,
      octaves: 1.5,
    };
    this.hihat = new Tone.MetalSynth(hihatOptions).connect(this.laneVolumes.hihat!);
    this.hihat.volume.value = -14;
    this.hihatB = new Tone.MetalSynth(hihatOptions).connect(this.laneVolumes.hihat!);
    this.hihatB.volume.value = -14;

    // 6. Minimal Rimshot / Wood Click: organic percussion
    this.rimshot = new Tone.MembraneSynth({
      pitchDecay: 0.01,
      octaves: 2,
      oscillator: { type: 'triangle' },
      envelope: {
        attack: 0.001,
        decay: 0.06,
        sustain: 0,
        release: 0.04,
      },
    }).connect(this.laneVolumes.perc!);
    this.rimshot.volume.value = -2;

    // 7. Metronome Click: clean acoustic woodblock
    this.clickSynth = new Tone.MembraneSynth({
      pitchDecay: 0.005,
      octaves: 2,
      oscillator: { type: 'triangle' },
      envelope: {
        attack: 0.001,
        decay: 0.04,
        sustain: 0,
        release: 0.03,
      },
    }).connect(this.laneVolumes.perc!);
    this.clickSynth.volume.value = -2;

    this.isReady = true;
  }

  /**
   * Loads a preset style into the editable 16-step matrix.
   */
  public setStyle(style: DrumStyle) {
    this.currentStyle = style;
    const preset = PRESET_PATTERNS[style];
    if (preset) {
      this.lanes.forEach((lane) => {
        lane.steps = [...preset[lane.id]];
      });
      this.notifyLanesUpdate();
    }
  }

  /**
   * Cycles a step velocity inside the 4x16 drum matrix (0 -> 1 -> 2 -> 0, or 0 <-> 1).
   */
  public toggleStep(laneIndex: number, stepIndex: number, cycleAccent: boolean = false) {
    const lane = this.lanes[laneIndex];
    if (!lane || stepIndex < 0 || stepIndex >= 16) return;

    const current = lane.steps[stepIndex];
    if (cycleAccent) {
      lane.steps[stepIndex] = ((current + 1) % 3) as StepVelocity;
    } else {
      lane.steps[stepIndex] = current === 0 ? 1 : current === 1 ? 2 : 0;
    }
    this.notifyLanesUpdate();
  }

  public toggleLaneMute(laneIndex: number) {
    const lane = this.lanes[laneIndex];
    if (!lane) return;
    lane.isMuted = !lane.isMuted;
    const volNode = this.laneVolumes[lane.id];
    if (volNode) {
      volNode.volume.rampTo(lane.isMuted ? -Infinity : lane.volumeDb, 0.05);
    }
    this.notifyLanesUpdate();
  }

  public setLaneVolume(laneIndex: number, volDb: number) {
    const lane = this.lanes[laneIndex];
    if (!lane) return;
    lane.volumeDb = Math.max(-30, Math.min(4, volDb));
    const volNode = this.laneVolumes[lane.id];
    if (volNode && !lane.isMuted) {
      volNode.volume.rampTo(lane.volumeDb, 0.05);
    }
    this.notifyLanesUpdate();
  }

  public clearAllSteps() {
    this.lanes.forEach((lane) => {
      lane.steps = new Array(16).fill(0) as StepVelocity[];
    });
    this.notifyLanesUpdate();
  }

  /**
   * Assigns a user-recorded AudioBuffer to a specific drum lane (Kick, Snare, Hat, or Perc).
   */
  public setCustomLaneSample(laneId: DrumLaneId, buffer: AudioBuffer, sampleName: string) {
    const lane = this.lanes.find((l) => l.id === laneId);
    if (!lane) return;

    if (this.customPlayers[laneId]) {
      try {
        this.customPlayers[laneId]!.dispose();
      } catch {
        // ignore
      }
    }

    const volNode = this.laneVolumes[laneId] || this.volumeNode;
    const toneBuffer = new Tone.ToneAudioBuffer(buffer);
    this.customPlayers[laneId] = new Tone.Player(toneBuffer).connect(volNode);
    lane.customSampleName = sampleName;
    this.notifyLanesUpdate();
  }

  public clearCustomLaneSample(laneId: DrumLaneId) {
    const lane = this.lanes.find((l) => l.id === laneId);
    if (!lane) return;
    if (this.customPlayers[laneId]) {
      try {
        this.customPlayers[laneId]!.dispose();
      } catch {
        // ignore
      }
      this.customPlayers[laneId] = null;
    }
    lane.customSampleName = null;
    this.notifyLanesUpdate();
  }

  /**
   * Live finger-drumming pad hit (from UI pad click or hotkeys ` - = [ ).
   * If isDrumRecording is active, quantizes the hit into the 16-step grid!
   */
  public triggerLivePad(laneIndex: number) {
    if (!this.isReady) return;
    const lane = this.lanes[laneIndex];
    if (!lane) return;

    this.triggerLaneVoice(lane.id, 2, Tone.now(), this.currentStepInBar);

    if (this.isDrumRecording) {
      lane.steps[this.currentStepInBar] = 2;
      this.notifyLanesUpdate();
    }
  }

  public toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.volumeNode) {
      this.volumeNode.volume.rampTo(this.isMuted ? -Infinity : this.volumeDb, 0.05);
    }
    return this.isMuted;
  }

  public setVolume(volDb: number) {
    this.volumeDb = Math.max(-36, Math.min(2, volDb));
    if (this.volumeNode && !this.isMuted) {
      this.volumeNode.volume.rampTo(this.volumeDb, 0.05);
    }
  }

  /**
   * Called on every 16th-note step by Tone.Transport.
   * stepInBar is 0 to 15.
   */
  public triggerStep(stepInBar: number, time: number) {
    this.currentStepInBar = stepInBar;
    if (!this.isReady || this.isMuted || this.currentStyle === 'off') return;

    this.lanes.forEach((lane) => {
      if (lane.isMuted) return;
      const stepVel = lane.steps[stepInBar];
      if (stepVel > 0) {
        this.triggerLaneVoice(lane.id, stepVel, time, stepInBar);
      }
    });
  }

  public triggerLaneVoice(laneId: DrumLaneId, stepVel: StepVelocity, time: number, stepInBar: number) {
    const vel = stepVel === 2 ? 0.95 : 0.65;

    // If user assigned a custom recorded sample to this drum lane, trigger it
    const customPlayer = this.customPlayers[laneId];
    if (customPlayer && customPlayer.loaded) {
      try {
        customPlayer.volume.value = stepVel === 2 ? 0 : -4;
        customPlayer.start(time);
        return;
      } catch {
        // fallback to synth drum
      }
    }

    switch (laneId) {
      case 'kick': {
        const isVoiceA = this.kickVoiceToggle++ % 2 === 0;
        const targetKick = isVoiceA ? this.kick : this.kickB;
        if (this.currentStyle === 'synthwave') {
          this.synthwaveKick.triggerAttackRelease('D1', '8n', time, vel);
        } else if (this.currentStyle === 'minimal') {
          targetKick.triggerAttackRelease('A0', '16n', time, vel * 0.85);
        } else {
          targetKick.triggerAttackRelease('C1', '8n', time, vel);
        }
        break;
      }
      case 'snare': {
        const isVoiceA = this.snareVoiceToggle++ % 2 === 0;
        const targetBody = isVoiceA ? this.snareBody : this.snareBodyB;
        const targetNoise = isVoiceA ? this.snare : this.snareB;

        targetBody.triggerAttackRelease('G2', '16n', time, vel);
        if (this.currentStyle === 'synthwave') {
          this.synthwaveSnare.triggerAttackRelease('16n', time, vel);
        } else {
          targetNoise.triggerAttackRelease('16n', time, vel);
        }
        break;
      }
      case 'hihat': {
        const isOffbeat = stepInBar % 4 === 2;
        const dur = stepVel === 2 || isOffbeat ? '16n' : '32n';
        const isVoiceA = this.hihatVoiceToggle++ % 2 === 0;
        const targetHat = isVoiceA ? this.hihat : this.hihatB;
        targetHat.triggerAttackRelease('200', dur, time, vel * 0.85);
        break;
      }
      case 'perc': {
        if (this.currentStyle === 'metronome') {
          const pitch = stepInBar === 0 ? 'A4' : 'E4';
          this.clickSynth.triggerAttackRelease(pitch, '32n', time, vel);
        } else {
          this.rimshot.triggerAttackRelease('G3', '32n', time, vel * 0.8);
        }
        break;
      }
    }
  }

  private notifyLanesUpdate() {
    if (this.onLanesUpdate) {
      this.onLanesUpdate(this.lanes.map((l) => ({ ...l, steps: [...l.steps] })));
    }
  }
}
