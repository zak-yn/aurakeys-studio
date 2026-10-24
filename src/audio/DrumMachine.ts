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

interface ActiveDrumHit {
  source: AudioBufferSourceNode;
  gain: GainNode;
}

export class DrumMachine {
  private static instance: DrumMachine | null = null;
  public isReady: boolean = false;

  public volumeNode!: Tone.Volume;

  // Per-lane volume nodes, native input bridges & custom sample buffers
  private laneVolumes: Record<DrumLaneId, Tone.Volume | null> = {
    kick: null,
    snare: null,
    hihat: null,
    perc: null,
  };
  private laneNativeInputs: Record<DrumLaneId, GainNode | null> = {
    kick: null,
    snare: null,
    hihat: null,
    perc: null,
  };
  private customBuffers: Record<DrumLaneId, AudioBuffer | null> = {
    kick: null,
    snare: null,
    hihat: null,
    perc: null,
  };
  private activeLaneHits: Record<DrumLaneId, ActiveDrumHit | null> = {
    kick: null,
    snare: null,
    hihat: null,
    perc: null,
  };

  // Pre-rendered studio percussion AudioBuffers (zero runtime oscillator allocation or leaks)
  private drumBuffers: {
    kickLofi?: AudioBuffer;
    kickSynthwave?: AudioBuffer;
    kickMinimal?: AudioBuffer;
    snareLofi?: AudioBuffer;
    snareSynthwave?: AudioBuffer;
    hihatShort?: AudioBuffer;
    hihatLong?: AudioBuffer;
    rimshot?: AudioBuffer;
    clickHigh?: AudioBuffer;
    clickLow?: AudioBuffer;
  } = {};

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

    const rawCtx = Tone.getContext().rawContext as AudioContext;
    this.volumeNode = new Tone.Volume(this.volumeDb).connect(destination);

    // Initialize per-lane volume buses and native gain input bridges
    this.lanes.forEach((lane) => {
      const toneVol = new Tone.Volume(lane.volumeDb).connect(this.volumeNode);
      this.laneVolumes[lane.id] = toneVol;

      const nativeIn = rawCtx.createGain();
      nativeIn.gain.value = 1;
      Tone.connect(nativeIn, toneVol);
      this.laneNativeInputs[lane.id] = nativeIn;
    });

    // Pre-render all drum synthesis buffers once at startup (< 2ms total, 0 runtime CPU overhead)
    this.buildDrumBuffers(rawCtx);

    this.isReady = true;
  }

  /**
   * Synthesizes studio-grade percussion AudioBuffers once into memory.
   * Eliminates runtime OscillatorNode / MetalSynth / NoiseSynth creation and Web Audio param leaks.
   */
  private buildDrumBuffers(ctx: AudioContext) {
    const sr = ctx.sampleRate || 44100;

    // 1. Lo-Fi Boom-Bap Kick (warm, rounded sub-heavy C1 sweep)
    this.drumBuffers.kickLofi = this.synthesizeKick(ctx, sr, 0.42, 185, 34, 0.065, 0.34, 0.95);

    // 2. Synthwave Electro Kick (punchy high-impact transient D1 sweep)
    this.drumBuffers.kickSynthwave = this.synthesizeKick(ctx, sr, 0.34, 340, 38, 0.038, 0.25, 0.98);

    // 3. Minimal Heartbeat Kick (deep soft pulse)
    this.drumBuffers.kickMinimal = this.synthesizeKick(ctx, sr, 0.28, 130, 32, 0.05, 0.2, 0.8);

    // 4. Lo-Fi Snare (180Hz tuned acoustic body + warm pink noise wires)
    this.drumBuffers.snareLofi = this.synthesizeSnare(ctx, sr, 0.26, false);

    // 5. Synthwave Snare (180Hz tuned acoustic body + gated bright 80s white noise wires)
    this.drumBuffers.snareSynthwave = this.synthesizeSnare(ctx, sr, 0.3, true);

    // 6. Hi-Hat Short (32n closed metallic tick) & Long (16n accent/offbeat hat)
    this.drumBuffers.hihatShort = this.synthesizeHiHat(ctx, sr, 0.065);
    this.drumBuffers.hihatLong = this.synthesizeHiHat(ctx, sr, 0.115);

    // 7. Rimshot / Wood Click & Metronome High/Low Clicks
    this.drumBuffers.rimshot = this.synthesizeToneClick(ctx, sr, 0.075, 580, 196, 0.012, 0.75);
    this.drumBuffers.clickHigh = this.synthesizeToneClick(ctx, sr, 0.055, 1760, 880, 0.006, 0.75);
    this.drumBuffers.clickLow = this.synthesizeToneClick(ctx, sr, 0.055, 1318.5, 659.25, 0.006, 0.7);
  }

  private synthesizeKick(
    ctx: AudioContext,
    sr: number,
    duration: number,
    startHz: number,
    endHz: number,
    pitchDecay: number,
    ampDecay: number,
    peakGain: number
  ): AudioBuffer {
    const len = Math.floor(sr * duration);
    const buf = ctx.createBuffer(1, len, sr);
    const out = buf.getChannelData(0);
    let phase = 0;
    const attackSamples = Math.max(1, Math.floor(sr * 0.003));
    const fadeOutSamples = Math.max(1, Math.floor(sr * 0.015));

    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const freq = endHz + (startHz - endHz) * Math.exp(-t / pitchDecay);
      phase += (2 * Math.PI * freq) / sr;

      let env = Math.exp(-t / (ampDecay * 0.45));
      if (i < attackSamples) {
        env *= i / attackSamples;
      } else if (i > len - fadeOutSamples) {
        env *= (len - i) / fadeOutSamples;
      }

      // Subtle 2nd harmonic warmth on transient
      const sig = Math.sin(phase) + 0.15 * Math.sin(phase * 2) * Math.exp(-t / 0.03);
      out[i] = Math.tanh(sig * 1.15) * env * peakGain;
    }
    return buf;
  }

  private synthesizeSnare(
    ctx: AudioContext,
    sr: number,
    duration: number,
    brightWires: boolean
  ): AudioBuffer {
    const len = Math.floor(sr * duration);
    const buf = ctx.createBuffer(1, len, sr);
    const out = buf.getChannelData(0);

    let bodyPhase = 0;
    let pinkB0 = 0;
    let pinkB1 = 0;
    let pinkB2 = 0;
    const attackSamples = Math.max(1, Math.floor(sr * 0.0015));
    const fadeOutSamples = Math.max(1, Math.floor(sr * 0.015));

    for (let i = 0; i < len; i++) {
      const t = i / sr;
      // 180Hz -> 98Hz punchy drum shell knock
      const bodyFreq = 98 + (220 - 98) * Math.exp(-t / 0.016);
      bodyPhase += (2 * Math.PI * bodyFreq) / sr;
      const bodyEnv = Math.exp(-t / 0.055);
      const bodySig = Math.sin(bodyPhase) * bodyEnv * 0.65;

      // Snare wires noise
      const white = Math.random() * 2 - 1;
      let wireNoise = white;
      if (!brightWires) {
        // Warm Kellet pink-filter approximation for Lo-Fi snare
        pinkB0 = 0.99765 * pinkB0 + white * 0.099046;
        pinkB1 = 0.963 * pinkB1 + white * 0.2965164;
        pinkB2 = 0.57 * pinkB2 + white * 1.0526913;
        wireNoise = (pinkB0 + pinkB1 + pinkB2 + white * 0.1848) * 0.22;
      } else {
        wireNoise = white * 0.7;
      }

      const wireDecay = brightWires ? 0.095 : 0.07;
      const wireEnv = Math.exp(-t / wireDecay);
      let total = bodySig + wireNoise * wireEnv * 0.75;

      if (i < attackSamples) {
        total *= i / attackSamples;
      } else if (i > len - fadeOutSamples) {
        total *= (len - i) / fadeOutSamples;
      }

      out[i] = Math.tanh(total * 1.25) * 0.92;
    }
    return buf;
  }

  private synthesizeHiHat(ctx: AudioContext, sr: number, duration: number): AudioBuffer {
    const len = Math.floor(sr * duration);
    const buf = ctx.createBuffer(1, len, sr);
    const out = buf.getChannelData(0);

    // Classic TR-808 inharmonic metallic ratios
    const ratios = [1.0, 1.483, 1.932, 2.546, 2.63, 3.897];
    const baseFreq = 820;
    const phases = new Float64Array(ratios.length);
    let prevSample = 0;
    const attackSamples = Math.max(1, Math.floor(sr * 0.001));
    const fadeOutSamples = Math.max(1, Math.floor(sr * 0.008));
    const decayTau = duration * 0.32;

    for (let i = 0; i < len; i++) {
      const t = i / sr;
      let metalSum = 0;
      for (let r = 0; r < ratios.length; r++) {
        phases[r] += (2 * Math.PI * baseFreq * ratios[r]) / sr;
        metalSum += Math.sin(phases[r]) >= 0 ? 1 : -1;
      }
      const white = Math.random() * 2 - 1;
      const raw = (metalSum / ratios.length) * 0.45 + white * 0.55;
      // 1-pole high-pass difference filter for crisp cymbal shimmer
      const highpassed = raw - prevSample * 0.86;
      prevSample = raw;

      let env = Math.exp(-t / decayTau);
      if (i < attackSamples) {
        env *= i / attackSamples;
      } else if (i > len - fadeOutSamples) {
        env *= (len - i) / fadeOutSamples;
      }

      out[i] = Math.max(-0.9, Math.min(0.9, highpassed * env * 0.28));
    }
    return buf;
  }

  private synthesizeToneClick(
    ctx: AudioContext,
    sr: number,
    duration: number,
    startHz: number,
    endHz: number,
    pitchDecay: number,
    peakGain: number
  ): AudioBuffer {
    const len = Math.floor(sr * duration);
    const buf = ctx.createBuffer(1, len, sr);
    const out = buf.getChannelData(0);
    let phase = 0;
    const attackSamples = Math.max(1, Math.floor(sr * 0.001));
    const fadeOutSamples = Math.max(1, Math.floor(sr * 0.008));

    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const freq = endHz + (startHz - endHz) * Math.exp(-t / pitchDecay);
      phase += (2 * Math.PI * freq) / sr;
      // Triangle harmonic character
      const tri = (2 / Math.PI) * Math.asin(Math.sin(phase));
      let env = Math.exp(-t / (duration * 0.35));
      if (i < attackSamples) {
        env *= i / attackSamples;
      } else if (i > len - fadeOutSamples) {
        env *= (len - i) / fadeOutSamples;
      }
      out[i] = tri * env * peakGain;
    }
    return buf;
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

    this.customBuffers[laneId] = buffer;
    lane.customSampleName = sampleName;
    this.notifyLanesUpdate();
  }

  public clearCustomLaneSample(laneId: DrumLaneId) {
    const lane = this.lanes.find((l) => l.id === laneId);
    if (!lane) return;
    this.customBuffers[laneId] = null;
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

    for (let i = 0; i < this.lanes.length; i++) {
      const lane = this.lanes[i];
      if (lane.isMuted) continue;
      const stepVel = lane.steps[stepInBar];
      if (stepVel > 0) {
        this.triggerLaneVoice(lane.id, stepVel, time, stepInBar);
      }
    }
  }

  public triggerLaneVoice(laneId: DrumLaneId, stepVel: StepVelocity, time: number, stepInBar: number) {
    if (!this.isReady) return;
    const rawCtx = Tone.getContext().rawContext as AudioContext;
    const dest = this.laneNativeInputs[laneId];
    if (!rawCtx || !dest) return;

    const startTime = Math.max(rawCtx.currentTime, time);
    const vel = stepVel === 2 ? 0.95 : 0.65;

    // Select custom buffer or pre-rendered studio drum buffer
    let bufferToPlay: AudioBuffer | undefined = this.customBuffers[laneId] || undefined;

    if (!bufferToPlay) {
      switch (laneId) {
        case 'kick':
          bufferToPlay =
            this.currentStyle === 'synthwave'
              ? this.drumBuffers.kickSynthwave
              : this.currentStyle === 'minimal'
              ? this.drumBuffers.kickMinimal
              : this.drumBuffers.kickLofi;
          break;
        case 'snare':
          bufferToPlay =
            this.currentStyle === 'synthwave'
              ? this.drumBuffers.snareSynthwave
              : this.drumBuffers.snareLofi;
          break;
        case 'hihat': {
          const isOffbeat = stepInBar % 4 === 2;
          bufferToPlay =
            stepVel === 2 || isOffbeat
              ? this.drumBuffers.hihatLong
              : this.drumBuffers.hihatShort;
          break;
        }
        case 'perc':
          if (this.currentStyle === 'metronome') {
            bufferToPlay =
              stepInBar === 0 ? this.drumBuffers.clickHigh : this.drumBuffers.clickLow;
          } else {
            bufferToPlay = this.drumBuffers.rimshot;
          }
          break;
      }
    }

    if (!bufferToPlay) return;

    // Smoothly choke previous hit on the same lane over 5ms to prevent click or phase stacking on rapid rolls
    const prevHit = this.activeLaneHits[laneId];
    if (prevHit) {
      try {
        prevHit.gain.gain.setValueAtTime(prevHit.gain.gain.value, startTime);
        prevHit.gain.gain.linearRampToValueAtTime(0.0001, startTime + 0.005);
        prevHit.source.stop(startTime + 0.006);
      } catch {}
    }

    try {
      const source = rawCtx.createBufferSource();
      source.buffer = bufferToPlay;

      const hitGain = rawCtx.createGain();
      hitGain.gain.setValueAtTime(vel, startTime);

      source.connect(hitGain);
      hitGain.connect(dest);

      const hitRecord: ActiveDrumHit = { source, gain: hitGain };
      this.activeLaneHits[laneId] = hitRecord;

      source.onended = () => {
        if (this.activeLaneHits[laneId] === hitRecord) {
          this.activeLaneHits[laneId] = null;
        }
        try {
          source.disconnect();
          hitGain.disconnect();
        } catch {}
      };

      source.start(startTime);
    } catch {}
  }

  private notifyLanesUpdate() {
    if (this.onLanesUpdate) {
      this.onLanesUpdate(this.lanes.map((l) => ({ ...l, steps: [...l.steps] })));
    }
  }
}
