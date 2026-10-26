export interface ScaleDef {
  id: string;
  name: string;
  mood: string;
  category: string;
  description: string;
  intervals: number[]; // semitone offsets from root
}

export const SCALE_CATEGORIES = [
  'Pentatonic & Soulful',
  'Pop, Lo-Fi & Electronic',
  'Japanese & East Asian',
  'World & Cinematic',
  'Jazz, Classical & Dream',
] as const;

export const SCALES: ScaleDef[] = [
  // 1. Pentatonic & Soulful
  {
    id: 'daydream',
    name: 'Daydream',
    mood: 'Major Pentatonic',
    category: 'Pentatonic & Soulful',
    description: 'Bright, warm, nostalgic 5-note scale — every key combination sounds harmonious',
    intervals: [0, 2, 4, 7, 9],
  },
  {
    id: 'midnight-soul',
    name: 'Midnight Soul',
    mood: 'Minor Pentatonic',
    category: 'Pentatonic & Soulful',
    description: 'Smooth R&B, neo-soul, hip-hop & synthwave minor groove',
    intervals: [0, 3, 5, 7, 10],
  },
  {
    id: 'smoky-blues',
    name: 'Smoky Blues',
    mood: 'Hexatonic Blues',
    category: 'Pentatonic & Soulful',
    description: 'Soulful minor pentatonic infused with the expressive flat-5 blue note',
    intervals: [0, 3, 5, 6, 7, 10],
  },
  {
    id: 'egyptian-oasis',
    name: 'Egyptian Oasis',
    mood: 'Suspended Pentatonic',
    category: 'Pentatonic & Soulful',
    description: 'Open, floating fourths and fifths with zero harsh tension',
    intervals: [0, 2, 5, 7, 10],
  },

  // 2. Pop, Lo-Fi & Electronic
  {
    id: 'pure-major',
    name: 'Pure Pop Major',
    mood: 'Natural Major / Ionian',
    category: 'Pop, Lo-Fi & Electronic',
    description: 'Classic uplifting 7-note major scale for pop, house & anthems',
    intervals: [0, 2, 4, 5, 7, 9, 11],
  },
  {
    id: 'velvet-minor',
    name: 'Velvet Melancholy',
    mood: 'Natural Minor / Aeolian',
    category: 'Pop, Lo-Fi & Electronic',
    description: 'Emotional, moody 7-note minor for modern pop, synthwave & electronic',
    intervals: [0, 2, 3, 5, 7, 8, 10],
  },
  {
    id: 'latenight',
    name: 'Late Night Lo-Fi',
    mood: 'Dorian Mode',
    category: 'Pop, Lo-Fi & Electronic',
    description: 'Jazzy minor with a warm raised 6th — signature chillhop & deep house vibe',
    intervals: [0, 2, 3, 5, 7, 9, 10],
  },
  {
    id: 'cinema',
    name: 'Cinema Uplift',
    mood: 'Lydian Mode',
    category: 'Pop, Lo-Fi & Electronic',
    description: 'Dreamy sci-fi wonder & film-score magic with a raised #4th',
    intervals: [0, 2, 4, 6, 7, 9, 11],
  },
  {
    id: 'sunset-groove',
    name: 'Sunset Groove',
    mood: 'Mixolydian Mode',
    category: 'Pop, Lo-Fi & Electronic',
    description: 'Funky, laid-back indie, disco & West Coast soul with a flat 7th',
    intervals: [0, 2, 4, 5, 7, 9, 10],
  },
  {
    id: 'dark-cyberpunk',
    name: 'Dark Cyberpunk',
    mood: 'Phrygian Mode',
    category: 'Pop, Lo-Fi & Electronic',
    description: 'Brooding dark club, techno & trap tension with a half-step flat 2nd',
    intervals: [0, 1, 3, 5, 7, 8, 10],
  },

  // 3. Japanese & East Asian
  {
    id: 'sakura',
    name: 'Sakura Zen',
    mood: 'In-Sen Pentatonic',
    category: 'Japanese & East Asian',
    description: 'Meditative Japanese koto & shakuhachi serenity',
    intervals: [0, 1, 5, 7, 10],
  },
  {
    id: 'kyoto-moonlight',
    name: 'Kyoto Moonlight',
    mood: 'Hirajoshi Scale',
    category: 'Japanese & East Asian',
    description: 'Crystalline, bittersweet traditional Japanese pentatonic melody',
    intervals: [0, 2, 3, 7, 8],
  },
  {
    id: 'okinawa-island',
    name: 'Okinawa Sun',
    mood: 'Ryukyu Scale',
    category: 'Japanese & East Asian',
    description: 'Sunny, heartwarming Okinawan island folk scale (Major 3rd + 4th + 7th)',
    intervals: [0, 4, 5, 7, 11],
  },
  {
    id: 'tokyo-festival',
    name: 'Tokyo Festival',
    mood: 'Yo Scale',
    category: 'Japanese & East Asian',
    description: 'Energetic, Spirited Away-style Japanese festival & folk pentatonic',
    intervals: [0, 2, 5, 7, 9],
  },

  // 4. World & Cinematic
  {
    id: 'desert-mirage',
    name: 'Desert Mirage',
    mood: 'Phrygian Dominant / Hijaz',
    category: 'World & Cinematic',
    description: 'Exotic Middle Eastern, Flamenco & epic desert soundtrack scale',
    intervals: [0, 1, 4, 5, 7, 8, 10],
  },
  {
    id: 'byzantine-palace',
    name: 'Byzantine Palace',
    mood: 'Double Harmonic Major',
    category: 'World & Cinematic',
    description: 'Mystical, high-drama ancient orchestral & surf-noir scale',
    intervals: [0, 1, 4, 5, 7, 8, 11],
  },
  {
    id: 'gypsy-nocturne',
    name: 'Gypsy Nocturne',
    mood: 'Hungarian Minor',
    category: 'World & Cinematic',
    description: 'Passionate, dark neo-classical minor with exotic raised 4th & 7th',
    intervals: [0, 2, 3, 6, 7, 8, 11],
  },

  // 5. Jazz, Classical & Dream
  {
    id: 'classical-drama',
    name: 'Classical Drama',
    mood: 'Harmonic Minor',
    category: 'Jazz, Classical & Dream',
    description: 'Baroque drama, dark melodic trap & Latin minor with a leading-tone 7th',
    intervals: [0, 2, 3, 5, 7, 8, 11],
  },
  {
    id: 'neosoul-velvet',
    name: 'Neo-Soul Velvet',
    mood: 'Melodic Jazz Minor',
    category: 'Jazz, Classical & Dream',
    description: 'Sophisticated modern jazz & lush R&B chord voicings',
    intervals: [0, 2, 3, 5, 7, 9, 11],
  },
  {
    id: 'dream-sequence',
    name: 'Dream Sequence',
    mood: 'Whole Tone (6-Note)',
    category: 'Jazz, Classical & Dream',
    description: 'Weightless, floating impressionist dreamscape with equal whole-step intervals',
    intervals: [0, 2, 4, 6, 8, 10],
  },
];

export const ROOT_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const NOTE_SEMITONES: Record<string, number> = {
  'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
  'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
  'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
};

export const SEMITONE_TO_NOTE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// 3 rows of 10 keys
export const ROW_TOP = ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP'];
export const ROW_MID = ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon'];
export const ROW_BOT = ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period', 'Slash'];

export const KEY_LABELS: Record<string, string> = {
  KeyQ: 'Q', KeyW: 'W', KeyE: 'E', KeyR: 'R', KeyT: 'T', KeyY: 'Y', KeyU: 'U', KeyI: 'I', KeyO: 'O', KeyP: 'P',
  KeyA: 'A', KeyS: 'S', KeyD: 'D', KeyF: 'F', KeyG: 'G', KeyH: 'H', KeyJ: 'J', KeyK: 'K', KeyL: 'L', Semicolon: ';',
  KeyZ: 'Z', KeyX: 'X', KeyC: 'C', KeyV: 'V', KeyB: 'B', KeyN: 'N', KeyM: 'M', Comma: ',', Period: '.', Slash: '/'
};

export interface KeyNoteInfo {
  code: string;
  label: string;
  row: 'top' | 'mid' | 'bot';
  index: number;
  note: string;
  midi: number;
  frequency: number;
  scaleDegree: number;
  chordNotes: string[];
}

/**
 * Calculates note name and frequency from root, scale, base octave, and key index.
 */
export function getScaleNote(
  root: string,
  scale: ScaleDef,
  baseOctave: number,
  index: number
): { note: string; midi: number; frequency: number } {
  const rootSemi = NOTE_SEMITONES[root] ?? 0;
  const numDegrees = scale.intervals.length;
  const octaveOffset = Math.floor(index / numDegrees);
  const degreeIndex = index % numDegrees;
  const interval = scale.intervals[degreeIndex];

  const totalSemi = rootSemi + interval;
  const noteName = SEMITONE_TO_NOTE[totalSemi % 12];
  const octave = baseOctave + octaveOffset + Math.floor(totalSemi / 12);
  const midi = 12 * (octave + 1) + (totalSemi % 12);
  const frequency = 440 * Math.pow(2, (midi - 69) / 12);

  return {
    note: `${noteName}${octave}`,
    midi,
    frequency
  };
}

/**
 * Builds the full mapping of keys to notes and chords based on root and scale.
 */
export function buildKeyboardMap(root: string, scale: ScaleDef): Map<string, KeyNoteInfo> {
  const map = new Map<string, KeyNoteInfo>();

  const rows: { codes: string[]; row: 'top' | 'mid' | 'bot'; baseOctave: number }[] = [
    { codes: ROW_TOP, row: 'top', baseOctave: 5 },
    { codes: ROW_MID, row: 'mid', baseOctave: 4 },
    { codes: ROW_BOT, row: 'bot', baseOctave: 3 },
  ];

  rows.forEach(({ codes, row, baseOctave }) => {
    codes.forEach((code, idx) => {
      const primary = getScaleNote(root, scale, baseOctave, idx);
      
      // Calculate triad chord: [idx, idx+2, idx+4] within scale
      const chordSecond = getScaleNote(root, scale, baseOctave, idx + 2);
      const chordThird = getScaleNote(root, scale, baseOctave, idx + 4);
      const chordNotes = [primary.note, chordSecond.note, chordThird.note];

      map.set(code, {
        code,
        label: KEY_LABELS[code] || code,
        row,
        index: idx,
        note: primary.note,
        midi: primary.midi,
        frequency: primary.frequency,
        scaleDegree: idx % scale.intervals.length + 1,
        chordNotes
      });
    });
  });

  return map;
}
