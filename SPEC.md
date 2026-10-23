# Master Specification: "AuraKeys Studio v2.0" — Solo Live-Looping PC Keyboard Synthesizer, Auto-Pitch Sampler & 16-Step Drum Machine

## 1. Role & Objective
**AuraKeys Studio v2.0** is a polyphonic synthesizer, **Auto-Pitch Microphone & File Sampler**, **4-Lane × 16-Step Interactive Drum Sequencer**, and **4-Track Real-Time Loop Station** designed to be played effortlessly on a standard PC keyboard by a solo user with **zero music theory knowledge**.

### Core Design Pillars
1. **No Wrong Notes (Harmonic Scale-Locking & Live Loop Re-Harmonization):** Keys are locked to harmonious musical scales. Changing the root key or scale dynamically transposes all recorded synth and sampler loops in real time.
2. **Auto-Pitch Microphone & File Sampler (`PitchDetector.ts` & `SamplerEngine.ts`):** Users can record any sound via microphone or install an audio file (`.wav`, `.mp3`, `.webm`, `.ogg`). Time-domain autocorrelation detects the fundamental frequency ($f_0$), trims leading silence, normalizes gain, and applies fine cents correction so `Tone.Sampler` plays the sound in concert pitch across all 30 scale keys and triad chords (Hotkey `0`), or assigns it to any Drum Machine pad.
3. **Interactive 4×16 Drum Machine (`DrumMachine.ts` & `DrumSequencerPanel.tsx`):** A mutable 4-lane × 16-step matrix (`Kick`, `Snare`, `Hi-Hat`, `Perc`) with Off/Normal/Accent step velocities, preset rhythm templates (`Lo-Fi Chill`, `Synthwave`, `Minimal Pulse`, `Metronome`), per-lane volume/mute, custom sample assignment, and live quantized finger-drumming pads (Hotkeys `` ` ``, `-`, `=`, `[`).
4. **Solo Real-Time Layering (4-Track Auto-Quantized Looper):** Users can record, overdub, mute, and layer 4 independent instrument or sampler tracks over the drum sequencer on a 16th-note (`16n`) grid.
5. **Intuitive Sound Shaping:** Macro controls (**Warmth**, **Space**, **Snap**, **Echo**) and an interactive **2D XY Mood Pad** with a 60fps waveform visualizer and `.webm` master audio export.

---

## 2. Project File Structure

```text
src/
├── audio/
│   ├── SynthEngine.ts         # Multi-voice Tone.js graph: 1 Live Synth/Sampler + 4 Track Synths/Samplers + Master FX
│   ├── LooperEngine.ts        # 4-Track quantized event recorder synced to Tone.Transport + real-time scale re-harmonizer
│   ├── DrumMachine.ts         # Interactive 4x16 step sequencer + procedural Tone.js drums + custom sample players
│   ├── PitchDetector.ts       # NSDF autocorrelation pitch detector, onset silence trimmer & normalizer
│   ├── SamplerEngine.ts       # Microphone recorder, file decoder, pitch analysis & drum pad router
│   ├── scales.ts              # Scale definitions & 3-row QWERTY keyboard-to-frequency mapping
│   └── presets.ts             # 5 synth voices + Preset 6 (Hotkey 0): Auto-Pitch Sample
├── components/
│   ├── TopBar.tsx             # Voice selector [5-9, 0], REC/INSTALL SAMPLE button, Key/Scale, BPM, Loop Bars, Export .webm
│   ├── LooperStation.tsx      # 4-Track visual looper cards with bar progress, Rec/Overdub/Mute/Clear/Volume
│   ├── BackingBeatBar.tsx     # Beat selector, 16-STEP SEQ toggle, PAD REC toggle, and live hit pads
│   ├── DrumSequencerPanel.tsx # Collapsible 4-lane x 16-step matrix with velocity accents & custom sample badges
│   ├── SamplerStudioModal.tsx # Mic record / file install modal with waveform preview, pitch badge & pad assignment
│   ├── VisualizerAndXY.tsx    # 60fps Canvas waveform + 2D XY Mood Pad + 4 Macro Sliders
│   ├── KeyboardGrid.tsx       # 3-row visual QWERTY keyboard with real-time active key & chord highlights
│   └── AudioUnlockModal.tsx   # Initial "Click to Launch AuraKeys Studio" overlay to unlock Web Audio Context
├── hooks/
│   └── usePCKeyboard.ts       # Global keydown/keyup listener for notes, chords, looper, sampler & drum pad hotkeys
└── App.tsx
```
