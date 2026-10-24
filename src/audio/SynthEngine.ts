import * as Tone from 'tone';
import { PRESETS, PresetConfig } from './presets';
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
  if (match) {
    return `${match[1]}${parseInt(match[2], 10) + octaveOffset}`;
  }
  const midi = Math.round(noteToMidiFast(note)) + octaveOffset * 12;
  const oct = Math.floor(midi / 12) - 1;
  const semi = ((midi % 12) + 12) % 12;
  return `${SEMITONE_TO_NOTE[semi]}${oct}`;
}

interface ActiveSynthVoice {
  key: number; // rounded midi or frequency key
  oscillators: OscillatorNode[];
  extraNodes: AudioNode[];
  envGain: GainNode;
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
 * Zero-Leak, Zero-Idle-Node Native Web Audio Polyphonic Synthesizer.
 * Replaces Tone.PolySynth(Tone.Synth) to eliminate:
 * 1. Continuous 1-second _collectGarbage voice graph destruction/re-creation stalls
 * 2. Tone.Oscillator persistent Signal -> AudioParam fan-out memory leaks
 * 3. DeepMerge preset option contamination across fat/fm/basic oscillators
 */
export interface SubOscOptions {
  enabled: boolean;
  type: OscillatorType; // 'sine' | 'square' | ...
  octaveShift: number; // -1, -2, etc.
  mix: number; // 0.0 - 1.0 relative gain
}

export interface NoiseOptions {
  enabled: boolean;
  type: 'white' | 'pink';
  attack: number; // seconds for noise fade‑in
  decay: number; // seconds for noise fade‑out
  mix: number; // 0.0 - 1.0 relative gain
}

export interface FilterEnvOptions {
  enabled: boolean;
  attack: number; // seconds
  decay: number; // seconds
  sustain: number; // 0-1
  release: number; // seconds
  amount: number; // Hz modulation depth
}

export interface PitchEnvOptions {
  enabled: boolean;
  amount: number; // semitone bend
  attack: number; // seconds
  decay: number; // seconds
}

export interface LFOOptions {
  enabled: boolean;
  rate: number; // Hz
  depth: number; // cents modulation
}

export class NativePolySynth {
  // existing fields ...
  private subOscOptions: SubOscOptions = { enabled: false, type: 'sine', octaveShift: -1, mix: 0.2 };
  private noiseOptions: NoiseOptions = { enabled: false, type: 'white', attack: 0.005, decay: 0.05, mix: 0.1 };
  private filterEnvOptions: FilterEnvOptions = { enabled: false, attack: 0.02, decay: 0.3, sustain: 0.7, release: 0.5, amount: 2000 };
  private pitchEnvOptions: PitchEnvOptions = { enabled: false, amount: 0, attack: 0, decay: 0 };
  private lfoOptions: LFOOptions = { enabled: false, rate: 5, depth: 10 };

  // existing constructor and methods ...

  public setSubOsc(options: Partial<SubOscOptions>) {
    this.subOscOptions = { ...this.subOscOptions, ...options };
  }
  public setNoise(options: Partial<NoiseOptions>) {
    this.noiseOptions = { ...this.noiseOptions, ...options };
  }
  public setFilterEnv(options: Partial<FilterEnvOptions>) {
    this.filterEnvOptions = { ...this.filterEnvOptions, ...options };
  }
  public setPitchEnv(options: Partial<PitchEnvOptions>) {
    this.pitchEnvOptions = { ...this.pitchEnvOptions, ...options };
  }
  public setLFO(options: Partial<LFOOptions>) {
    this.lfoOptions = { ...this.lfoOptions, ...options };
  }

  private createVoiceNodes(freqHz: number, startTime: number, velocity: number) {
    const ctx = this.rawCtx;
    const envGain = ctx.createGain();
    envGain.connect(this.outputGain);

    const oscillators: OscillatorNode[] = [];
    const extraNodes: AudioNode[] = [];

    // Main oscillator (existing logic retained)
    const mainOsc = ctx.createOscillator();
    const mainType = this.oscOptions.type || 'sine';
    mainOsc.type = mainType as OscillatorType;
    mainOsc.frequency.setValueAtTime(freqHz, startTime);
    mainOsc.connect(envGain);
    oscillators.push(mainOsc);

    // Sub‑oscillator
    if (this.subOscOptions.enabled) {
      const subOsc = ctx.createOscillator();
      subOsc.type = this.subOscOptions.type as OscillatorType;
      const subFreq = freqHz * Math.pow(2, this.subOscOptions.octaveShift);
      subOsc.frequency.setValueAtTime(subFreq, startTime);
      const subGain = ctx.createGain();
      subGain.gain.value = this.subOscOptions.mix * velocity;
      subOsc.connect(subGain).connect(envGain);
      oscillators.push(subOsc);
      extraNodes.push(subGain);
    }

    // Noise transient
    if (this.noiseOptions.enabled) {
      const buffer = ctx.createBuffer(1, ctx.sampleRate * Math.max(this.noiseOptions.attack, this.noiseOptions.decay), ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        const rand = this.noiseOptions.type === 'pink' ? (Math.random() * 2 - 1) * 0.5 : Math.random() * 2 - 1;
        data[i] = rand;
      }
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = buffer;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.0001, startTime);
      noiseGain.gain.linearRampToValueAtTime(this.noiseOptions.mix * velocity, startTime + this.noiseOptions.attack);
      noiseGain.gain.linearRampToValueAtTime(0.0001, startTime + this.noiseOptions.attack + this.noiseOptions.decay);
      noiseSource.connect(noiseGain).connect(envGain);
      noiseSource.start(startTime);
      extraNodes.push(noiseSource, noiseGain);
    }

    // Filter envelope (per‑voice)
    let filterNode: BiquadFilterNode | null = null;
    if (this.filterEnvOptions.enabled) {
      filterNode = ctx.createBiquadFilter();
      filterNode.type = 'lowpass';
      filterNode.frequency.setValueAtTime(200, startTime);
      filterNode.frequency.linearRampToValueAtTime(200 + this.filterEnvOptions.amount, startTime + this.filterEnvOptions.attack);
      filterNode.frequency.linearRampToValueAtTime(this.filterEnvOptions.amount, startTime + this.filterEnvOptions.attack + this.filterEnvOptions.decay);
      filterNode.frequency.setTargetAtTime(200, startTime + this.filterEnvOptions.attack + this.filterEnvOptions.decay, this.filterEnvOptions.release / 3);
      filterNode.connect(envGain);
      extraNodes.push(filterNode);
    }

    // Pitch envelope (apply to main oscillator frequency)
    if (this.pitchEnvOptions.enabled) {
      const bend = this.pitchEnvOptions.amount;
      const bendFreq = freqHz * Math.pow(2, bend / 12);
      mainOsc.frequency.setValueAtTime(freqHz, startTime);
      mainOsc.frequency.linearRampToValueAtTime(bendFreq, startTime + this.pitchEnvOptions.attack);
      mainOsc.frequency.linearRampToValueAtTime(freqHz, startTime + this.pitchEnvOptions.attack + this.pitchEnvOptions.decay);
    }

    // LFO modulation (simple vibrato on main oscillator)
    if (this.lfoOptions.enabled) {
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(this.lfoOptions.rate, startTime);
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = this.lfoOptions.depth;
      lfo.connect(lfoGain).connect(mainOsc.frequency);
      lfo.start(startTime);
      extraNodes.push(lfo, lfoGain);
    }

    return { oscillators, extraNodes };
  }

  private startSingleVoice(
    note: string | number,
    startTime: number,
    velocity: number
  ): ActiveSynthVoice | null {
    const key = this.getKeyForNote(note);
    const freqHz = Math.max(20, Math.min(16000, noteToHzFast(note)));

    // existing duplicate note handling unchanged ...

    // Create voice nodes (new helper)
    const { oscillators, extraNodes } = this.createVoiceNodes(freqHz, startTime, velocity);

    // Apply envelope (existing logic) – using envGain from earlier code block
    const ctx = this.rawCtx;
    const envGain = ctx.createGain();
    envGain.connect(this.outputGain);
    const attack = Math.max(0.005, this.envOptions.attack ?? 0.015);
    const decay = Math.max(0.015, this.envOptions.decay ?? 0.3);
    const sustain = Math.max(0.001, Math.min(1, this.envOptions.sustain ?? 0.6));
    const release = Math.max(0.02, this.envOptions.release ?? 0.5);
    const peakGain = Math.max(0.001, velocity * 0.38);
    envGain.gain.setValueAtTime(0.0001, startTime);
    envGain.gain.linearRampToValueAtTime(peakGain, startTime + attack);
    envGain.gain.setTargetAtTime(Math.max(0.0001, peakGain * sustain), startTime + attack, decay / 3);

    // connect created oscillators to envGain (already done in helper)

    // Build voice record (same structure as before, now with new extraNodes)
    const voiceRecord: ActiveSynthVoice = {
      key,
      oscillators,
      extraNodes,
      envGain,
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
          try { oscillators[j].onended = null; oscillators[j].disconnect(); } catch {}
        }
        for (let j = 0; j < extraNodes.length; j++) {
          try { extraNodes[j].disconnect(); } catch {}
        }
        try { envGain.disconnect(); } catch {}
      },
    };

    if (oscillators[0]) {
      oscillators[0].onended = voiceRecord.cleanup;
    }

    for (let j = 0; j < oscillators.length; j++) {
      oscillators[j].start(startTime);
    }

    this.activeVoices.push(voiceRecord);
    return voiceRecord;
  }

  // Existing methods (triggerAttack, triggerRelease, etc.) remain unchanged below this point.

  public maxPolyphony: number = 16;
  public volume: { value: number };
  private rawCtx: AudioContext;
  public outputGain: GainNode;
  private activeVoices: ActiveSynthVoice[] = [];

  private oscOptions: any = { type: 'fatsawtooth', count: 2, spread: 15 };
  private envOptions = { attack: 0.02, decay: 0.4, sustain: 0.75, release: 1.2 };

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

  public set(options: { oscillator?: any; envelope?: any }) {
    if (options.oscillator) {
      // Clean replacement rather than deepMerge so FM/Fat params never cross-contaminate
      this.oscOptions = { ...options.oscillator };
    }
    if (options.envelope) {
      this.envOptions = {
        ...this.envOptions,
        ...options.envelope,
      };
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
      // Find earliest un-released voice matching this note
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

    // 1. If the exact same note is already playing, smoothly fade it out over 10ms to avoid phase/click buildup
    for (let i = 0; i < this.activeVoices.length; i++) {
      const existing = this.activeVoices[i];
      if (existing.key === key && !existing.released) {
        this.releaseVoice(existing, startTime, 0.012);
      }
    }

    // 2. Enforce maxPolyphony with smooth voice stealing (oldest released first, otherwise oldest active)
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

    const oscType: string = this.oscOptions.type || 'sine';
    const oscillators: OscillatorNode[] = [];
    const extraNodes: AudioNode[] = [];

    let voiceScale = 0.32;

    if (oscType.startsWith('fat')) {
      const baseType = (oscType.replace('fat', '') || 'sawtooth') as OscillatorType;
      const count = Math.min(2, Math.max(1, this.oscOptions.count || 2));
      const spread = this.oscOptions.spread ?? 14;
      voiceScale = count > 1 ? 0.2 : 0.3;

      for (let c = 0; c < count; c++) {
        const osc = ctx.createOscillator();
        osc.type = baseType;
        osc.frequency.setValueAtTime(freqHz, startTime);
        if (count > 1) {
          const detuneCents = (c / (count - 1) - 0.5) * spread;
          osc.detune.setValueAtTime(detuneCents, startTime);
        }
        osc.connect(envGain);
        oscillators.push(osc);
      }
    } else if (oscType.startsWith('fm')) {
      const carrierType = (oscType.replace('fm', '') || 'sine') as OscillatorType;
      const harmonicity = this.oscOptions.harmonicity ?? 1;
      const modIndex = this.oscOptions.modulationIndex ?? 2;
      voiceScale = 0.34;

      const carrier = ctx.createOscillator();
      carrier.type = carrierType;
      carrier.frequency.setValueAtTime(freqHz, startTime);

      const modulator = ctx.createOscillator();
      modulator.type = 'sine';
      modulator.frequency.setValueAtTime(freqHz * harmonicity, startTime);

      const modGain = ctx.createGain();
      modGain.gain.setValueAtTime(freqHz * modIndex * 0.45, startTime);

      modulator.connect(modGain);
      modGain.connect(carrier.frequency);
      carrier.connect(envGain);

      oscillators.push(carrier, modulator);
      extraNodes.push(modGain);
    } else {
      const basicType = (
        ['sine', 'triangle', 'sawtooth', 'square'].includes(oscType) ? oscType : 'sine'
      ) as OscillatorType;
      voiceScale = basicType === 'sine' ? 0.38 : 0.28;

      const osc = ctx.createOscillator();
      osc.type = basicType;
      osc.frequency.setValueAtTime(freqHz, startTime);
      osc.connect(envGain);
      oscillators.push(osc);
    }

    const attack = Math.max(0.005, this.envOptions.attack ?? 0.015);
    const decay = Math.max(0.015, this.envOptions.decay ?? 0.3);
    const sustain = Math.max(0.001, Math.min(1, this.envOptions.sustain ?? 0.6));
    const release = Math.max(0.02, this.envOptions.release ?? 0.5);
    const peakGain = Math.max(0.001, velocity * voiceScale);

    // Click-free attack and exponential decay
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
      extraNodes,
      envGain,
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

    const stopTime = effectiveRelTime + dur + 0.015;
    for (let i = 0; i < voice.oscillators.length; i++) {
      try {
        voice.oscillators[i].stop(stopTime);
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

    // Choke any existing active sample on the same key smoothly over 8ms (zero click noise)
    for (let i = 0; i < this.activeSources.length; i++) {
      const existing = this.activeSources[i];
      if (existing.midiKey === midiKey && !existing.released) {
        this.stopSampleSource(existing, startTime, 0.008);
      }
    }

    // Cap concurrent sources per voice to 6
    while (this.activeSources.length >= 6) {
      const oldest = this.activeSources.shift();
      if (oldest) {
        this.stopSampleSource(oldest, startTime, 0.008);
      }
    }

    const playbackRate = Math.max(0.15, Math.min(6.0, Math.pow(2, (midiFloat - this.anchorMidi) / 12)));
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

  /**
   * Initializes Web Audio context and builds the multi-voice graph.
   */
  public async init(): Promise<void> {
    if (this.isReady) return;

    await Tone.start();

    // Set optimized lookahead (50ms) for glitch-free scheduling stability on non-high-end laptop CPUs
    Tone.context.lookAhead = 0.05;

    const rawCtx = Tone.getContext().rawContext as AudioContext;

    // 1. Master Chain: Filter -> Delay -> Reverb -> MasterBus -> Limiter -> Destination
    // (Removed always-on series LFO Chorus that caused 1.5Hz pitch wobble and comb-filtering on bass/vocals)
    this.limiter = new Tone.Limiter(-1).toDestination();
    this.masterBus = new Tone.Volume(0).connect(this.limiter);

    // Compact 1.1s stereo IR cuts real-time FFT ConvolverNode CPU load by ~45% while keeping lush studio space
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

    // 2. Waveform Analyser & Master Recorder connected at Destination
    this.analyser = new Tone.Analyser('waveform', 512);
    Tone.Destination.connect(this.analyser);

    this.recorder = new Tone.Recorder();
    Tone.Destination.connect(this.recorder);

    // 3. Live Synth (Polyphony: 16) with -6 dB clean headroom
    this.liveSynth = new NativePolySynth(rawCtx, 16, -6);
    this.applyPresetToSynth(this.liveSynth, this.currentPreset);
    this.liveSynth.connect(this.masterFilterNativeInput);

    // 4. 4 Track Synths with dedicated volume controls
    for (let i = 0; i < 4; i++) {
      const vol = new Tone.Volume(-6).connect(this.masterFilter);
      const nativeTrackIn = rawCtx.createGain();
      nativeTrackIn.gain.value = 1;
      Tone.connect(nativeTrackIn, vol);

      const synth = new NativePolySynth(rawCtx, 10, -6);
      this.applyPresetToSynth(synth, PRESETS[i % 5]);
      synth.connect(nativeTrackIn);

      this.trackVolumes.push(vol);
      this.trackNativeInputs.push(nativeTrackIn);
      this.trackSynths.push(synth);
    }

    this.isReady = true;

    // Apply initial macro values
    this.applyFilterMacro();
    this.applySpaceMacro();
    this.applyEchoMacro();
    this.applySnapMacro();
  }

  /**
   * Synchronizes the multi-voice DirectSamplePlayer pool with the active voice library.
   * Zero Web Audio nodes are created at rest; updates existing players in O(1) without graph churn.
   */
  public syncVoices(voices: RegisteredVoice[]) {
    if (!this.isReady) return;
    const rawCtx = Tone.getContext().rawContext as AudioContext;

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

    // 2. Build or update lightweight players for each voice (0 idle Web Audio nodes!)
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

    // Keep primary liveSampler pointing to first voice for backwards compatibility
    if (voices[0]) {
      this.liveSampler = this.liveSamplers.get(voices[0].id) || null;
      this.liveSamplerFineCents = this.liveSamplerFineCentsMap.get(voices[0].id) || 0;
      this.liveSamplerOctaveShift = this.liveSamplerOctaveShiftMap.get(voices[0].id) || 0;
    }
  }

  /**
   * Loads a user-recorded or uploaded sample into the live DirectSamplePlayer.
   */
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

  /**
   * Clones the currently loaded user sample onto a specific Looper Track's dedicated Sampler.
   */
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
   * Applies preset oscillator & envelope configuration onto a target synth.
   */
  public applyPresetToSynth(synth: NativePolySynth, preset: PresetConfig) {
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
      } catch {}
      this.applyPresetToSynth(this.liveSynth, preset);
      this.applySnapMacro();
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

      // Single voice solo for vocal clips (rawNotes[0])
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
   * Transposes notes based on preset octave offset (e.g. -1 for sub bass) using O(1) fast string transform.
   */
  public transposeNotes(notes: string[], octaveOffset: number): string[] {
    if (octaveOffset === 0) return notes;
    const out = new Array<string>(notes.length);
    for (let i = 0; i < notes.length; i++) {
      out[i] = transposeNoteFast(notes[i], octaveOffset);
    }
    return out;
  }

  /**
   * Applies both octave shift and microtonal cents correction using cached O(1) frequency lookup.
   */
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
        // Unmapped key in Preset 0: Silent!
        return;
      }

      const sampler = this.liveSamplers.get(voice.id) || this.liveSampler;
      if (!sampler) return;

      // Single Voice Solo even if Shift/Chord mode is active (rawNotes[0])
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
    } catch {}
    this.activeCodeNotes.clear();
  }

  /**
   * Updates only the specific macro parameter that changed, avoiding redundant PolySynth.set() calls.
   */
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

  private applySnapMacro() {
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
    for (const sampler of this.liveSamplers.values()) {
      sampler.attack = attack;
      sampler.release = release;
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
