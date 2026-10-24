export interface SubOscConfig {
  enabled: boolean;
  type: 'sine' | 'triangle' | 'square';
  octaveOffset: -1 | -2;
  mix: number; // 0.0 to 1.0
}

export interface NoiseLayerConfig {
  enabled: boolean;
  type: 'white' | 'pink';
  mix: number;   // 0.0 to 0.8
  decay: number; // 0.01s (transient click/pick) to 1.5s (sustained breath/air)
}

export interface VoiceFilterConfig {
  enabled: boolean;
  type: 'lowpass' | 'bandpass' | 'highpass';
  cutoffHz: number;    // 80 to 14000 Hz
  resonanceQ: number;  // 0.5 to 14
  envAmountHz: number; // -4000 to +8000 Hz envelope sweep
  envDecay: number;    // 0.03s to 2.0s
}

export interface PitchEnvConfig {
  enabled: boolean;
  semitones: number; // -12 to +12 semitones at note start
  decay: number;     // 0.015s to 0.5s
}

export interface VibratoConfig {
  enabled: boolean;
  rateHz: number;     // 0.5 to 12 Hz
  depthCents: number; // 0 to 50 cents
}

export interface PresetConfig {
  id: string;
  number: number; // 1 to 6 for default hotkeys, or index
  hotkeyLabel: string;
  name: string;
  category:
    | 'Keys & E-Pianos'
    | 'Bass & 808'
    | 'Pads & Strings'
    | 'Plucks & World'
    | 'Leads & Winds'
    | 'Bells & Mallet'
    | 'Mic / Audio Sampler'
    | 'Custom User'
    | string;
  description: string;
  color: string;
  octaveOffset: number;
  isSamplerVoice?: boolean;
  isCustom?: boolean;
  synthOptions: {
    oscillator: {
      type:
        | 'sine'
        | 'triangle'
        | 'sawtooth'
        | 'square'
        | 'fatsawtooth'
        | 'fatsquare'
        | 'fattriangle'
        | 'fmsine'
        | 'fmtriangle'
        | 'fmsawtooth'
        | 'fmsquare';
      count?: number;
      spread?: number;
      harmonicity?: number;
      modulationIndex?: number;
    };
    envelope: {
      attack: number;
      decay: number;
      sustain: number;
      release: number;
    };
    subOsc?: SubOscConfig;
    noise?: NoiseLayerConfig;
    filter?: VoiceFilterConfig;
    pitchEnv?: PitchEnvConfig;
    vibrato?: VibratoConfig;
  };
}

export const PRESET_CATEGORIES = [
  'All',
  'Keys & E-Pianos',
  'Bass & 808',
  'Pads & Strings',
  'Plucks & World',
  'Leads & Winds',
  'Bells & Mallet',
  'Custom User',
] as const;

export const STUDIO_PRESETS: PresetConfig[] = [
  // ============================================================================
  // 1. KEYS & E-PIANOS (5)
  // ============================================================================
  {
    id: 'lofi-rhodes',
    number: 3,
    hotkeyLabel: '7',
    name: 'Lo-Fi Rhodes',
    category: 'Keys & E-Pianos',
    description: 'Vintage FM electric keys with warm bell tine transient and subtle tape drift',
    color: '#a855f7',
    octaveOffset: 0,
    synthOptions: {
      oscillator: { type: 'fmtriangle', harmonicity: 2, modulationIndex: 1.8 },
      envelope: { attack: 0.01, decay: 0.65, sustain: 0.38, release: 1.1 },
      subOsc: { enabled: true, type: 'sine', octaveOffset: -1, mix: 0.22 },
      noise: { enabled: true, type: 'pink', mix: 0.06, decay: 0.03 },
      filter: { enabled: true, type: 'lowpass', cutoffHz: 2600, resonanceQ: 1.2, envAmountHz: 1800, envDecay: 0.25 },
      vibrato: { enabled: true, rateHz: 3.2, depthCents: 6 },
    },
  },
  {
    id: 'warm-wurlitzer',
    number: 7,
    hotkeyLabel: '',
    name: 'Warm Wurlitzer',
    category: 'Keys & E-Pianos',
    description: 'Soulful reed electric piano with bark on attack and warm midrange body',
    color: '#c084fc',
    octaveOffset: 0,
    synthOptions: {
      oscillator: { type: 'fmsine', harmonicity: 3, modulationIndex: 2.4 },
      envelope: { attack: 0.008, decay: 0.55, sustain: 0.35, release: 0.75 },
      subOsc: { enabled: true, type: 'triangle', octaveOffset: -1, mix: 0.18 },
      noise: { enabled: true, type: 'white', mix: 0.05, decay: 0.025 },
      filter: { enabled: true, type: 'lowpass', cutoffHz: 2200, resonanceQ: 1.8, envAmountHz: 2400, envDecay: 0.18 },
      vibrato: { enabled: true, rateHz: 4.8, depthCents: 8 },
    },
  },
  {
    id: 'velvet-felt-piano',
    number: 8,
    hotkeyLabel: '',
    name: 'Velvet Felt Piano',
    category: 'Keys & E-Pianos',
    description: 'Intimate upright piano with soft felt hammer transient and woody resonance',
    color: '#818cf8',
    octaveOffset: 0,
    synthOptions: {
      oscillator: { type: 'fattriangle', count: 2, spread: 8 },
      envelope: { attack: 0.012, decay: 0.8, sustain: 0.22, release: 1.3 },
      subOsc: { enabled: true, type: 'sine', octaveOffset: -1, mix: 0.3 },
      noise: { enabled: true, type: 'pink', mix: 0.12, decay: 0.04 },
      filter: { enabled: true, type: 'lowpass', cutoffHz: 1500, resonanceQ: 0.9, envAmountHz: 1600, envDecay: 0.22 },
    },
  },
  {
    id: 'fm-glass-epiano',
    number: 9,
    hotkeyLabel: '',
    name: 'FM Glass E-Piano',
    category: 'Keys & E-Pianos',
    description: 'Classic 80s DX7 crystalline FM electric piano with shimmering overtones',
    color: '#38bdf8',
    octaveOffset: 0,
    synthOptions: {
      oscillator: { type: 'fmsine', harmonicity: 4, modulationIndex: 2.8 },
      envelope: { attack: 0.006, decay: 0.7, sustain: 0.3, release: 1.2 },
      subOsc: { enabled: true, type: 'sine', octaveOffset: -1, mix: 0.25 },
      filter: { enabled: true, type: 'lowpass', cutoffHz: 4800, resonanceQ: 1.1, envAmountHz: 2800, envDecay: 0.2 },
      vibrato: { enabled: true, rateHz: 2.5, depthCents: 5 },
    },
  },
  {
    id: 'vintage-clavinet',
    number: 10,
    hotkeyLabel: '',
    name: 'Vintage Clavinet',
    category: 'Keys & E-Pianos',
    description: 'Funky, percussive electromagnetic clavinet with snappy resonant filter bite',
    color: '#fb923c',
    octaveOffset: 0,
    synthOptions: {
      oscillator: { type: 'fatsquare', count: 2, spread: 10 },
      envelope: { attack: 0.005, decay: 0.28, sustain: 0.25, release: 0.22 },
      noise: { enabled: true, type: 'white', mix: 0.08, decay: 0.02 },
      filter: { enabled: true, type: 'bandpass', cutoffHz: 1600, resonanceQ: 2.5, envAmountHz: 2800, envDecay: 0.12 },
    },
  },

  // ============================================================================
  // 2. BASS & 808 (5)
  // ============================================================================
  {
    id: 'deep-bass',
    number: 2,
    hotkeyLabel: '6',
    name: 'Deep Sub Bass',
    category: 'Bass & 808',
    description: 'Thick FM sub bass punch tuned 1 octave down with reinforced sub-octave sine',
    color: '#06b6d4',
    octaveOffset: -1,
    synthOptions: {
      oscillator: { type: 'fmsine', modulationIndex: 2.8, harmonicity: 0.5 },
      envelope: { attack: 0.008, decay: 0.35, sustain: 0.65, release: 0.35 },
      subOsc: { enabled: true, type: 'sine', octaveOffset: -1, mix: 0.55 },
      filter: { enabled: true, type: 'lowpass', cutoffHz: 420, resonanceQ: 1.6, envAmountHz: 950, envDecay: 0.14 },
    },
  },
  {
    id: '808-punch-glide',
    number: 11,
    hotkeyLabel: '',
    name: '808 Punch & Glide',
    category: 'Bass & 808',
    description: 'Hard-hitting studio 808 sub with pitch-envelope kick transient and long boom',
    color: '#22d3ee',
    octaveOffset: -1,
    synthOptions: {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.005, decay: 0.9, sustain: 0.35, release: 0.65 },
      subOsc: { enabled: true, type: 'triangle', octaveOffset: -1, mix: 0.4 },
      noise: { enabled: true, type: 'pink', mix: 0.09, decay: 0.018 },
      filter: { enabled: true, type: 'lowpass', cutoffHz: 320, resonanceQ: 1.4, envAmountHz: 800, envDecay: 0.08 },
      pitchEnv: { enabled: true, semitones: 7, decay: 0.045 },
    },
  },
  {
    id: 'reese-sub-bass',
    number: 12,
    hotkeyLabel: '',
    name: 'Reese Sub Bass',
    category: 'Bass & 808',
    description: 'Wide detuned sawtooth DnB/ Garage Reese bass with deep sub-octave anchor',
    color: '#0ea5e9',
    octaveOffset: -1,
    synthOptions: {
      oscillator: { type: 'fatsawtooth', count: 3, spread: 24 },
      envelope: { attack: 0.025, decay: 0.4, sustain: 0.8, release: 0.45 },
      subOsc: { enabled: true, type: 'sine', octaveOffset: -1, mix: 0.6 },
      filter: { enabled: true, type: 'lowpass', cutoffHz: 520, resonanceQ: 2.2, envAmountHz: 700, envDecay: 0.35 },
    },
  },
  {
    id: 'acid-303-bass',
    number: 13,
    hotkeyLabel: '',
    name: 'Acid 303 Bass',
    category: 'Bass & 808',
    description: 'Squelchy TB-303 resonant lowpass saw bass with liquid filter envelope sweep',
    color: '#14b8a6',
    octaveOffset: -1,
    synthOptions: {
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.005, decay: 0.26, sustain: 0.2, release: 0.18 },
      subOsc: { enabled: true, type: 'square', octaveOffset: -1, mix: 0.25 },
      filter: { enabled: true, type: 'lowpass', cutoffHz: 340, resonanceQ: 7.5, envAmountHz: 3200, envDecay: 0.16 },
    },
  },
  {
    id: 'analog-moog-bass',
    number: 14,
    hotkeyLabel: '',
    name: 'Analog Moog Bass',
    category: 'Bass & 808',
    description: 'Fat 70s ladder-filter synth bass with punchy attack and rich analog harmonics',
    color: '#0284c7',
    octaveOffset: -1,
    synthOptions: {
      oscillator: { type: 'fatsawtooth', count: 2, spread: 12 },
      envelope: { attack: 0.007, decay: 0.3, sustain: 0.45, release: 0.25 },
      subOsc: { enabled: true, type: 'square', octaveOffset: -1, mix: 0.45 },
      filter: { enabled: true, type: 'lowpass', cutoffHz: 600, resonanceQ: 2.8, envAmountHz: 2100, envDecay: 0.18 },
    },
  },

  // ============================================================================
  // 3. PADS & STRINGS (5)
  // ============================================================================
  {
    id: 'warm-pad',
    number: 1,
    hotkeyLabel: '5',
    name: 'Warm Pad',
    category: 'Pads & Strings',
    description: 'Lush detuned sawtooth pad with warm lowpass filter swell and rich sustain',
    color: '#f59e0b',
    octaveOffset: 0,
    synthOptions: {
      oscillator: { type: 'fatsawtooth', count: 3, spread: 18 },
      envelope: { attack: 0.12, decay: 0.5, sustain: 0.8, release: 1.4 },
      subOsc: { enabled: true, type: 'sine', octaveOffset: -1, mix: 0.25 },
      filter: { enabled: true, type: 'lowpass', cutoffHz: 1800, resonanceQ: 1.1, envAmountHz: 1400, envDecay: 0.8 },
      vibrato: { enabled: true, rateHz: 2.2, depthCents: 6 },
    },
  },
  {
    id: 'cinema-brass-pad',
    number: 15,
    hotkeyLabel: '',
    name: 'Cinema Brass Pad (CS-80)',
    category: 'Pads & Strings',
    description: 'Vangelis-style expressive analog brass pad with sweeping resonant filter',
    color: '#fbbf24',
    octaveOffset: 0,
    synthOptions: {
      oscillator: { type: 'fatsawtooth', count: 3, spread: 22 },
      envelope: { attack: 0.08, decay: 0.6, sustain: 0.75, release: 1.3 },
      subOsc: { enabled: true, type: 'triangle', octaveOffset: -1, mix: 0.2 },
      filter: { enabled: true, type: 'lowpass', cutoffHz: 1100, resonanceQ: 2.0, envAmountHz: 3200, envDecay: 0.55 },
      vibrato: { enabled: true, rateHz: 4.2, depthCents: 9 },
    },
  },
  {
    id: 'velvet-string-ensemble',
    number: 16,
    hotkeyLabel: '',
    name: 'Velvet String Ensemble',
    category: 'Pads & Strings',
    description: 'Lush symphonic Solina string machine with silky bowed attack and vibrato',
    color: '#f97316',
    octaveOffset: 0,
    synthOptions: {
      oscillator: { type: 'fatsawtooth', count: 3, spread: 28 },
      envelope: { attack: 0.18, decay: 0.5, sustain: 0.85, release: 1.5 },
      noise: { enabled: true, type: 'pink', mix: 0.05, decay: 0.4 },
      filter: { enabled: true, type: 'lowpass', cutoffHz: 3200, resonanceQ: 0.8, envAmountHz: 1200, envDecay: 0.7 },
      vibrato: { enabled: true, rateHz: 5.0, depthCents: 10 },
    },
  },
  {
    id: 'airy-vocal-choir',
    number: 17,
    hotkeyLabel: '',
    name: 'Airy Vocal Choir Pad',
    category: 'Pads & Strings',
    description: 'Angelic bandpass-sculpted vocal formant pad with breathy air texture',
    color: '#f472b6',
    octaveOffset: 0,
    synthOptions: {
      oscillator: { type: 'fattriangle', count: 3, spread: 20 },
      envelope: { attack: 0.2, decay: 0.6, sustain: 0.85, release: 1.6 },
      subOsc: { enabled: true, type: 'sine', octaveOffset: -1, mix: 0.25 },
      noise: { enabled: true, type: 'white', mix: 0.12, decay: 0.9 },
      filter: { enabled: true, type: 'bandpass', cutoffHz: 1450, resonanceQ: 2.2, envAmountHz: 900, envDecay: 0.8 },
      vibrato: { enabled: true, rateHz: 3.8, depthCents: 8 },
    },
  },
  {
    id: 'tape-drift-pad',
    number: 18,
    hotkeyLabel: '',
    name: 'Tape Drift Pad',
    category: 'Pads & Strings',
    description: 'Nostalgic Boards-of-Canada style warm analog pad with organic pitch warble',
    color: '#d97706',
    octaveOffset: 0,
    synthOptions: {
      oscillator: { type: 'fattriangle', count: 2, spread: 16 },
      envelope: { attack: 0.15, decay: 0.7, sustain: 0.7, release: 1.5 },
      subOsc: { enabled: true, type: 'sine', octaveOffset: -1, mix: 0.3 },
      noise: { enabled: true, type: 'pink', mix: 0.08, decay: 0.6 },
      filter: { enabled: true, type: 'lowpass', cutoffHz: 1350, resonanceQ: 1.4, envAmountHz: 900, envDecay: 0.65 },
      vibrato: { enabled: true, rateHz: 1.6, depthCents: 18 },
    },
  },

  // ============================================================================
  // 4. PLUCKS & WORLD (5)
  // ============================================================================
  {
    id: 'crystal-pluck',
    number: 4,
    hotkeyLabel: '8',
    name: 'Crystal Pluck',
    category: 'Plucks & World',
    description: 'Clean bell-like pluck with crisp transient and resonant harmonic tail',
    color: '#10b981',
    octaveOffset: 0,
    synthOptions: {
      oscillator: { type: 'fmtriangle', harmonicity: 2, modulationIndex: 1.4 },
      envelope: { attack: 0.005, decay: 0.28, sustain: 0.12, release: 0.65 },
      noise: { enabled: true, type: 'white', mix: 0.08, decay: 0.02 },
      filter: { enabled: true, type: 'lowpass', cutoffHz: 2400, resonanceQ: 1.8, envAmountHz: 4200, envDecay: 0.14 },
    },
  },
  {
    id: 'tokyo-koto-pluck',
    number: 19,
    hotkeyLabel: '',
    name: 'Tokyo Koto Pluck',
    category: 'Plucks & World',
    description: 'Expressive Japanese 13-string koto with plectrum snap and pitch micro-bend',
    color: '#34d399',
    octaveOffset: 0,
    synthOptions: {
      oscillator: { type: 'fmsawtooth', harmonicity: 1, modulationIndex: 2.2 },
      envelope: { attack: 0.005, decay: 0.36, sustain: 0.08, release: 0.75 },
      noise: { enabled: true, type: 'white', mix: 0.16, decay: 0.022 },
      filter: { enabled: true, type: 'lowpass', cutoffHz: 1900, resonanceQ: 2.6, envAmountHz: 4800, envDecay: 0.12 },
      pitchEnv: { enabled: true, semitones: 0.6, decay: 0.03 },
    },
  },
  {
    id: 'acoustic-nylon-pluck',
    number: 20,
    hotkeyLabel: '',
    name: 'Acoustic Nylon Pluck',
    category: 'Plucks & World',
    description: 'Warm fingerpicked Spanish nylon guitar with woody body resonance',
    color: '#059669',
    octaveOffset: 0,
    synthOptions: {
      oscillator: { type: 'fattriangle', count: 2, spread: 6 },
      envelope: { attack: 0.006, decay: 0.42, sustain: 0.15, release: 0.6 },
      subOsc: { enabled: true, type: 'sine', octaveOffset: -1, mix: 0.28 },
      noise: { enabled: true, type: 'pink', mix: 0.12, decay: 0.025 },
      filter: { enabled: true, type: 'lowpass', cutoffHz: 1600, resonanceQ: 1.5, envAmountHz: 3400, envDecay: 0.16 },
    },
  },
  {
    id: 'wooden-marimba',
    number: 21,
    hotkeyLabel: '',
    name: 'Wooden Marimba',
    category: 'Plucks & World',
    description: 'Hollow rosewood mallet percussion with 4th-harmonic overtone and warm knock',
    color: '#6ee7b7',
    octaveOffset: 0,
    synthOptions: {
      oscillator: { type: 'fmsine', harmonicity: 4, modulationIndex: 1.5 },
      envelope: { attack: 0.005, decay: 0.22, sustain: 0.05, release: 0.35 },
      subOsc: { enabled: true, type: 'sine', octaveOffset: -1, mix: 0.35 },
      noise: { enabled: true, type: 'pink', mix: 0.14, decay: 0.015 },
      filter: { enabled: true, type: 'lowpass', cutoffHz: 2100, resonanceQ: 2.0, envAmountHz: 2600, envDecay: 0.09 },
    },
  },
  {
    id: 'muted-pizzicato',
    number: 22,
    hotkeyLabel: '',
    name: 'Muted Pizzicato',
    category: 'Plucks & World',
    description: 'Tight plucked orchestral strings for rhythmic arpeggios and hip-hop hooks',
    color: '#10b981',
    octaveOffset: 0,
    synthOptions: {
      oscillator: { type: 'fatsawtooth', count: 2, spread: 14 },
      envelope: { attack: 0.005, decay: 0.16, sustain: 0.04, release: 0.22 },
      noise: { enabled: true, type: 'pink', mix: 0.12, decay: 0.02 },
      filter: { enabled: true, type: 'lowpass', cutoffHz: 1100, resonanceQ: 1.8, envAmountHz: 3000, envDecay: 0.09 },
    },
  },

  // ============================================================================
  // 5. LEADS & WINDS (5)
  // ============================================================================
  {
    id: 'neon-lead',
    number: 5,
    hotkeyLabel: '9',
    name: 'Neon Lead',
    category: 'Leads & Winds',
    description: 'Cutting stereo square-saw synth lead with expressive vibrato and filter bite',
    color: '#f43f5e',
    octaveOffset: 0,
    synthOptions: {
      oscillator: { type: 'fatsquare', count: 2, spread: 15 },
      envelope: { attack: 0.012, decay: 0.35, sustain: 0.75, release: 0.55 },
      subOsc: { enabled: true, type: 'sine', octaveOffset: -1, mix: 0.2 },
      filter: { enabled: true, type: 'lowpass', cutoffHz: 3400, resonanceQ: 2.2, envAmountHz: 3200, envDecay: 0.22 },
      vibrato: { enabled: true, rateHz: 5.5, depthCents: 10 },
    },
  },
  {
    id: '8bit-chiptune-square',
    number: 23,
    hotkeyLabel: '',
    name: '8-Bit Chiptune Square',
    category: 'Leads & Winds',
    description: 'Crisp retro arcade pulse wave with pitch-blip attack for chiptune melodies',
    color: '#fb7185',
    octaveOffset: 0,
    synthOptions: {
      oscillator: { type: 'square' },
      envelope: { attack: 0.005, decay: 0.2, sustain: 0.6, release: 0.15 },
      filter: { enabled: true, type: 'lowpass', cutoffHz: 6500, resonanceQ: 1.0, envAmountHz: 1500, envDecay: 0.1 },
      pitchEnv: { enabled: true, semitones: 12, decay: 0.018 },
    },
  },
  {
    id: 'analog-synth-brass',
    number: 24,
    hotkeyLabel: '',
    name: 'Analog Synth Brass',
    category: 'Leads & Winds',
    description: 'Punchy 80s synthwave poly-brass with bold filter envelope swell on attack',
    color: '#e11d48',
    octaveOffset: 0,
    synthOptions: {
      oscillator: { type: 'fatsawtooth', count: 3, spread: 16 },
      envelope: { attack: 0.035, decay: 0.35, sustain: 0.7, release: 0.45 },
      subOsc: { enabled: true, type: 'square', octaveOffset: -1, mix: 0.2 },
      filter: { enabled: true, type: 'lowpass', cutoffHz: 900, resonanceQ: 2.8, envAmountHz: 4200, envDecay: 0.24 },
      pitchEnv: { enabled: true, semitones: -0.4, decay: 0.04 },
    },
  },
  {
    id: 'bamboo-shakuhachi',
    number: 25,
    hotkeyLabel: '',
    name: 'Bamboo Shakuhachi',
    category: 'Leads & Winds',
    description: 'Breathy Japanese bamboo flute with chuff attack transient and soulful vibrato',
    color: '#fda4af',
    octaveOffset: 0,
    synthOptions: {
      oscillator: { type: 'fmtriangle', harmonicity: 1, modulationIndex: 0.8 },
      envelope: { attack: 0.06, decay: 0.4, sustain: 0.78, release: 0.65 },
      noise: { enabled: true, type: 'white', mix: 0.22, decay: 0.35 },
      filter: { enabled: true, type: 'bandpass', cutoffHz: 1850, resonanceQ: 1.6, envAmountHz: 900, envDecay: 0.25 },
      pitchEnv: { enabled: true, semitones: -0.5, decay: 0.05 },
      vibrato: { enabled: true, rateHz: 4.6, depthCents: 14 },
    },
  },
  {
    id: 'soft-sine-whistle',
    number: 26,
    hotkeyLabel: '',
    name: 'Soft Sine Whistle',
    category: 'Leads & Winds',
    description: 'Silky G-funk / lo-fi pure sine portamento lead with gentle vibrato',
    color: '#f43f5e',
    octaveOffset: 1,
    synthOptions: {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.025, decay: 0.3, sustain: 0.85, release: 0.5 },
      subOsc: { enabled: true, type: 'sine', octaveOffset: -1, mix: 0.3 },
      noise: { enabled: true, type: 'pink', mix: 0.04, decay: 0.15 },
      filter: { enabled: true, type: 'lowpass', cutoffHz: 3800, resonanceQ: 1.0, envAmountHz: 800, envDecay: 0.2 },
      vibrato: { enabled: true, rateHz: 5.2, depthCents: 11 },
    },
  },

  // ============================================================================
  // 6. BELLS & MALLET (5)
  // ============================================================================
  {
    id: 'fm-starlight-bell',
    number: 27,
    hotkeyLabel: '',
    name: 'FM Starlight Bell',
    category: 'Bells & Mallet',
    description: 'Sparkling inharmonic FM bell chime with crystalline high-end shimmer',
    color: '#38bdf8',
    octaveOffset: 0,
    synthOptions: {
      oscillator: { type: 'fmsine', harmonicity: 3.5, modulationIndex: 4.2 },
      envelope: { attack: 0.005, decay: 0.9, sustain: 0.15, release: 1.6 },
      subOsc: { enabled: true, type: 'sine', octaveOffset: -1, mix: 0.2 },
      filter: { enabled: true, type: 'lowpass', cutoffHz: 7500, resonanceQ: 1.2, envAmountHz: 3000, envDecay: 0.3 },
      vibrato: { enabled: true, rateHz: 3.0, depthCents: 5 },
    },
  },
  {
    id: 'music-box-chime',
    number: 28,
    hotkeyLabel: '',
    name: 'Music Box Chime',
    category: 'Bells & Mallet',
    description: 'Delicate mechanical metal tine music box tuned an octave up',
    color: '#7dd3fc',
    octaveOffset: 1,
    synthOptions: {
      oscillator: { type: 'fmsine', harmonicity: 5, modulationIndex: 2.2 },
      envelope: { attack: 0.005, decay: 0.55, sustain: 0.08, release: 1.2 },
      noise: { enabled: true, type: 'white', mix: 0.08, decay: 0.012 },
      filter: { enabled: true, type: 'lowpass', cutoffHz: 6200, resonanceQ: 1.5, envAmountHz: 2500, envDecay: 0.15 },
    },
  },
  {
    id: 'vibraphone-shimmer',
    number: 29,
    hotkeyLabel: '',
    name: 'Vibraphone Shimmer',
    category: 'Bells & Mallet',
    description: 'Jazz lounge metallic vibraphone with warm motor tremolo/vibrato',
    color: '#60a5fa',
    octaveOffset: 0,
    synthOptions: {
      oscillator: { type: 'fmsine', harmonicity: 4, modulationIndex: 1.6 },
      envelope: { attack: 0.008, decay: 0.85, sustain: 0.25, release: 1.4 },
      subOsc: { enabled: true, type: 'sine', octaveOffset: -1, mix: 0.3 },
      filter: { enabled: true, type: 'lowpass', cutoffHz: 3600, resonanceQ: 1.2, envAmountHz: 2000, envDecay: 0.25 },
      vibrato: { enabled: true, rateHz: 5.8, depthCents: 14 },
    },
  },
  {
    id: 'steel-pan-mallet',
    number: 30,
    hotkeyLabel: '',
    name: 'Steel Pan Mallet',
    category: 'Bells & Mallet',
    description: 'Tropical tuned steel drum with bright harmonic overtone bloom',
    color: '#2dd4bf',
    octaveOffset: 0,
    synthOptions: {
      oscillator: { type: 'fmtriangle', harmonicity: 2, modulationIndex: 2.6 },
      envelope: { attack: 0.006, decay: 0.32, sustain: 0.1, release: 0.5 },
      noise: { enabled: true, type: 'pink', mix: 0.09, decay: 0.02 },
      filter: { enabled: true, type: 'bandpass', cutoffHz: 2200, resonanceQ: 2.0, envAmountHz: 3400, envDecay: 0.14 },
      pitchEnv: { enabled: true, semitones: -0.35, decay: 0.03 },
    },
  },
  {
    id: 'ambient-glass-harp',
    number: 31,
    hotkeyLabel: '',
    name: 'Ambient Glass Harp',
    category: 'Bells & Mallet',
    description: 'Crystalline rubbed wine-glass harmonics with ethereal slow bloom',
    color: '#a5b4fc',
    octaveOffset: 0,
    synthOptions: {
      oscillator: { type: 'fmsine', harmonicity: 2, modulationIndex: 1.2 },
      envelope: { attack: 0.09, decay: 0.8, sustain: 0.65, release: 1.6 },
      noise: { enabled: true, type: 'white', mix: 0.06, decay: 0.5 },
      filter: { enabled: true, type: 'lowpass', cutoffHz: 4200, resonanceQ: 1.8, envAmountHz: 1800, envDecay: 0.6 },
      vibrato: { enabled: true, rateHz: 3.4, depthCents: 7 },
    },
  },
];

export const SAMPLER_PRESET: PresetConfig = {
  id: 'custom-sampler',
  number: 6,
  hotkeyLabel: '0',
  name: 'Multi-Voice Sampler',
  category: 'Mic / Audio Sampler',
  description: '30 real human vocal clips & custom mic recordings mapped across the keyboard',
  color: '#ec4899',
  octaveOffset: 0,
  isSamplerVoice: true,
  synthOptions: {
    oscillator: { type: 'sine' },
    envelope: { attack: 0.008, decay: 0.4, sustain: 0.8, release: 0.5 },
  },
};

// Default 5 pinned synth presets for hotkeys [5]-[9] + [0] Sampler at index 5
export const DEFAULT_PINNED_SYNTH_IDS = [
  'warm-pad',      // [5]
  'deep-bass',     // [6]
  'lofi-rhodes',   // [7]
  'crystal-pluck', // [8]
  'neon-lead',     // [9]
];

const CUSTOM_PRESETS_STORAGE_KEY = 'aurakeys_custom_presets_v26';
const PINNED_SLOTS_STORAGE_KEY = 'aurakeys_pinned_slots_v26';

export function deepClonePreset(preset: PresetConfig): PresetConfig {
  return JSON.parse(JSON.stringify(preset));
}

export function loadCustomPresets(): PresetConfig[] {
  try {
    const raw = localStorage.getItem(CUSTOM_PRESETS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return [];
}

export function saveCustomPreset(preset: PresetConfig): PresetConfig[] {
  const existing = loadCustomPresets().filter((p) => p.id !== preset.id);
  const updated = [preset, ...existing];
  try {
    localStorage.setItem(CUSTOM_PRESETS_STORAGE_KEY, JSON.stringify(updated));
  } catch {}
  return updated;
}

export function deleteCustomPreset(presetId: string): PresetConfig[] {
  const updated = loadCustomPresets().filter((p) => p.id !== presetId);
  try {
    localStorage.setItem(CUSTOM_PRESETS_STORAGE_KEY, JSON.stringify(updated));
  } catch {}
  return updated;
}

export function loadPinnedPresetIds(): string[] {
  try {
    const raw = localStorage.getItem(PINNED_SLOTS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length === 5) return parsed;
    }
  } catch {}
  return [...DEFAULT_PINNED_SYNTH_IDS];
}

export function savePinnedPresetIds(ids: string[]): void {
  try {
    localStorage.setItem(PINNED_SLOTS_STORAGE_KEY, JSON.stringify(ids.slice(0, 5)));
  } catch {}
}

export function getAllPresets(customPresets?: PresetConfig[]): PresetConfig[] {
  const custom = customPresets ?? loadCustomPresets();
  // Ensure the 5 default hotkeys come first in PRESETS[0..4] and custom-sampler at PRESETS[5]
  const pinnedIds = loadPinnedPresetIds();
  const pool = [...custom, ...STUDIO_PRESETS];
  const pinned: PresetConfig[] = [];

  for (let i = 0; i < 5; i++) {
    const found =
      pool.find((p) => p.id === pinnedIds[i]) ||
      STUDIO_PRESETS.find((p) => p.id === DEFAULT_PINNED_SYNTH_IDS[i]) ||
      STUDIO_PRESETS[i];
    pinned.push({
      ...deepClonePreset(found),
      number: i + 1,
      hotkeyLabel: String(i + 5),
    });
  }

  const samplerWithHotkey: PresetConfig = {
    ...deepClonePreset(SAMPLER_PRESET),
    number: 6,
    hotkeyLabel: '0',
  };

  const remaining = pool
    .filter((p) => !pinned.some((pin) => pin.id === p.id))
    .map((p, idx) => ({
      ...deepClonePreset(p),
      number: idx + 7,
      hotkeyLabel: '',
    }));

  return [...pinned, samplerWithHotkey, ...remaining];
}

// Export PRESETS containing all 30+ presets (with indices 0..4 = hotkeys 5..9 and index 5 = hotkey 0)
export const PRESETS: PresetConfig[] = getAllPresets();

/**
 * Smart Musical Patch Generator for 1-click sound creation in Synth Lab
 */
export function generateSmartPreset(
  archetype: 'bass' | 'pad' | 'pluck' | 'lead' | 'bell' | 'mutate',
  basePreset?: PresetConfig
): PresetConfig {
  const id = `custom-${Date.now().toString(36)}`;
  const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
  const rand = (min: number, max: number, decimals = 2) =>
    Number((min + Math.random() * (max - min)).toFixed(decimals));

  if (archetype === 'mutate' && basePreset && !basePreset.isSamplerVoice) {
    const mutated = deepClonePreset(basePreset);
    mutated.id = id;
    mutated.name = `${basePreset.name.replace(/ \(Mutated\)$/, '')} (Mutated)`;
    mutated.category = 'Custom User';
    mutated.isCustom = true;
    const env = mutated.synthOptions.envelope;
    env.attack = Math.max(0.005, Number((env.attack * rand(0.7, 1.4)).toFixed(3)));
    env.decay = Math.max(0.08, Number((env.decay * rand(0.75, 1.35)).toFixed(2)));
    env.release = Math.max(0.12, Number((env.release * rand(0.75, 1.35)).toFixed(2)));
    if (mutated.synthOptions.filter) {
      mutated.synthOptions.filter.cutoffHz = Math.round(
        Math.min(10000, Math.max(180, mutated.synthOptions.filter.cutoffHz * rand(0.7, 1.4)))
      );
      mutated.synthOptions.filter.envAmountHz = Math.round(
        mutated.synthOptions.filter.envAmountHz * rand(0.7, 1.35)
      );
    }
    return mutated;
  }

  if (archetype === 'bass') {
    const adj = pick(['Sub', 'Acid', 'Cyber', 'Velvet', 'Midnight', 'Tokyo', 'Analog']);
    const noun = pick(['808', 'Reese', 'Moog Bass', 'Sub Pulse', 'Growl']);
    return {
      id,
      number: 99,
      hotkeyLabel: '',
      name: `${adj} ${noun}`,
      category: 'Custom User',
      description: 'Smart-generated custom bass patch with sub-octave reinforcement',
      color: '#06b6d4',
      octaveOffset: -1,
      isCustom: true,
      synthOptions: {
        oscillator: {
          type: pick(['fmsine', 'fatsawtooth', 'sawtooth', 'fatsquare']),
          count: 2,
          spread: Math.round(rand(10, 24, 0)),
          harmonicity: pick([0.5, 1, 2]),
          modulationIndex: rand(1.5, 3.5, 1),
        },
        envelope: {
          attack: rand(0.005, 0.015, 3),
          decay: rand(0.22, 0.55, 2),
          sustain: rand(0.3, 0.75, 2),
          release: rand(0.2, 0.45, 2),
        },
        subOsc: { enabled: true, type: pick(['sine', 'triangle', 'square']), octaveOffset: -1, mix: rand(0.35, 0.65) },
        filter: {
          enabled: true,
          type: 'lowpass',
          cutoffHz: Math.round(rand(260, 750, 0)),
          resonanceQ: rand(1.5, 5.5, 1),
          envAmountHz: Math.round(rand(900, 2800, 0)),
          envDecay: rand(0.1, 0.28, 2),
        },
        pitchEnv: { enabled: Math.random() > 0.4, semitones: rand(3, 8, 1), decay: rand(0.025, 0.06, 3) },
      },
    };
  }

  if (archetype === 'pad') {
    const adj = pick(['Nebula', 'Sakura', 'Horizon', 'Dream', 'Aurora', 'Analogue']);
    const noun = pick(['Cloud Pad', 'Strings', 'Warm Swell', 'Tape Choir', 'Synth Pad']);
    return {
      id,
      number: 99,
      hotkeyLabel: '',
      name: `${adj} ${noun}`,
      category: 'Custom User',
      description: 'Smart-generated lush atmospheric pad with filter movement and drift',
      color: '#f59e0b',
      octaveOffset: 0,
      isCustom: true,
      synthOptions: {
        oscillator: {
          type: pick(['fatsawtooth', 'fattriangle', 'fmsine']),
          count: 3,
          spread: Math.round(rand(16, 30, 0)),
          harmonicity: 2,
          modulationIndex: rand(1.0, 2.2, 1),
        },
        envelope: {
          attack: rand(0.09, 0.25, 2),
          decay: rand(0.5, 0.9, 2),
          sustain: rand(0.7, 0.9, 2),
          release: rand(1.1, 1.8, 2),
        },
        subOsc: { enabled: true, type: 'sine', octaveOffset: -1, mix: rand(0.18, 0.35) },
        noise: { enabled: true, type: 'pink', mix: rand(0.04, 0.12), decay: rand(0.35, 0.85) },
        filter: {
          enabled: true,
          type: 'lowpass',
          cutoffHz: Math.round(rand(1100, 2800, 0)),
          resonanceQ: rand(0.9, 2.0, 1),
          envAmountHz: Math.round(rand(900, 2400, 0)),
          envDecay: rand(0.45, 0.9, 2),
        },
        vibrato: { enabled: true, rateHz: rand(1.8, 4.8, 1), depthCents: Math.round(rand(6, 16, 0)) },
      },
    };
  }

  if (archetype === 'pluck' || archetype === 'bell') {
    const isBell = archetype === 'bell';
    const adj = pick(['Crystal', 'Kyoto', 'Starlight', 'Jade', 'bamboo', 'Glass']);
    const noun = isBell ? pick(['Chime', 'FM Bell', 'Mallet', 'Celesta']) : pick(['Pluck', 'Harp', 'Koto', 'Marimba']);
    return {
      id,
      number: 99,
      hotkeyLabel: '',
      name: `${adj} ${noun}`,
      category: 'Custom User',
      description: isBell ? 'Smart-generated shimmering FM bell chime' : 'Smart-generated percussive melodic pluck',
      color: isBell ? '#38bdf8' : '#10b981',
      octaveOffset: 0,
      isCustom: true,
      synthOptions: {
        oscillator: {
          type: isBell ? 'fmsine' : pick(['fmtriangle', 'fmsine', 'fattriangle']),
          count: 2,
          spread: 10,
          harmonicity: isBell ? pick([2, 3, 3.5, 4]) : pick([1, 2, 3]),
          modulationIndex: rand(1.4, 3.8, 1),
        },
        envelope: {
          attack: 0.005,
          decay: rand(0.2, 0.65, 2),
          sustain: rand(0.05, 0.22, 2),
          release: rand(0.4, 1.2, 2),
        },
        subOsc: { enabled: true, type: 'sine', octaveOffset: -1, mix: rand(0.15, 0.3) },
        noise: { enabled: true, type: 'white', mix: rand(0.06, 0.15), decay: rand(0.015, 0.03, 3) },
        filter: {
          enabled: true,
          type: 'lowpass',
          cutoffHz: Math.round(rand(1800, 5200, 0)),
          resonanceQ: rand(1.2, 2.6, 1),
          envAmountHz: Math.round(rand(2400, 4800, 0)),
          envDecay: rand(0.09, 0.22, 2),
        },
      },
    };
  }

  // Lead default
  const adj = pick(['Neon', 'Solar', 'Retro', 'Shibuya', 'Laser', 'Velvet']);
  const noun = pick(['Saw Lead', 'Square Lead', 'Synth Brass', 'Solo Flute']);
  return {
    id,
    number: 99,
    hotkeyLabel: '',
    name: `${adj} ${noun}`,
    category: 'Custom User',
    description: 'Smart-generated expressive solo lead synth with vibrato',
    color: '#f43f5e',
    octaveOffset: 0,
    isCustom: true,
    synthOptions: {
      oscillator: {
        type: pick(['fatsawtooth', 'fatsquare', 'fmsawtooth']),
        count: 2,
        spread: Math.round(rand(12, 22, 0)),
        harmonicity: 1,
        modulationIndex: rand(1.2, 2.5, 1),
      },
      envelope: {
        attack: rand(0.008, 0.03, 3),
        decay: rand(0.25, 0.45, 2),
        sustain: rand(0.65, 0.85, 2),
        release: rand(0.35, 0.65, 2),
      },
      subOsc: { enabled: true, type: 'square', octaveOffset: -1, mix: rand(0.15, 0.3) },
      filter: {
        enabled: true,
        type: 'lowpass',
        cutoffHz: Math.round(rand(2200, 4500, 0)),
        resonanceQ: rand(1.6, 3.0, 1),
        envAmountHz: Math.round(rand(2200, 4200, 0)),
        envDecay: rand(0.16, 0.3, 2),
      },
      vibrato: { enabled: true, rateHz: rand(4.5, 6.2, 1), depthCents: Math.round(rand(8, 16, 0)) },
    },
  };
}
