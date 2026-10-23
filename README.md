# AuraKeys Studio 🎹✨

> **Solo Live-Looping Synthesizer, Multi-Voice Sampler & 16-Step Drum Machine**  
> Play polyphonic harmonies, slice real human vocal chops, finger-drum, and build layered tracks in real-time on a standard PC keyboard — **with zero music theory required**.

[![React 18](https://img.shields.io/badge/React-18-blue.svg)](https://react.dev/)
[![Tone.js](https://img.shields.io/badge/Audio-Tone.js-orange.svg)](https://tonejs.github.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Bundler-Vite-purple.svg)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Style-Tailwind_CSS-38bdf8.svg)](https://tailwindcss.com/)

---

## 🌟 Key Highlights

- **Harmonic Scale-Locking ("No Wrong Notes")**:  
  Every key across 3 QWERTY octaves (Lead `Q-P`, Chords `A-;`, Bass `Z-/`) is locked to harmonious mood scales (*Daydream*, *Late Night Lo-Fi*, *Sakura Zen*, *Cinema Uplift*). Transpose root keys or switch scales dynamically — existing loops automatically re-harmonize in real time.
- **30 Real Human Vocal Sampler (Preset `0`)**:  
  Pre-loaded with 30 studio vocal chops mapped across the entire keyboard with real-time pitch autocorrection ($f_0$ NSDF pitch detection).
- **Auto-Pitch Mic & Audio File Sampler**:  
  Record your own voice or drop audio files (`.wav`, `.mp3`, `.ogg`, `.webm`). It trims silence, normalizes peak gain, detects pitch, and maps it across the keyboard or drum pads.
- **Interactive 4×16 Drum Sequencer**:  
  Real-time editable grid (`Kick`, `Snare`, `Hi-Hat`, `Perc`) with Normal/Accent step velocities, swing, per-lane volume/mute, and live quantized finger pads (`` ` ``, `-`, `=`, `[`).
- **4-Track Quantized Live Looper**:  
  Record, overdub, mute, and clear live loops synchronized on a 16th-note (`16n`) grid across 2, 4, or 8-bar cycles on `Tone.Transport`.
- **Sound Sculpting & 2D XY Mood Pad**:  
  Real-time filter cutoff, resonance, warmth, space (reverb), snap (attack), and echo (delay) with a 60 FPS audio waveform visualizer.
- **One-Click Master Export**:  
  Export full live performances directly to `.webm` audio in-browser.

---

## ⌨️ Performance Hotkeys & Controls

| Key | Function |
| :--- | :--- |
| `Space` | Play / Pause master audio transport |
| `Alt` / `'` / `]` | Sustain Pedal (hold to sustain active notes, or click to latch) |
| `Shift` (Hold/Toggle) | One-Finger Triad Chord Mode (Root + 3rd + 5th) |
| `1` – `4` | Toggle Record / Play / Overdub on Looper Tracks 1–4 |
| `Shift + 1..4` | Mute / Unmute Looper Tracks 1–4 |
| `Backspace` | Clear notes on currently active Looper Track |
| `5` – `9` | Switch Synth Presets (Chime Lead, Ambient Pad, 80s Brass, Pluck, Deep Sub) |
| `0` | Select Multi-Voice Vocal Sampler |
| `` ` ``, `-`, `=`, `[` | Live Quantized Finger-Drumming Pads (Kick, Snare, Hi-Hat, Perc) |
| `Tab` | Mute / Unmute backing drum machine |

---

## 🛠️ Quick Start

### Prerequisites
- Node.js 18+ & npm

### Installation & Run

```bash
# Clone the repository
git clone https://github.com/zak-yn/aurakeys-studio.git
cd aurakeys-studio

# Install dependencies
npm install

# Start Vite live development server
npm run dev
```

Visit `http://localhost:5173/` in your browser, click **"Click to Launch AuraKeys Studio"**, and start jamming!

### Production Build

```bash
npm run build
npm run preview
```

---

## 📂 Architecture & Project Structure

```text
aurakeys-studio/
├── public/
│   └── voices/                 # 30 real human voice samples (.ogg)
├── src/
│   ├── audio/
│   │   ├── SynthEngine.ts      # Polyphonic Tone.js multi-voice graph & master FX bus
│   │   ├── LooperEngine.ts     # 4-track quantized looper with live re-harmonization
│   │   ├── DrumMachine.ts      # 4x16 interactive step sequencer & procedural synths
│   │   ├── PitchDetector.ts    # Time-domain autocorrelation pitch detector & trimmer
│   │   ├── SamplerEngine.ts    # Multi-voice library, audio file decoder & key painter
│   │   ├── VoiceStorage.ts     # IndexedDB local audio caching
│   │   ├── AuraKeysHarness.ts  # Autonomous diagnostic test harness
│   │   ├── scales.ts           # Scale definitions & 3-row QWERTY mapping
│   │   └── presets.ts          # Curated synth voice definitions
│   ├── components/
│   │   ├── TopBar.tsx          # Presets, Key/Scale, BPM, Bars, Voice Studio, Export
│   │   ├── LooperStation.tsx   # 4-Track visual looper cards & progress playheads
│   │   ├── BackingBeatBar.tsx  # Beat selector, sequencer toggle, live drum pads
│   │   ├── DrumSequencerPanel.tsx # 4x16 step matrix with velocity accents
│   │   ├── SamplerStudioModal.tsx # Mic & file sampler + visual key mapper
│   │   ├── VisualizerAndXY.tsx # 60fps canvas waveform & 2D XY mood pad
│   │   ├── KeyboardGrid.tsx    # 3-row interactive visual QWERTY keyboard
│   │   └── AudioUnlockModal.tsx # Web Audio context unlock overlay
│   ├── hooks/
│   │   └── usePCKeyboard.ts    # Global key listeners & event dispatcher
│   ├── App.tsx                 # Root application state & layout
│   └── main.tsx
└── package.json
```

---

## 📄 License

MIT © [zak-yn](https://github.com/zak-yn)
