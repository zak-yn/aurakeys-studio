import * as Tone from 'tone';
import {
  PRESETS,
  PresetConfig,
  SubOscConfig,
  NoiseLayerConfig,
  VoiceFilterConfig,
  PitchEnvConfig,
  VibratoConfig,
} from './presets';
import { CustomSampleData, RegisteredVoice, SamplerEngine } from './SamplerEngine';
import { NOTE_SEMITONES, SEMITONE_TO_NOTE } from './scales';

export interface MacroControls {
  warmth: number; // 0 - 100
  space: number;  // 0 - 100
  snap: number;   // 0 - 100
  echo: number;   // 0 - 100
}

// Fast O(1) note-to-frequency and MIDI conversion cache (zero Tone.Frequency allocations at runtime)
const freqCache = new Map<string, number>();
const midiCache = new Map<string, number>();

export function noteToMidiFast(noteOrHz: string | number): number {
  if (typeof noteOrHz === 'number') {
    return 69 + 12 * Math.log2(Math.max(20, noteOrHz) / 440);
  }
  const cached = midiCache.get(noteOrHz);
  if (cached !== undefined) return cached;

  const match = /^([A-G][#b]?)(-?\d+)$/.exec(noteOrHz.trim());
  if (match) {
    const semi = NOTE_SEMITONES[match[1]] ?? 0;
    const oct = parseInt(match[2], 10);
    const midi = (oct + 1) * 12 + semi;
    midiCache.set(noteOrHz, midi);
    return midi;
  }

  const parsed = parseFloat(noteOrHz);
  if (Number.isFinite(parsed) && parsed > 0) {
    return 69 + 12 * Math.log2(parsed / 440);
  }
  return 60;
}

export function noteToHzFast(noteOrHz: string | number): number {
  if (typeof noteOrHz === 'number') return noteOrHz;
  const cached = freqCache.get(noteOrHz);
  if (cached !== undefined) return cached;

  const midi = noteToMidiFast(noteOrHz);
  const hz = 440 * Math.pow(2, (midi - 69) / 12);
  freqCache.set(noteOrHz, hz);
  return hz;
}

export function transposeNoteFast(note: string, octaveOffset: number): string {
  if (octaveOffset === 0) return note;
  const match = /^([A-G][#b]?)(-?\d+)$/.exec(note.trim());
  if (!match) return note;
  const semi = NOTE_SEMITONES[match[1]] ?? 0;
  const oct = parseInt(match[2], 10) + octaveOffset;
  const noteName = SEMITONE_TO_NOTE[((semi % 12) + 12) % 12];
  return `${noteName}${oct}`;
}

// Shared static white & pink noise AudioBuffers (created once per AudioContext, zero GC)
let sharedWhiteNoiseBuffer: AudioBuffer | null = null;
let sharedPinkNoiseBuffer: AudioBuffer | null = null;

function getSharedNoiseBuffer(ctx: AudioContext, type: 'white' | 'pink'): AudioBuffer {
  if (type === 'white' && sharedWhiteNoiseBuffer) return sharedWhiteNoiseBuffer;
  if (type === 'pink' && sharedPinkNoiseBuffer) return sharedPinkNoiseBuffer;

  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * 1.6);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  if (type === 'white') {
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    sharedWhiteNoiseBuffer = buffer;
  } else {
    // Paul Kellet's pink noise filter (normalized for rich acoustic breath & transient presence)
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      const sample = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.26;
      data[i] = Math.max(-0.98, Math.min(0.98, sample));
      b6 = white * 0.115926;
    }
    sharedPinkNoiseBuffer = buffer;
  }

  return buffer;
}

interface ActiveSynthVoice {
  key: number;
  oscillators: OscillatorNode[];
  bufferSources: AudioBufferSourceNode[];
  extraNodes: AudioNode[];
  envGain: GainNode;
  noiseGain?: GainNode;
  subGain?: GainNode;
  filterNode?: BiquadFilterNode;
  lfoOsc?: OscillatorNode;
  lfoGain?: GainNode;
  voiceScale: number;
  startTime: number;
  peakGain: number;
  sustainLevel: number;
  attack: number;
  decay: number;
  release: number;
  released: boolean;
  isDisposed: boolean;
  cleanup: () => void;
}

/**
 * Multi-Layer Zero-Leak Native Web Audio Polyphonic Synthesizer (v2.6).
 * Supports:
 * 1. Main Oscillator (Basic, Unison Fat Detune, 2-Op FM)
 * 2. Sub-Oscillator Layer (-1 / -2 octave sine/triangle/square)
 * 3. Transient Noise / Breath Layer (White/Pink noise burst or sustained air)
 * 4. Per-Voice Resonant Filter + Filter Envelope (LP/BP/HP BiquadFilterNode)
 * 5. Pitch Envelope & Vibrato LFO
 */
export class NativePolySynth {
  public maxPolyphony: number = 16;
  public appliedPresetId: string = '';
  public volume: { value: number };
  private rawCtx: AudioContext;
  public outputGain: GainNode;
  private activeVoices: ActiveSynthVoice[] = [];

  private oscOptions: any = { type: 'fatsawtooth', count: 2, spread: 15 };
  private envOptions = { attack: 0.02, decay: 0.4, sustain: 0.75, release: 1.2 };
  private subOscOptions?: SubOscConfig;
  private noiseOptions?: NoiseLayerConfig;
  private filterOptions?: VoiceFilterConfig;
  private pitchEnvOptions?: PitchEnvConfig;
  private vibratoOptions?: VibratoConfig;

  constructor(rawCtx: AudioContext, maxPolyphony = 16, initialVolumeDb = -6) {
    this.rawCtx = rawCtx;
    this.maxPolyphony = maxPolyphony;
    this.outputGain = rawCtx.createGain();
    const initialLinear = Math.pow(10, initialVolumeDb / 20);
    this.outputGain.gain.value = initialLinear;

    const self = this;
    this.volume = {
      get value() {
        return 20 * Math.log10(Math.max(0.00001, self.outputGain.gain.value));
      },
      set value(db: number) {
        const gain = db <= -60 ? 0 : Math.pow(10, db / 20);
        self.outputGain.gain.setTargetAtTime(gain, self.rawCtx.currentTime, 0.015);
      },
    };
  }

  public connect(dest: Tone.ToneAudioNode | AudioNode) {
    if (dest instanceof AudioNode) {
      this.outputGain.connect(dest);
    } else {
      Tone.connect(this.outputGain, dest);
    }
    return this;
  }

  public set(options: {
    oscillator?: any;
    envelope?: any;
    subOsc?: SubOscConfig;
    noise?: NoiseLayerConfig;
    filter?: VoiceFilterConfig;
    pitchEnv?: PitchEnvConfig;
    vibrato?: VibratoConfig;
  }) {
    const now = this.rawCtx.currentTime;
    if (options.oscillator) {
      this.oscOptions = { ...options.oscillator };
    }
    if (options.envelope) {
      this.envOptions = {
        ...this.envOptions,
        ...options.envelope,
      };
    }
    if ('subOsc' in options) {
      this.subOscOptions = options.subOsc ? { ...options.subOsc } : undefined;
      for (let i = 0; i < this.activeVoices.length; i++) {
        const v = this.activeVoices[i];
        if (!v.released && v.subGain) {
          const unisonComp = 0.32 / Math.max(0.12, v.voiceScale);
          const targetSub =
            this.subOscOptions && this.subOscOptions.enabled
              ? Math.min(2.2, this.subOscOptions.mix * 1.45 * unisonComp)
              : 0;
          v.subGain.gain.setTargetAtTime(targetSub, now, 0.015);
        }
      }
    }
    if ('noise' in options) {
      this.noiseOptions = options.noise ? { ...options.noise } : undefined;
    }
    if ('filter' in options) {
      this.filterOptions = options.filter ? { ...options.filter } : undefined;
      for (let i = 0; i < this.activeVoices.length; i++) {
        const v = this.activeVoices[i];
        if (!v.released && v.filterNode && this.filterOptions) {
          if (this.filterOptions.enabled) {
            v.filterNode.type = this.filterOptions.type || 'lowpass';
            const cutoff = Math.max(60, Math.min(16000, this.filterOptions.cutoffHz || 2400));
            const q = Math.max(0.3, Math.min(15, this.filterOptions.resonanceQ ?? 1.0));
            v.filterNode.frequency.setTargetAtTime(cutoff, now, 0.02);
            v.filterNode.Q.setTargetAtTime(q, now, 0.02);
          } else {
            v.filterNode.type = 'lowpass';
            v.filterNode.frequency.setTargetAtTime(18000, now, 0.02);
            v.filterNode.Q.setTargetAtTime(0.5, now, 0.02);
          }
        }
      }
    }
    if ('pitchEnv' in options) {
      this.pitchEnvOptions = options.pitchEnv ? { ...options.pitchEnv } : undefined;
    }
    if ('vibrato' in options) {
      this.vibratoOptions = options.vibrato ? { ...options.vibrato } : undefined;
      for (let i = 0; i < this.activeVoices.length; i++) {
        const v = this.activeVoices[i];
        if (!v.released && v.lfoOsc && v.lfoGain && this.vibratoOptions) {
          const depth = this.vibratoOptions.enabled
            ? Math.min(80, this.vibratoOptions.depthCents)
            : 0;
          const rate = Math.max(0.3, Math.min(14, this.vibratoOptions.rateHz || 4.5));
          v.lfoOsc.frequency.setTargetAtTime(rate, now, 0.02);
          v.lfoGain.gain.setTargetAtTime(depth, now, 0.02);
        }
      }
    }
  }

  private getKeyForNote(note: string | number): number {
    return Math.round(noteToMidiFast(note) * 100);
  }

  public triggerAttack(notes: (string | number) | (string | number)[], time?: number, velocity = 1) {
    const noteArr = Array.isArray(notes) ? notes : [notes];
    const startTime = Math.max(this.rawCtx.currentTime, time ?? this.rawCtx.currentTime);

    for (let i = 0; i < noteArr.length; i++) {
      this.startSingleVoice(noteArr[i], startTime, velocity);
    }
    return this;
  }

  public triggerRelease(notes: (string | number) | (string | number)[], time?: number) {
    const noteArr = Array.isArray(notes) ? notes : [notes];
    const relTime = Math.max(this.rawCtx.currentTime, time ?? this.rawCtx.currentTime);

    for (let i = 0; i < noteArr.length; i++) {
      const key = this.getKeyForNote(noteArr[i]);
      const target = this.activeVoices.find((v) => v.key === key && !v.released);
      if (target) {
        this.releaseVoice(target, relTime, target.release);
      }
    }
    return this;
  }

  public triggerAttackRelease(
    notes: (string | number) | (string | number)[],
    duration: number | string,
    time?: number,
    velocity = 1
  ) {
    const startTime = Math.max(this.rawCtx.currentTime, time ?? this.rawCtx.currentTime);
    const durSec = typeof duration === 'number' ? duration : Tone.Time(duration).toSeconds();
    const noteArr = Array.isArray(notes) ? notes : [notes];

    for (let i = 0; i < noteArr.length; i++) {
      const voice = this.startSingleVoice(noteArr[i], startTime, velocity);
      if (voice) {
        this.releaseVoice(voice, startTime + Math.max(0.02, durSec), voice.release);
      }
    }
    return this;
  }

  public releaseAll(time?: number) {
    const relTime = Math.max(this.rawCtx.currentTime, time ?? this.rawCtx.currentTime);
    for (let i = 0; i < this.activeVoices.length; i++) {
      const v = this.activeVoices[i];
      if (!v.released) {
        this.releaseVoice(v, relTime, Math.min(0.15, v.release));
      }
    }
    return this;
  }

  private startSingleVoice(
    note: string | number,
    startTime: number,
    velocity: number
  ): ActiveSynthVoice | null {
    const key = this.getKeyForNote(note);
    const freqHz = Math.max(20, Math.min(16000, noteToHzFast(note)));

    // 1. Smoothly fade out duplicate active note on same key
    for (let i = 0; i < this.activeVoices.length; i++) {
      const existing = this.activeVoices[i];
      if (existing.key === key && !existing.released) {
        this.releaseVoice(existing, startTime, 0.012);
      }
    }

    // 2. Enforce maxPolyphony with smooth voice stealing
    while (this.activeVoices.length >= this.maxPolyphony) {
      const victim =
        this.activeVoices.find((v) => v.released) || this.activeVoices[0];
      if (victim) {
        this.releaseVoice(victim, startTime, 0.01);
        const idx = this.activeVoices.indexOf(victim);
        if (idx !== -1) this.activeVoices.splice(idx, 1);
      } else {
        break;
      }
    }

    const ctx = this.rawCtx;
    const envGain = ctx.createGain();
    envGain.connect(this.outputGain);

    const oscillators: OscillatorNode[] = [];
    const pitchedOscs: { osc: OscillatorNode; baseDetune: number }[] = [];
    const bufferSources: AudioBufferSourceNode[] = [];
    const extraNodes: AudioNode[] = [];

    const attack = Math.max(0.005, this.envOptions.attack ?? 0.015);
    const decay = Math.max(0.015, this.envOptions.decay ?? 0.3);
    const sustain = Math.max(0.001, Math.min(1, this.envOptions.sustain ?? 0.6));
    const release = Math.max(0.02, this.envOptions.release ?? 0.5);

    // 3. Optional Per-Voice Resonant Filter + Filter Envelope
    let voiceDest: AudioNode = envGain;
    let filterNode: BiquadFilterNode | undefined;
    if (this.filterOptions && this.filterOptions.enabled) {
      const flt = ctx.createBiquadFilter();
      flt.type = this.filterOptions.type || 'lowpass';
      const baseCutoff = Math.max(60, Math.min(16000, this.filterOptions.cutoffHz || 2400));
      const resQ = Math.max(0.3, Math.min(15, this.filterOptions.resonanceQ ?? 1.0));
      const envAmt = this.filterOptions.envAmountHz ?? 0;
      const envDec = Math.max(0.02, this.filterOptions.envDecay ?? 0.25);

      flt.Q.setValueAtTime(resQ, startTime);
      if (Math.abs(envAmt) > 10) {
        const peakCutoff = Math.max(60, Math.min(16000, baseCutoff + envAmt));
        const sweepStart = startTime + Math.min(0.08, attack * 0.45);
        flt.frequency.setValueAtTime(peakCutoff, startTime);
        flt.frequency.linearRampToValueAtTime(peakCutoff, sweepStart);
        flt.frequency.setTargetAtTime(baseCutoff, sweepStart, envDec / 2.8);
      } else {
        flt.frequency.setValueAtTime(baseCutoff, startTime);
      }

      flt.connect(envGain);
      extraNodes.push(flt);
      voiceDest = flt;
      filterNode = flt;
    }

    // 4. Primary Oscillator (Basic, Fat Unison, or 2-Op FM)
    const oscType: string = this.oscOptions.type || 'sine';
    let voiceScale = 0.32;

    if (oscType.startsWith('fat')) {
      const baseType = (oscType.replace('fat', '') || 'sawtooth') as OscillatorType;
      const count = Math.min(3, Math.max(1, this.oscOptions.count || 2));
      const spread = this.oscOptions.spread ?? 14;
      voiceScale = count === 3 ? 0.16 : count === 2 ? 0.21 : 0.3;

      for (let c = 0; c < count; c++) {
        const osc = ctx.createOscillator();
        osc.type = baseType;
        osc.frequency.setValueAtTime(freqHz, startTime);
        const detuneCents = count > 1 ? (c / (count - 1) - 0.5) * spread : 0;
        osc.detune.setValueAtTime(detuneCents, startTime);
        osc.connect(voiceDest);
        oscillators.push(osc);
        pitchedOscs.push({ osc, baseDetune: detuneCents });
      }
    } else if (oscType.startsWith('fm')) {
      const carrierType = (oscType.replace('fm', '') || 'sine') as OscillatorType;
      const harmonicity = this.oscOptions.harmonicity ?? 1;
      const modIndex = this.oscOptions.modulationIndex ?? 2;
      voiceScale = 0.32;

      const carrier = ctx.createOscillator();
      carrier.type = carrierType;
      carrier.frequency.setValueAtTime(freqHz, startTime);

      const modulator = ctx.createOscillator();
      modulator.type = 'sine';
      modulator.frequency.setValueAtTime(freqHz * harmonicity, startTime);

      const modGain = ctx.createGain();
      const peakMod = freqHz * modIndex * 0.45;
      modGain.gain.setValueAtTime(peakMod, startTime);
      // Slight natural FM index decay for realistic electric pianos/bells/plucks
      modGain.gain.setTargetAtTime(peakMod * 0.35, startTime + 0.01, 0.25);

      modulator.connect(modGain);
      modGain.connect(carrier.frequency);
      carrier.connect(voiceDest);

      oscillators.push(carrier, modulator);
      pitchedOscs.push({ osc: carrier, baseDetune: 0 }, { osc: modulator, baseDetune: 0 });
      extraNodes.push(modGain);
    } else {
      const basicType = (
        ['sine', 'triangle', 'sawtooth', 'square'].includes(oscType) ? oscType : 'sine'
      ) as OscillatorType;
      voiceScale = basicType === 'sine' ? 0.38 : 0.28;

      const osc = ctx.createOscillator();
      osc.type = basicType;
      osc.frequency.setValueAtTime(freqHz, startTime);
      osc.connect(voiceDest);
      oscillators.push(osc);
      pitchedOscs.push({ osc, baseDetune: 0 });
    }

    // 5. Sub-Oscillator Layer (-1 or -2 octaves) — Unison-compensated for deep, chest-hitting presence
    let subGainNode: GainNode | undefined;
    if (this.subOscOptions && this.subOscOptions.enabled && this.subOscOptions.mix > 0.005) {
      const subOct = this.subOscOptions.octaveOffset === -2 ? 0.25 : 0.5;
      const subFreq = Math.max(24, freqHz * subOct);
      const subOsc = ctx.createOscillator();
      subOsc.type = this.subOscOptions.type || 'sine';
      subOsc.frequency.setValueAtTime(subFreq, startTime);

      // Compensate for unison voiceScale attenuation so sub-oscillator stays equally powerful on 3x SuperSaws
      const unisonComp = 0.32 / Math.max(0.12, voiceScale);
      const subGain = ctx.createGain();
      const subTargetGain = Math.min(2.2, this.subOscOptions.mix * 1.45 * unisonComp);
      subGain.gain.setValueAtTime(subTargetGain, startTime);
      subOsc.connect(subGain);
      // Route sub into envGain directly if filter is highpass/bandpass so sub bass is never thinned out
      const subTargetDest =
        this.filterOptions &&
        this.filterOptions.enabled &&
        this.filterOptions.type !== 'lowpass'
          ? envGain
          : voiceDest;
      subGain.connect(subTargetDest);

      oscillators.push(subOsc);
      pitchedOscs.push({ osc: subOsc, baseDetune: 0 });
      extraNodes.push(subGain);
      subGainNode = subGain;
    }

    // 6. Transient Hammer / Breath Noise Layer — Independent envelope so slow pad attacks or dark filters never mute the burst
    let noiseGainNode: GainNode | undefined;
    if (this.noiseOptions && this.noiseOptions.enabled && this.noiseOptions.mix > 0.005) {
      const noiseType = this.noiseOptions.type || 'pink';
      const noiseBuf = getSharedNoiseBuffer(ctx, noiseType);
      const noiseSrc = ctx.createBufferSource();
      noiseSrc.buffer = noiseBuf;
      noiseSrc.loop = true;

      const noiseGain = ctx.createGain();
      const nPeak = Math.min(0.75, this.noiseOptions.mix * 0.68 * velocity);
      const nDecay = Math.max(0.015, this.noiseOptions.decay || 0.05);

      noiseGain.gain.setValueAtTime(0.0001, startTime);
      noiseGain.gain.linearRampToValueAtTime(nPeak, startTime + 0.003);
      noiseGain.gain.setTargetAtTime(0.0001, startTime + 0.004, nDecay / 2.2);

      noiseSrc.connect(noiseGain);
      noiseGain.connect(this.outputGain);

      bufferSources.push(noiseSrc);
      extraNodes.push(noiseGain);
      noiseGainNode = noiseGain;
    }

    // 7. Pitch Envelope (for 808 punch, koto bends, laser sweeps, brass blips)
    if (
      this.pitchEnvOptions &&
      this.pitchEnvOptions.enabled &&
      Math.abs(this.pitchEnvOptions.semitones) > 0.05
    ) {
      const startCents = this.pitchEnvOptions.semitones * 100;
      const pDecay = Math.max(0.01, this.pitchEnvOptions.decay || 0.06);
      for (let i = 0; i < pitchedOscs.length; i++) {
        const { osc, baseDetune } = pitchedOscs[i];
        osc.detune.setValueAtTime(baseDetune + startCents, startTime);
        osc.detune.setTargetAtTime(baseDetune, startTime + 0.003, pDecay / 2.6);
      }
    }

    // 8. Vibrato LFO (always created when vibrato config exists so live tweaking works on held notes)
    let lfoOscNode: OscillatorNode | undefined;
    let lfoGainNode: GainNode | undefined;
    if (
      this.vibratoOptions &&
      this.vibratoOptions.enabled &&
      this.vibratoOptions.depthCents > 0.5
    ) {
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(
        Math.max(0.3, Math.min(14, this.vibratoOptions.rateHz || 4.5)),
        startTime
      );
      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(
        Math.min(80, this.vibratoOptions.depthCents),
        startTime
      );
      lfo.connect(lfoGain);
      for (let i = 0; i < pitchedOscs.length; i++) {
        lfoGain.connect(pitchedOscs[i].osc.detune);
      }
      oscillators.push(lfo);
      extraNodes.push(lfoGain);
      lfoOscNode = lfo;
      lfoGainNode = lfoGain;
    }

    // 9. Amplitude ADSR Envelope
    const peakGain = Math.max(0.001, velocity * voiceScale);

    envGain.gain.setValueAtTime(0.0001, startTime);
    envGain.gain.linearRampToValueAtTime(peakGain, startTime + attack);
    envGain.gain.setTargetAtTime(
      Math.max(0.0001, peakGain * sustain),
      startTime + attack,
      decay / 3
    );

    const voiceRecord: ActiveSynthVoice = {
      key,
      oscillators,
      bufferSources,
      extraNodes,
      envGain,
      noiseGain: noiseGainNode,
      subGain: subGainNode,
      filterNode,
      lfoOsc: lfoOscNode,
      lfoGain: lfoGainNode,
      voiceScale,
      startTime,
      peakGain,
      sustainLevel: sustain,
      attack,
      decay,
      release,
      released: false,
      isDisposed: false,
      cleanup: () => {
        if (voiceRecord.isDisposed) return;
        voiceRecord.isDisposed = true;
        const idx = this.activeVoices.indexOf(voiceRecord);
        if (idx !== -1) this.activeVoices.splice(idx, 1);
        for (let j = 0; j < oscillators.length; j++) {
          try {
            oscillators[j].onended = null;
            oscillators[j].disconnect();
          } catch {}
        }
        for (let j = 0; j < bufferSources.length; j++) {
          try {
            bufferSources[j].disconnect();
          } catch {}
        }
        for (let j = 0; j < extraNodes.length; j++) {
          try {
            extraNodes[j].disconnect();
          } catch {}
        }
        try {
          envGain.disconnect();
        } catch {}
      },
    };

    if (oscillators[0]) {
      oscillators[0].onended = voiceRecord.cleanup;
    }

    for (let j = 0; j < oscillators.length; j++) {
      oscillators[j].start(startTime);
    }
    for (let j = 0; j < bufferSources.length; j++) {
      const randomOffset = Math.random() * 0.8;
      bufferSources[j].start(startTime, randomOffset);
    }

    this.activeVoices.push(voiceRecord);
    return voiceRecord;
  }

  private releaseVoice(voice: ActiveSynthVoice, relTime: number, releaseDuration: number) {
    if (voice.isDisposed) return;
    voice.released = true;

    const effectiveRelTime = Math.max(this.rawCtx.currentTime, voice.startTime + 0.004, relTime);
    const dur = Math.max(0.008, releaseDuration);
    const param = voice.envGain.gain;

    try {
      if (typeof (param as any).cancelAndHoldAtTime === 'function') {
        (param as any).cancelAndHoldAtTime(effectiveRelTime);
      } else {
        param.cancelScheduledValues(effectiveRelTime);
        param.setValueAtTime(Math.max(0.0001, param.value), effectiveRelTime);
      }
      param.setTargetAtTime(0.0001, effectiveRelTime, dur / 3.2);
      param.linearRampToValueAtTime(0.0001, effectiveRelTime + dur);
    } catch {}

    if (voice.noiseGain) {
      const nParam = voice.noiseGain.gain;
      const nFade = Math.min(0.12, dur);
      try {
        if (typeof (nParam as any).cancelAndHoldAtTime === 'function') {
          (nParam as any).cancelAndHoldAtTime(effectiveRelTime);
        } else {
          nParam.cancelScheduledValues(effectiveRelTime);
          nParam.setValueAtTime(Math.max(0.0001, nParam.value), effectiveRelTime);
        }
        nParam.linearRampToValueAtTime(0.0001, effectiveRelTime + nFade);
      } catch {}
    }

    const stopTime = effectiveRelTime + dur + 0.015;
    for (let i = 0; i < voice.oscillators.length; i++) {
      try {
        voice.oscillators[i].stop(stopTime);
      } catch {}
    }
    for (let i = 0; i < voice.bufferSources.length; i++) {
      try {
        voice.bufferSources[i].stop(stopTime);
      } catch {}
    }
  }

  public dispose() {
    this.releaseAll();
    try {
      this.outputGain.disconnect();
    } catch {}
  }
}

interface ActiveSampleSource {
  midiKey: number;
  source: AudioBufferSourceNode;
  gainNode: GainNode;
  startTime: number;
  released: boolean;
}

/**
 * Zero-Idle-Node Native Web Audio Pitch-Shifting Sample Player.
 * Replaces 30 heavy Tone.Sampler instances with an instant, zero-leak buffer player.
 */
export class DirectSamplePlayer {
  public attack: number = 0.005;
  public release: number = 0.4;
  public loaded: boolean = true;

  private rawCtx: AudioContext;
  private buffer: AudioBuffer;
  private anchorMidi: number;
  private destination: AudioNode;
  private activeSources: ActiveSampleSource[] = [];

  constructor(
    rawCtx: AudioContext,
    buffer: AudioBuffer,
    anchorNote: string,
    destination: AudioNode,
    attack = 0.005,
    release = 0.4
  ) {
    this.rawCtx = rawCtx;
    this.buffer = buffer;
    this.anchorMidi = noteToMidiFast(anchorNote);
    this.destination = destination;
    this.attack = attack;
    this.release = release;
  }

  public updateConfig(buffer: AudioBuffer, anchorNote: string) {
    this.buffer = buffer;
    this.anchorMidi = noteToMidiFast(anchorNote);
  }

  public triggerAttack(notes: (string | number) | (string | number)[], time?: number, velocity = 1) {
    const noteArr = Array.isArray(notes) ? notes : [notes];
    const startTime = Math.max(this.rawCtx.currentTime, time ?? this.rawCtx.currentTime);

    for (let i = 0; i < noteArr.length; i++) {
      this.startSample(noteArr[i], startTime, velocity);
    }
    return this;
  }

  public triggerRelease(notes: (string | number) | (string | number)[], time?: number) {
    const noteArr = Array.isArray(notes) ? notes : [notes];
    const relTime = Math.max(this.rawCtx.currentTime, time ?? this.rawCtx.currentTime);

    for (let i = 0; i < noteArr.length; i++) {
      const midiKey = Math.round(noteToMidiFast(noteArr[i]));
      for (let j = 0; j < this.activeSources.length; j++) {
        const s = this.activeSources[j];
        if (s.midiKey === midiKey && !s.released) {
          this.stopSampleSource(s, relTime, this.release);
        }
      }
    }
    return this;
  }

  public triggerAttackRelease(
    notes: (string | number) | (string | number)[],
    duration: number | string,
    time?: number,
    velocity = 1
  ) {
    const startTime = Math.max(this.rawCtx.currentTime, time ?? this.rawCtx.currentTime);
    const durSec = typeof duration === 'number' ? duration : Tone.Time(duration).toSeconds();
    const noteArr = Array.isArray(notes) ? notes : [notes];

    for (let i = 0; i < noteArr.length; i++) {
      const active = this.startSample(noteArr[i], startTime, velocity);
      if (active) {
        this.stopSampleSource(active, startTime + Math.max(0.02, durSec), Math.min(0.2, this.release));
      }
    }
    return this;
  }

  public releaseAll(time?: number) {
    const relTime = Math.max(this.rawCtx.currentTime, time ?? this.rawCtx.currentTime);
    for (let i = 0; i < this.activeSources.length; i++) {
      const s = this.activeSources[i];
      if (!s.released) {
        this.stopSampleSource(s, relTime, 0.04);
      }
    }
    return this;
  }

  private startSample(
    note: string | number,
    startTime: number,
    velocity: number
  ): ActiveSampleSource | null {
    if (!this.buffer) return null;
    const midiFloat = noteToMidiFast(note);
    const midiKey = Math.round(midiFloat);

    for (let i = 0; i < this.activeSources.length; i++) {
      const existing = this.activeSources[i];
      if (existing.midiKey === midiKey && !existing.released) {
        this.stopSampleSource(existing, startTime, 0.008);
      }
    }

    while (this.activeSources.length >= 6) {
      const oldest = this.activeSources.shift();
      if (oldest) {
        this.stopSampleSource(oldest, startTime, 0.008);
      }
    }

    const pitchMode = SamplerEngine.getInstance().voicePitchMode;
    let semitoneShift = midiFloat - this.anchorMidi;
    if (pitchMode === 'original') {
      semitoneShift = 0;
    } else if (pitchMode === 'natural' || pitchMode === 'subtle') {
      // Fold by whole octaves (12 semitones) into the natural vocal sweet spot [-5, +7] semitones
      // so high-row keys [Q-P] stay 100% intelligible and in-key without chipmunk speed-up
      while (semitoneShift > 7) {
        semitoneShift -= 12;
      }
      while (semitoneShift < -5) {
        semitoneShift += 12;
      }
      if (pitchMode === 'subtle') {
        semitoneShift *= 0.5;
      }
    }

    const playbackRate = Math.max(0.15, Math.min(6.0, Math.pow(2, semitoneShift / 12)));
    const source = this.rawCtx.createBufferSource();
    source.buffer = this.buffer;
    source.playbackRate.setValueAtTime(playbackRate, startTime);

    const gainNode = this.rawCtx.createGain();
    const att = Math.max(0.004, this.attack);
    const peak = Math.max(0.001, velocity * 0.85);
    gainNode.gain.setValueAtTime(0.0001, startTime);
    gainNode.gain.linearRampToValueAtTime(peak, startTime + att);

    source.connect(gainNode);
    gainNode.connect(this.destination);

    const record: ActiveSampleSource = {
      midiKey,
      source,
      gainNode,
      startTime,
      released: false,
    };

    source.onended = () => {
      const idx = this.activeSources.indexOf(record);
      if (idx !== -1) this.activeSources.splice(idx, 1);
      try {
        source.disconnect();
        gainNode.disconnect();
      } catch {}
    };

    const naturalDuration = this.buffer.duration / playbackRate;
    source.start(startTime, 0, naturalDuration);
    this.activeSources.push(record);
    return record;
  }

  private stopSampleSource(record: ActiveSampleSource, relTime: number, fadeDuration: number) {
    if (record.released) return;
    record.released = true;

    const effectiveTime = Math.max(this.rawCtx.currentTime, record.startTime + 0.003, relTime);
    const fade = Math.max(0.006, fadeDuration);
    const param = record.gainNode.gain;

    try {
      if (typeof (param as any).cancelAndHoldAtTime === 'function') {
        (param as any).cancelAndHoldAtTime(effectiveTime);
      } else {
        param.cancelScheduledValues(effectiveTime);
        param.setValueAtTime(Math.max(0.0001, param.value), effectiveTime);
      }
      param.linearRampToValueAtTime(0.0001, effectiveTime + fade);
      record.source.stop(effectiveTime + fade + 0.01);
    } catch {}
  }

  public dispose() {
    this.releaseAll();
  }
}

export class SynthEngine {
  private static instance: SynthEngine | null = null;
  public isReady: boolean = false;

  // PolySynths (Native zero-leak Web Audio engines with full Tone.PolySynth API compatibility)
  public liveSynth!: NativePolySynth & any;
  public trackSynths: (NativePolySynth & any)[] = [];
  public trackVolumes: Tone.Volume[] = [];
  private trackNativeInputs: GainNode[] = [];
  private masterFilterNativeInput!: GainNode;
  public currentPreset: PresetConfig = PRESETS[0];

  // Auto-Pitch Multi-Voice Samplers (Zero-idle-node DirectSamplePlayer pool + 4 Tracks)
  public liveSampler: DirectSamplePlayer | null = null;
  public liveSamplers: Map<string, DirectSamplePlayer> = new Map();
  public liveSamplerFineCentsMap: Map<string, number> = new Map();
  public liveSamplerOctaveShiftMap: Map<string, number> = new Map();

  public trackSamplers: (DirectSamplePlayer | null)[] = [null, null, null, null];
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

  public async init(): Promise<void> {
    if (this.isReady) return;

    await Tone.start();
    Tone.context.lookAhead = 0.05;

    const rawCtx = Tone.getContext().rawContext as AudioContext;

    this.limiter = new Tone.Limiter(-1).toDestination();
    this.masterBus = new Tone.Volume(0).connect(this.limiter);

    this.reverb = new Tone.Reverb({
      decay: 1.1,
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

    this.masterFilter = new Tone.Filter({
      frequency: 4500,
      type: 'lowpass',
      rolloff: -12,
      Q: 0.7,
    }).connect(this.delay);

    this.masterFilterNativeInput = rawCtx.createGain();
    this.masterFilterNativeInput.gain.value = 1;
    Tone.connect(this.masterFilterNativeInput, this.masterFilter);

    this.analyser = new Tone.Analyser('waveform', 512);
    Tone.Destination.connect(this.analyser);

    this.recorder = new Tone.Recorder();
    Tone.Destination.connect(this.recorder);

    this.liveSynth = new NativePolySynth(rawCtx, 16, -6);
    this.applyPresetToSynth(this.liveSynth, this.currentPreset);
    this.liveSynth.connect(this.masterFilterNativeInput);

    for (let i = 0; i < 4; i++) {
      const vol = new Tone.Volume(-6).connect(this.masterFilter);
      const nativeTrackIn = rawCtx.createGain();
      nativeTrackIn.gain.value = 1;
      Tone.connect(nativeTrackIn, vol);

      const synth = new NativePolySynth(rawCtx, 10, -6);
      this.applyPresetToSynth(synth, this.currentPreset);
      synth.connect(nativeTrackIn);

      this.trackVolumes.push(vol);
      this.trackNativeInputs.push(nativeTrackIn);
      this.trackSynths.push(synth);
    }

    this.isReady = true;

    this.applyFilterMacro();
    this.applySpaceMacro();
    this.applyEchoMacro();
    this.applySnapMacro();
  }

  public syncVoices(voices: RegisteredVoice[]) {
    if (!this.isReady) return;
    const rawCtx = Tone.getContext().rawContext as AudioContext;

    const currentVoiceIds = new Set(voices.map((v) => v.id));

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

    const snapNorm = this.macros.snap / 100;
    const attack = 0.005 + (1 - snapNorm) * 0.025;
    const release = 0.2 + (1 - snapNorm) * 1.3;

    for (const voice of voices) {
      const anchorNote =
        voice.rootNoteOverride ||
        (voice.autoPitchEnabled ? voice.analysis.detectedNote : 'C4');
      const fineCents = voice.autoPitchEnabled ? voice.analysis.centsCorrection : 0;
      this.liveSamplerFineCentsMap.set(voice.id, fineCents);
      this.liveSamplerOctaveShiftMap.set(voice.id, voice.octaveShift);

      const existing = this.liveSamplers.get(voice.id);
      if (existing) {
        existing.updateConfig(voice.analysis.trimmedBuffer, anchorNote);
        existing.attack = attack;
        existing.release = release;
      } else {
        const player = new DirectSamplePlayer(
          rawCtx,
          voice.analysis.trimmedBuffer,
          anchorNote,
          this.masterFilterNativeInput,
          attack,
          release
        );
        this.liveSamplers.set(voice.id, player);
      }
    }

    if (voices[0]) {
      this.liveSampler = this.liveSamplers.get(voices[0].id) || null;
      this.liveSamplerFineCents = this.liveSamplerFineCentsMap.get(voices[0].id) || 0;
      this.liveSamplerOctaveShift = this.liveSamplerOctaveShiftMap.get(voices[0].id) || 0;
    }
  }

  public loadUserSample(sampleData: CustomSampleData) {
    if (!this.isReady) return;
    const rawCtx = Tone.getContext().rawContext as AudioContext;

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
      } catch {}
    }

    this.liveSampler = new DirectSamplePlayer(
      rawCtx,
      sampleData.analysis.trimmedBuffer,
      anchorNote,
      this.masterFilterNativeInput,
      0.005,
      0.4
    );
  }

  public lockUserSampleToTrack(trackIndex: number) {
    const sampleData = SamplerEngine.getInstance().currentSample;
    if (!sampleData || !this.trackNativeInputs[trackIndex]) return;
    const rawCtx = Tone.getContext().rawContext as AudioContext;

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
      } catch {}
    }

    this.trackSamplers[trackIndex] = new DirectSamplePlayer(
      rawCtx,
      sampleData.analysis.trimmedBuffer,
      anchorNote,
      this.trackNativeInputs[trackIndex],
      0.005,
      0.4
    );
  }

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

  public previewUserSample() {
    const voice = SamplerEngine.getInstance().currentSample;
    if (voice) {
      this.previewVoice(voice);
    }
  }

  /**
   * Applies full multi-layer preset configuration onto a target NativePolySynth.
   */
  public applyPresetToSynth(synth: NativePolySynth, preset: PresetConfig) {
    try {
      synth.appliedPresetId = preset.id;
      synth.set({
        oscillator: preset.synthOptions.oscillator,
        envelope: preset.synthOptions.envelope,
        subOsc: preset.synthOptions.subOsc,
        noise: preset.synthOptions.noise,
        filter: preset.synthOptions.filter,
        pitchEnv: preset.synthOptions.pitchEnv,
        vibrato: preset.synthOptions.vibrato,
      });
    } catch (e) {
      console.warn('Error applying preset to synth:', e);
    }
  }

  /**
   * Sets the live synth instrument preset (or updates parameters live from Synth Lab).
   */
  public setLivePreset(preset: PresetConfig, releaseActive = true) {
    this.currentPreset = preset;
    if (this.isReady && this.liveSynth && !preset.isSamplerVoice) {
      if (releaseActive) {
        try {
          this.liveSynth.releaseAll();
        } catch {}
      }
      this.applyPresetToSynth(this.liveSynth, preset);
      this.applySnapMacro();
    }
  }

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

  public triggerTrackEvent(
    trackIndex: number,
    rawNotes: string[],
    durationSeconds: number,
    time: number,
    preset: PresetConfig,
    code?: string
  ) {
    if (preset.isSamplerVoice) {
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
      this.applyPresetToSynth(synth, preset);
      const transposed = this.transposeNotes(rawNotes, preset.octaveOffset);
      try {
        synth.triggerAttackRelease(transposed, durationSeconds, time);
      } catch (err) {
        console.warn('Track synth trigger error', err);
      }
    }
  }

  public setTrackVolume(trackIndex: number, volumeDb: number, muted: boolean = false) {
    if (!this.trackVolumes[trackIndex]) return;
    if (muted) {
      this.trackVolumes[trackIndex].volume.rampTo(-Infinity, 0.05);
    } else {
      this.trackVolumes[trackIndex].volume.rampTo(volumeDb, 0.05);
    }
  }

  public transposeNotes(notes: string[], octaveOffset: number): string[] {
    if (octaveOffset === 0) return notes;
    const out = new Array<string>(notes.length);
    for (let i = 0; i < notes.length; i++) {
      out[i] = transposeNoteFast(notes[i], octaveOffset);
    }
    return out;
  }

  public transposeAndFineTuneNotes(
    notes: string[],
    octaveOffset: number,
    fineCents: number
  ): any[] {
    const semitoneShift = octaveOffset * 12 + fineCents / 100;
    if (Math.abs(semitoneShift) < 0.001) return notes;
    const ratio = Math.pow(2, semitoneShift / 12);
    const out = new Array<number>(notes.length);
    for (let i = 0; i < notes.length; i++) {
      out[i] = noteToHzFast(notes[i]) * ratio;
    }
    return out;
  }

  public triggerLiveAttack(code: string, rawNotes: string[]) {
    if (!this.isReady) return;

    if (this.activeCodeNotes.has(code)) {
      this.triggerLiveRelease(code);
    }

    const now = Tone.now();

    if (this.currentPreset.isSamplerVoice) {
      const voice = SamplerEngine.getInstance().getVoiceForKey(code);
      if (!voice) {
        return;
      }

      const sampler = this.liveSamplers.get(voice.id) || this.liveSampler;
      if (!sampler) return;

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
    if (this.liveSynth.appliedPresetId !== this.currentPreset.id) {
      this.applyPresetToSynth(this.liveSynth, this.currentPreset);
      this.applySnapMacro();
    }
    const notes = this.transposeNotes(rawNotes, this.currentPreset.octaveOffset);
    this.activeCodeNotes.set(code, { notes, usedSampler: false });
    try {
      this.liveSynth.triggerAttack(notes, now);
    } catch (err) {
      console.warn('Synth triggerAttack error', err);
    }
  }

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
    } catch {}
    this.activeCodeNotes.clear();
  }

  public setMacro(key: keyof MacroControls, val: number) {
    const clamped = Math.max(0, Math.min(100, val));
    if (this.macros[key] === clamped) return;
    this.macros[key] = clamped;

    if (!this.isReady) return;
    switch (key) {
      case 'warmth':
        this.applyFilterMacro();
        break;
      case 'space':
        this.applySpaceMacro();
        break;
      case 'echo':
        this.applyEchoMacro();
        break;
      case 'snap':
        this.applySnapMacro();
        break;
    }
  }

  public setXYMood(x: number, y: number) {
    const newWarmth = Math.max(0, Math.min(100, x));
    const newSpace = Math.max(0, Math.min(100, y));
    const warmthChanged = this.macros.warmth !== newWarmth;
    const spaceChanged = this.macros.space !== newSpace;
    this.macros.warmth = newWarmth;
    this.macros.space = newSpace;

    if (!this.isReady) return;
    if (warmthChanged) this.applyFilterMacro();
    if (spaceChanged) this.applySpaceMacro();
  }

  private applyFilterMacro() {
    const warmthNorm = this.macros.warmth / 100;
    const minFreq = 250;
    const maxFreq = 9000;
    const filterFreq = minFreq * Math.pow(maxFreq / minFreq, warmthNorm);
    this.masterFilter.frequency.rampTo(filterFreq, 0.04);
  }

  private applySpaceMacro() {
    const spaceNorm = this.macros.space / 100;
    const reverbWet = 0.05 + spaceNorm * 0.75;
    this.reverb.wet.rampTo(reverbWet, 0.04);
  }

  private applyEchoMacro() {
    const echoNorm = this.macros.echo / 100;
    const delayWet = echoNorm * 0.55;
    const delayFb = 0.1 + echoNorm * 0.5;
    this.delay.wet.rampTo(delayWet, 0.04);
    this.delay.feedback.rampTo(delayFb, 0.04);
  }

  /**
   * Relative Preset Macro Scaling (v2.6):
   * At default SNAP = 40%, multiplier is 1.0x so every preset keeps its exact crafted ADSR contour.
   * Higher SNAP tightens attack/decay/release proportionally; lower SNAP softens and lengthens them.
   */
  private applySnapMacro() {
    // At snap=40 -> envMult = 1.0; at snap=100 -> envMult = 0.3; at snap=0 -> envMult = 1.46
    const envMult = Math.max(0.25, 1.0 + ((40 - this.macros.snap) / 60) * 0.7);
    const presetEnv = this.currentPreset.synthOptions.envelope;

    const scaledAttack = Math.max(0.005, presetEnv.attack * envMult);
    const scaledDecay = Math.max(0.03, presetEnv.decay * (0.45 + 0.55 * envMult));
    const scaledRelease = Math.max(0.05, presetEnv.release * (0.4 + 0.6 * envMult));

    this.liveSynth.set({
      envelope: {
        attack: scaledAttack,
        decay: scaledDecay,
        sustain: presetEnv.sustain,
        release: scaledRelease,
      },
    });

    const samplerAttack = 0.005 + (1 - this.macros.snap / 100) * 0.025;
    const samplerRelease = 0.2 + (1 - this.macros.snap / 100) * 1.3;
    if (this.liveSampler) {
      this.liveSampler.attack = samplerAttack;
      this.liveSampler.release = samplerRelease;
    }
    for (const sampler of this.liveSamplers.values()) {
      sampler.attack = samplerAttack;
      sampler.release = samplerRelease;
    }
  }

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
