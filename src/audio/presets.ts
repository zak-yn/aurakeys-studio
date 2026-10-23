export interface PresetConfig {
  id: string;
  number: number; // 1 to 6, hotkeys 5-9 and 0
  hotkeyLabel: string;
  name: string;
  category: string;
  description: string;
  color: string;
  octaveOffset: number;
  isSamplerVoice?: boolean;
  synthOptions: {
    oscillator: any;
    envelope: {
      attack: number;
      decay: number;
      sustain: number;
      release: number;
    };
  };
}

export const PRESETS: PresetConfig[] = [
  {
    id: 'warm-pad',
    number: 1,
    hotkeyLabel: '5',
    name: 'Warm Pad',
    category: 'Chords / Atmosphere',
    description: 'Lush detuned sawtooth pad with rich sustain',
    color: '#f59e0b', // amber
    octaveOffset: 0,
    synthOptions: {
      oscillator: {
        type: 'fatsawtooth',
        count: 2,
        spread: 15,
      },
      envelope: {
        attack: 0.02,
        decay: 0.4,
        sustain: 0.75,
        release: 1.2,
      },
    },
  },
  {
    id: 'deep-bass',
    number: 2,
    hotkeyLabel: '6',
    name: 'Deep Sub Bass',
    category: 'Basslines / Foundation',
    description: 'Thick FM sub bass punch tuned 1 octave down',
    color: '#06b6d4', // cyan
    octaveOffset: -1,
    synthOptions: {
      oscillator: {
        type: 'fmsine',
        modulationIndex: 3,
        harmonicity: 0.5,
      },
      envelope: {
        attack: 0.01,
        decay: 0.3,
        sustain: 0.6,
        release: 0.4,
      },
    },
  },
  {
    id: 'lofi-rhodes',
    number: 3,
    hotkeyLabel: '7',
    name: 'Lo-Fi Rhodes',
    category: 'Keys / Melodic',
    description: 'Vintage FM electric keys with mellow decay',
    color: '#a855f7', // violet
    octaveOffset: 0,
    synthOptions: {
      oscillator: {
        type: 'fmtriangle',
        harmonicity: 2,
      },
      envelope: {
        attack: 0.015,
        decay: 0.6,
        sustain: 0.4,
        release: 1.2,
      },
    },
  },
  {
    id: 'crystal-pluck',
    number: 4,
    hotkeyLabel: '8',
    name: 'Crystal Pluck',
    category: 'Arpeggios / Rhythm',
    description: 'Clean bell-like sine pluck with crisp transient',
    color: '#10b981', // emerald
    octaveOffset: 0,
    synthOptions: {
      oscillator: {
        type: 'sine',
      },
      envelope: {
        attack: 0.005,
        decay: 0.25,
        sustain: 0.1,
        release: 0.6,
      },
    },
  },
  {
    id: 'neon-lead',
    number: 5,
    hotkeyLabel: '9',
    name: 'Neon Lead',
    category: 'Melodies / Solos',
    description: 'Cutting stereo fatsquare lead with bright harmonics',
    color: '#f43f5e', // rose
    octaveOffset: 0,
    synthOptions: {
      oscillator: {
        type: 'fatsquare',
        count: 2,
        spread: 15,
      },
      envelope: {
        attack: 0.02,
        decay: 0.4,
        sustain: 0.7,
        release: 0.8,
      },
    },
  },
  {
    id: 'custom-sampler',
    number: 6,
    hotkeyLabel: '0',
    name: 'Auto-Pitch Sample',
    category: 'Mic / Audio Sampler',
    description: 'User recorded or uploaded audio automatically tuned to the active scale',
    color: '#ec4899', // pink
    octaveOffset: 0,
    isSamplerVoice: true,
    synthOptions: {
      oscillator: {
        type: 'sine',
      },
      envelope: {
        attack: 0.008,
        decay: 0.4,
        sustain: 0.8,
        release: 0.5,
      },
    },
  },
];
