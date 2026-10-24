# AuraKeys Studio — Architectural Specification & Agent Guide

Single Source of Truth for **AuraKeys Studio v2.5**: a polyphonic live synthesizer, **Multi-Voice Keymapping Sampler**, **Auto-Pitch Microphone & File Sampler**, **4-Lane × 16-Step Interactive Drum Machine**, and **4-Track Real-Time Quantized Loop Station** designed for solo keyboard play with zero music theory required.

---

## 1. Project Concept & User Objective
- **Harmonic Scale Locking & Real-Time Loop Re-Harmonization**: PC keys mapped strictly to harmonious scales (Daydream, Late Night Lo-Fi, Sakura Zen, Cinema Uplift) across 3 octaves (Lead/Highs [Q-P], Chords [A-;], Bass [Z-/]). Changing Key or Scale dynamically transposes all existing recorded synth and sampler loops.
- **30 Real Human Voice Sampler (Preset [0])**: Pre-loaded with 30 real human vocal clips (`public/voices/*.ogg`) mapped across 100% of the QWERTY keyboard (Lead row [Q-P]: *Hey, Yeah, Go, Fire, Drop, Power, Dance, Play, Alright, Yes*; Mid row [A-;]: *Hello, Listen, Music, Love, Heart, Soul, Sing, Dream, Sound, Voice*; Bass row [Z-/]: *One, Two, Three, Four, Bass, Beat, Drum, Touch, Night, Baby*). Autocorrelation ($f_0$) pitch detection transposes every word harmonically to any scale note.
- **Auto-Pitch Microphone & File Sampler**: Record live audio via microphone or install any local audio file (`.wav`, `.mp3`, `.webm`, `.ogg`). Fine-tunes to the nearest cent so it plays harmonically across the scale or assigns to any Drum Machine pad.
- **Interactive 4×16 Drum Machine**: Editable 4-lane × 16-step matrix (`Kick`, `Snare`, `Hi-Hat`, `Perc`) with Normal/Accent velocity states, per-lane mute/volume, custom sample assignment, and live quantized finger-drumming pads (`[ ` - = [ ]`).
- **4-Track Quantized Live Looper**: Real-time layer recording, overdubbing, muting, and clearing synced to a 16th-note (`16n`) grid across 2/4/8-bar cycles on `Tone.Transport`.
- **Master Audio Export**: One-click in-browser recording via `Tone.Recorder` downloading `.webm`.

---

## 2. Architecture & Tech Stack
- **Framework**: React 18 + Vite + TypeScript
- **Audio Engine**: `tone` (Tone.js v14.8+) + Web Audio API
- **Persistence**: IndexedDB (`VoiceStorage.ts`) storing Float32Array channel data, pitch metadata, and QWERTY key mappings
- **Styling & UI**: Tailwind CSS v3, `lucide-react`, custom Web Audio canvas visualizer
- **Dev Server**: Vite running on `http://localhost:5188/` (host: true)
- **GitHub Repository**: `https://github.com/zak-yn/aurakeys-studio`

---

## 3. Directory Structure & Responsibilities
```text
public/
└── voices/                    # 30 real human voice sample files (.ogg)
src/
├── audio/
│   ├── SynthEngine.ts         # Zero-leak native Web Audio graph: NativePolySynth (live + 4 tracks), DirectSamplePlayer + Master FX
│   ├── LooperEngine.ts        # 4-Track quantized event recorder synced to Tone.Transport (16n tick) + zero-alloc tick loop
│   ├── DrumMachine.ts         # 4-Lane x 16-Step drum sequencer + studio pre-rendered AudioBuffer synths + custom sample players
│   ├── PitchDetector.ts       # Time-domain NSDF autocorrelation f0 pitch detector, silence trimmer & peak normalizer
│   ├── SamplerEngine.ts       # Multi-Voice library manager, O(1) voice lookup map, deduplicated init & debounced IndexedDB save
│   ├── VoiceStorage.ts        # IndexedDB persistence layer for recorded voice buffers and keyVoiceMap
│   ├── AuraKeysHarness.ts     # Autonomous AI Diagnostic Harness (Tests 1-6), polyphony stress testing & acoustic RMS/clip analysis
│   ├── scales.ts              # Mood scales, note calculation, and 3-row QWERTY code mapping
│   └── presets.ts             # 5 curated synth voices + Preset 6 (Hotkey 0): Multi-Voice Sampler
├── components/
│   ├── TopBar.tsx             # Presets [5-9, 0], VOICE STUDIO & MAPPER, AI TEST button, Key/Scale, BPM, Bars, Export
│   ├── AIDiagnosticModal.tsx  # Self-test runner modal: single-note hold, polyphony capture, clock drift, multi-voice verification
│   ├── LooperStation.tsx      # Memoized 4-Track visual looper cards with isolated playhead layer, Rec/Ovd/Mute/Clear
│   ├── BackingBeatBar.tsx     # Beat selector, 16-STEP SEQ toggle, PAD REC toggle, and live hit pads
│   ├── DrumSequencerPanel.tsx # Expandable 4x16 interactive step grid, velocity accents, per-lane mute/vol & sample badge
│   ├── SamplerStudioModal.tsx # Multi-Voice Studio & Key Mapper modal, waveform display, root pitch selector, and row mappers
│   ├── VisualizerAndXY.tsx    # 30fps throttled waveform canvas (idle-silence bypass) + 2D XY Mood Pad + 4 Macros
│   ├── KeyboardGrid.tsx       # Per-key React.memo visual keyboard with O(1) multi-voice color badges and paint mode
│   └── AudioUnlockModal.tsx   # Initial Web Audio unlock modal (Tone.start())
├── hooks/
│   └── usePCKeyboard.ts       # Global keydown/keyup listener with rAF batched activeKey updates and repeat rejection
└── App.tsx                    # Root state orchestration, paint mode handlers, and responsive dashboard layout
```

---

## 4. Key Performance Hotkeys & Controls
- `Space`: Master Transport Play / Pause toggle
- `Alt` (`AltLeft` / `AltRight`) or `'` (`Quote`) / `]` (`BracketRight`): Sustain Pedal (hold to sustain active notes, or click `SUSTAIN: [ALT / ']` to latch)
- `1` – `4`: Toggle Rec -> Play -> Overdub on Looper Tracks 1–4
- `Shift + 1..4`: Toggle Mute on Looper Tracks 1–4
- `5` – `9`: Switch Live Synth Presets 1–5
- `0`: Select **Multi-Voice Sampler** Voice (Preset 6)
- `` ` ``, `-`, `=`, `[`: Trigger Live Drum Pads (`Kick`, `Snare`, `Hi-Hat`, `Perc`)
- `Shift` (Hold / Toggle): One-Finger Triad Chord Mode (plays root + 3rd + 5th in scale; voices play solo root to prevent speech mud)
- `Tab`: Toggle Backing Drum Beat Mute
- `Backspace`: Clear notes on currently active Looper Track

---

## 5. Changelog
- **2026-10-24 (v2.5.10)**: Docked Voice Palette Bar, 1-Click Row/Keyboard Fills & Inline Voice Renaming.
  - **Docked Voice Palette Bar (`KeyboardGrid.tsx`, `SamplerEngine.ts`)**: Added an always-accessible voice brush & quick-mapper bar directly above the keyboard whenever Preset `[0]` (`Multi-Voice`) or Paint Mode is active. Users can switch voice brushes (`#docked-voice-chip-*`), toggle click/swipe painting (`#btn-docked-toggle-paint`), drag across keys to swipe-paint, or click **`[FILL ALL 30 KEYS]`**, **`[Fill High]`**, **`[Fill Mid]`**, **`[Fill Bass]`**, **`[30-Word Map]`**, or **`[Clear]`** directly on the main screen without modal hopping.
  - **Inline Voice Renaming (`SamplerStudioModal.tsx`, `KeyboardGrid.tsx`, `SamplerEngine.ts`)**: Added `SamplerEngine.renameVoice()` and inline rename controls (`#btn-rename-voice-*`, `#btn-docked-rename-voice`, `#btn-feedback-rename-now`). Clicking a voice name or pencil icon opens an inline text input (`Enter` to save, `Esc` to cancel) that updates all keyboard key badges and IndexedDB immediately.
  - **Top-of-Library Placement (`SamplerEngine.ts`)**: Newly recorded microphone phrases and uploaded audio files are inserted at index 0 (`unshift`) so they appear first in both the Docked Voice Palette Bar and Voice Studio modal.
- **2026-10-24 (v2.5.9)**: Low-Spec Laptop Performance & Native Web Audio Engine Overhaul.
  - **Eliminated Tone.js v14 `Oscillator._start` Signal Fan-Out Leak (`SynthEngine.ts`, `DrumMachine.ts`)**: Bypassed Tone.js `PolySynth(Tone.Synth)`, `MembraneSynth`, `NoiseSynth`, and 12-oscillator `MetalSynth` which leaked `Tone.Signal` -> `AudioParam` references on every note/drum trigger and caused progressive audio thread crackling after 1–2 minutes of play.
  - **Zero-Leak `NativePolySynth` & `DirectSamplePlayer` (`SynthEngine.ts`)**: Built direct C++ Web Audio `OscillatorNode` + `GainNode` ADSR polyphonic synths (unison detuned saw, sub-octave triangle, FM sine, warm triangle) and direct `AudioBufferSourceNode` sample players with 0 idle nodes, click-free 5ms–8ms micro-fades, complete `.disconnect()` cleanup in `onended`, and O(1) cached frequency/MIDI lookups.
  - **Pre-Rendered Studio Drum Buffers (`DrumMachine.ts`)**: Replaced 11 persistent Tone.js drum synths (~75 continuous nodes) with studio-grade pre-rendered `AudioBuffer`s synthesized at startup (`< 2ms`) and triggered via lightweight `AudioBufferSourceNode`s with 5ms choke.
  - **Master Bus Pitch Stability & CPU Reduction (`SynthEngine.ts`)**: Removed the always-on series `Tone.Chorus` (eliminating 1.5Hz LFO pitch wobble on synths, bass, and vocals) and shortened `Tone.Reverb` IR decay (`2.0s` -> `1.1s`, ~45% lower convolution CPU).
  - **React & GPU Rendering Optimization (`LooperStation.tsx`, `KeyboardGrid.tsx`, `VisualizerAndXY.tsx`, `App.tsx`)**: Isolated 16th-note playheads from static timeline grids via `React.memo`, added per-key `KeyboardKeyButton` memoization with O(1) `Map` lookups, throttled canvas visualizer to 30fps with an idle-silence fast path, and removed 11 redundant `backdrop-blur` GPU layers.
- **2026-10-24 (v2.5.8)**: Official GitHub Repository & Clean Source Release.
  - **GitHub Remote (`https://github.com/zak-yn/aurakeys-studio`)**: Created public repository under `zak-yn`, initialized Git tracking on `main` branch, and pushed all core source files and 30 vocal sample assets.
  - **Repository Documentation**: Authored comprehensive `README.md` with visual badges, performance keymaps, audio architecture, and setup instructions, along with clean `.gitignore`.
- **2026-10-24 (v2.5.7)**: 30 Real Human Voice Sample Library & 100% Key Registration.
  - **30 Free Real Human Voice Audio Clips (`public/voices/*.ogg`)**: Sourced and packaged 30 CC0 / Public Domain native vocal clips into `public/voices/`, replacing synthetic sine waveforms.
  - **Full Keyboard Registration**: All 30 keys on the QWERTY keyboard now have dedicated human vocal voices mapped out-of-the-box (Top [Q-P]: *Hey, Yeah, Go, Fire, Drop, Power, Dance, Play, Alright, Yes*; Mid [A-;]: *Hello, Listen, Music, Love, Heart, Soul, Sing, Dream, Sound, Voice*; Bass [Z-/]: *One, Two, Three, Four, Bass, Beat, Drum, Touch, Night, Baby*). Zero unmapped or silent keys.
  - **Seamless Legacy Migration (`SamplerEngine.ts`)**: Upgrades existing browser sessions from the legacy 2-sample kit to the full 30-voice library on startup or reset.
- **2026-10-24 (v2.5.6)**: Keyboard Voice Badge Visibility & Key Dimension Refinement.
  - **Voice Badge Layout & Typography (`KeyboardGrid.tsx`)**: Replaced cramped, overflowing voice text tags with crisp, high-contrast badges (`text-white/95`, `font-semibold`, `px-1.5 py-1`, colored border + bullet) with `shrink-0` to eliminate vertical squishing.
  - **Key Ergonomics & Height (`KeyboardGrid.tsx`)**: Upgraded button height from invalid `h-14 sm:h-17` (which defaulted to 56px) to a spacious, balanced `h-[80px] sm:h-[88px] min-h-[80px]`, providing comfortable breathing room for key labels, voice names, and note values.
  - **Unmapped Sampler Key State (`KeyboardGrid.tsx`)**: Displayed subtle `—` unmapped indicator during Preset `[0]` to immediately differentiate mapped voice keys from silent keys.
- **2026-10-22 (v2.5.5)**: Acoustic Warmth, 16-Voice Polyphony & Noise Elimination Restoration.
  - **Restored 16/12-Voice Polyphony (`SynthEngine.ts`)**: Doubled live synth polyphony from 8 back to 16 (and track synths to 12). Eliminated premature voice-stealing chopping and abrupt note truncation clicks during chord changes and sustain pedal play.
  - **45ms Tight Responsive Lookahead (`SynthEngine.ts`)**: Restored `Tone.context.lookAhead` to `0.045s` (45ms), removing sluggish ~100ms key-press latency and restoring smooth real-time performance feel.
  - **Limiter Pumping Elimination & Bus Balancing (`SynthEngine.ts`, `DrumMachine.ts`)**: Resolved master bus routing mismatch where isolated attenuation caused aggressive limiter ducking and distortion. Restored punchy drum acoustics (`+1 dB` snare body, `+2 dB` snare wires, `-6 dB` master).
  - **Click-Free Attack Envelope Smoothing (`SynthEngine.ts`)**: Calibrated min attack envelope to 5ms while preserving preset decay and sustain ratios, eliminating Dirac impulse click/pop noise.
- **2026-10-21 (v2.5.4)**: Performance & Render Loop Optimization (rAF step dispatch, memoized panels, static buffer visualizer).
- **2026-10-21 (v2.5.3)**: DAW Transport Spacebar Shortcut & Ergonomic Dual-Pedal Sustain.
  - **Transport Spacebar Toggle (`usePCKeyboard.ts`, `TopBar.tsx`)**: Reassigned `Space` key to Master Transport Play / Pause toggle matching industry-standard DAW conventions (Ableton, Logic, Pro Tools). Added `SPACE` badge indicator on `#btn-toggle-transport`. Guarded all text inputs and textareas from accidental triggers.
  - **Ergonomic Sustain Pedal (`usePCKeyboard.ts`, `KeyboardGrid.tsx`)**: Reassigned sustain to `Alt` (`AltLeft` / `AltRight` - thumb pedal adjacent to Space) and `'` (`Quote` / `BracketRight` - right-hand pinky pedal). Added interactive click-to-latch `#btn-toggle-sustain` button with status glow and updated hotkey legends.
- **2026-10-21 (v2.5.2)**: Studio Pre-Roll Countdown & Metronome Audio Lead-in.
  - **Pre-Roll Countdown (`SamplerStudioModal.tsx`)**: Added automated lead-in timer before microphone recording (`3s` default, `1s`, or `OFF` selectable).
  - **Metronome Audio Blip**: Zero-latency Web Audio oscillator metronome beeps on each second (880Hz ticks and 1760Hz start cue) so musicians can prepare without looking at the screen.
  - **Countdown Visual Strip & Cancel**: Displays animated countdown badge, status description, and 1-click cancel button to abort lead-in anytime.
- **2026-10-21 (v2.5.1)**: Fix Recorded Voice Paint Mode & Multi-Subscriber Event Architecture.
  - **Subscriber Pattern in `SamplerEngine.ts`**: Replaced single-callback `onVoicesUpdated` with a multi-subscriber Set pattern (`subscribeVoices`, `subscribePaintVoice`, `subscribeSample`, `subscribeMicLevel`). Resolved the callback clobbering bug where `SamplerStudioModal` unmounting detached `App.tsx`'s state updates.
  - **Paint Mode Trigger Fix (`SamplerStudioModal.tsx`, `KeyboardGrid.tsx`)**: Newly recorded microphone phrases and uploaded files now immediately set `activePaintVoiceId`, display a prominent `[PAINT "..." TO KEYS]` button in the modal, and launch the paint mode banner on the dashboard.
  - **IndexedDB Performance (`VoiceStorage.ts`)**: Replaced slow synchronous `number[]` array cloning with native `Float32Array` structured cloning, eliminating UI stutter on sample persistence.
- **2026-10-21 (v2.5)**: Multi-Voice Keymapping Sampler & IndexedDB Kit Persistence.
  - **Multi-Voice Sampler Bank (`SamplerEngine.ts`, `SynthEngine.ts`)**: Replaced single-sample engine with a multi-voice pool of `Tone.Sampler` instances. Users can record or upload multiple vocal phrases ("Hello", "Thank You", etc.), assign individual root pitches (`C1`–`B5`) or rely on autocorrelation $f_0$, and pitch-shift to any target keyboard note.
  - **"Paint to Key" Visual Keymapper (`KeyboardGrid.tsx`, `SamplerStudioModal.tsx`)**: Click any voice tag (Cyan, Amber, Emerald, Violet, Rose, Sky) to activate paint mode and assign voices to individual keys or entire keyboard rows. Keys render sleek colored badges. Unmapped keys remain silent in Preset `[0]`.
  - **Single-Voice Solo Chord Guard & Per-Key Choke**: Pressing keys in Chord Mode (`Shift`) triggers only a clean solo vocal line to eliminate speech mud. Rapid re-tapping chokes previous hits of that key cleanly.
  - **IndexedDB Kit Persistence (`VoiceStorage.ts`)**: Automatically saves audio buffers, pitch analysis data, and key mappings across browser reloads with 1-click factory reset.
  - **AI Diagnostic Harness Expansion (`AuraKeysHarness.ts`)**: Added Test 6 asserting multi-voice mapping integrity, root note calibration, and silent unmapped key behavior.
- **2026-10-20 (v2.4)**: Rapid Key Re-Triggering, Voice Recycling & Dual-Voice Drum Roll Overhaul.
- **2026-10-20 (v2.3)**: Snare Acoustic Body Architecture, Hi-Hat Rebalancing & Anti-Masking Fix.
- **2026-10-20 (v2.2)**: Autonomous AI Self-Feedback Test Harness & Multi-Key Performance Overhaul.
- **2026-10-18 (v2.0)**: Interactive 16-Step Drum Machine & Auto-Pitch Microphone/File Sampler.
- **2026-10-15 (v1.0)**: Initial production release.
