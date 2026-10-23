export interface ScaleDef {
  id: string;
  name: string;
  mood: string;
  intervals: number[]; // semitone offsets from root
}

export const SCALES: ScaleDef[] = [
  {
    id: 'daydream',
    name: 'Daydream',
    mood: 'Major Pentatonic',
    intervals: [0, 2, 4, 7, 9],
  },
  {
    id: 'latenight',
    name: 'Late Night Lo-Fi',
    mood: 'Dorian Mode',
    intervals: [0, 2, 3, 5, 7, 9, 10],
  },
  {
    id: 'sakura',
    name: 'Sakura Zen',
    mood: 'In-Sen / Hirajoshi',
    intervals: [0, 1, 5, 7, 10],
  },
  {
    id: 'cinema',
    name: 'Cinema Uplift',
    mood: 'Lydian Mode',
    intervals: [0, 2, 4, 6, 7, 9, 11],
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
