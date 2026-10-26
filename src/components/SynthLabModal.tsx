import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Sliders,
  Sparkles,
  Save,
  Trash2,
  Volume2,
  Wand2,
  Layers,
  Activity,
  Info,
} from 'lucide-react';
import {
  PresetConfig,
  PRESET_CATEGORIES,
  deepClonePreset,
  generateSmartPreset,
} from '../audio/presets';
import { SynthEngine } from '../audio/SynthEngine';

interface SynthLabModalProps {
  isOpen: boolean;
  onClose: () => void;
  allPresets: PresetConfig[];
  currentPreset: PresetConfig;
  pinnedPresetIds: string[];
  onSelectPreset: (preset: PresetConfig) => void;
  onUpdateLivePreset: (preset: PresetConfig) => void;
  onSaveCustomPreset: (preset: PresetConfig) => void;
  onDeleteCustomPreset: (presetId: string) => void;
  onPinPresetToHotkey: (slotIndex: number, presetId: string) => void;
}

const OSC_TYPES: { value: PresetConfig['synthOptions']['oscillator']['type']; label: string }[] = [
  { value: 'fatsawtooth', label: 'SuperSaw (Unison Detune)' },
  { value: 'fatsquare', label: 'Fat Pulse / Square (Unison)' },
  { value: 'fattriangle', label: 'Warm Unison Triangle' },
  { value: 'fmsine', label: 'FM Glass / Bell Sine' },
  { value: 'fmtriangle', label: 'FM Electric Piano / Rhodes' },
  { value: 'fmsawtooth', label: 'FM Pluck / Koto Harmonics' },
  { value: 'sawtooth', label: 'Pure Analog Sawtooth' },
  { value: 'square', label: '8-Bit Chiptune Square' },
  { value: 'triangle', label: 'Soft Pure Triangle' },
  { value: 'sine', label: 'Pure Sub / Whistle Sine' },
];

export const SynthLabModal: React.FC<SynthLabModalProps> = ({
  isOpen,
  onClose,
  allPresets,
  currentPreset,
  pinnedPresetIds,
  onSelectPreset,
  onUpdateLivePreset,
  onSaveCustomPreset,
  onDeleteCustomPreset,
  onPinPresetToHotkey,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [draft, setDraft] = useState<PresetConfig>(() => deepClonePreset(currentPreset));
  const [customName, setCustomName] = useState<string>(currentPreset.name);
  const [saveBanner, setSaveBanner] = useState<string | null>(null);
  const [isAutoAudition, setIsAutoAudition] = useState<boolean>(true);
  const previewTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (currentPreset.isSamplerVoice) {
      const firstSynth = allPresets.find((p) => !p.isSamplerVoice);
      if (firstSynth) {
        onSelectPreset(firstSynth);
        setDraft(deepClonePreset(firstSynth));
        setCustomName(firstSynth.name);
      }
    } else {
      setDraft(deepClonePreset(currentPreset));
      setCustomName(currentPreset.name);
    }
  }, [currentPreset.id, isOpen]);

  if (!isOpen) return null;

  const synthPresets = allPresets.filter((p) => !p.isSamplerVoice);
  const filteredPresets = synthPresets.filter((p) => {
    if (selectedCategory === 'All') return true;
    if (selectedCategory === 'Custom User') return Boolean(p.isCustom || p.category === 'Custom User');
    return p.category === selectedCategory;
  });

  const playPreviewForPreset = (presetToPlay: PresetConfig, note = 'C4') => {
    const engine = SynthEngine.getInstance();
    if (!engine.isReady || !engine.liveSynth) return;
    engine.setLivePreset(presetToPlay, false);
    const notes = engine.transposeNotes([note, 'E4', 'G4'], presetToPlay.octaveOffset);
    engine.liveSynth.triggerAttackRelease(notes, 0.42);
  };

  const scheduleAutoPreview = (presetToPlay: PresetConfig) => {
    if (!isAutoAudition) return;
    if (previewTimeoutRef.current) {
      window.clearTimeout(previewTimeoutRef.current);
    }
    previewTimeoutRef.current = window.setTimeout(() => {
      playPreviewForPreset(presetToPlay, 'C4');
    }, 60);
  };

  const applyDraftChange = (updater: (next: PresetConfig) => void, autoPreview = false) => {
    const next = deepClonePreset(draft);
    next.isSamplerVoice = false;
    updater(next);
    setDraft(next);
    onUpdateLivePreset(next);
    if (autoPreview) {
      scheduleAutoPreview(next);
    }
  };

  const handleAuditionNote = (note = 'C4') => {
    playPreviewForPreset(draft, note);
  };

  const handleSmartGenerate = (archetype: 'bass' | 'pad' | 'pluck' | 'lead' | 'bell' | 'mutate') => {
    const generated = generateSmartPreset(archetype, draft);
    setDraft(generated);
    setCustomName(generated.name);
    onUpdateLivePreset(generated);
    setTimeout(() => playPreviewForPreset(generated, 'C4'), 20);
  };

  const handleSavePatch = () => {
    const cleanName = customName.trim() || 'Custom Sound';
    const isUpdatingExistingCustom = draft.isCustom && draft.name === cleanName;
    const savedPatch: PresetConfig = {
      ...deepClonePreset(draft),
      id: isUpdatingExistingCustom ? draft.id : `custom-${Date.now().toString(36)}`,
      name: cleanName,
      category: 'Custom User',
      isCustom: true,
    };
    onSaveCustomPreset(savedPatch);
    setDraft(savedPatch);
    setSaveBanner(`Saved "${cleanName}" to Custom User Library!`);
    setTimeout(() => setSaveBanner(null), 2800);
  };

  const osc = draft.synthOptions.oscillator;
  const env = draft.synthOptions.envelope;
  const sub = draft.synthOptions.subOsc || {
    enabled: false,
    type: 'sine' as const,
    octaveOffset: -1 as const,
    mix: 0.3,
  };
  const noise = draft.synthOptions.noise || {
    enabled: false,
    type: 'pink' as const,
    mix: 0.08,
    decay: 0.03,
  };
  const flt = draft.synthOptions.filter || {
    enabled: false,
    type: 'lowpass' as const,
    cutoffHz: 2400,
    resonanceQ: 1.5,
    envAmountHz: 1800,
    envDecay: 0.25,
  };
  const pitchEnv = draft.synthOptions.pitchEnv || {
    enabled: false,
    semitones: 5,
    decay: 0.04,
  };
  const vibrato = draft.synthOptions.vibrato || {
    enabled: false,
    rateHz: 4.5,
    depthCents: 10,
  };

  const isFat = osc.type.startsWith('fat');
  const isFM = osc.type.startsWith('fm');

  return (
    <div
      id="synth-lab-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-5 overflow-y-auto"
    >
      <div
        id="synth-lab-modal"
        className="w-full max-w-6xl bg-[#0d1018] border border-white/15 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Top Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-[#121622] border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
              <Sliders className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
                  SYNTH LAB &amp; 30+ PRESET STUDIO
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  LIVE KEYBOARD ACTIVE — PLAY [Q–/] WHILE EDITING
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Browse 30 multi-layer studio instruments, pin favorites to hotkeys [5]–[9], or sculpt &amp; generate your own custom sounds.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              id="btn-synth-lab-auto-audition"
              onClick={() => setIsAutoAudition((prev) => !prev)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-mono text-[11px] font-semibold border cursor-pointer transition-colors ${
                isAutoAudition
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
              }`}
              title="Automatically play a preview chord whenever you change a setting or release a slider"
            >
              <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>AUTO-PREVIEW: {isAutoAudition ? 'ON' : 'OFF'}</span>
            </button>
            <button
              id="btn-synth-lab-audition"
              onClick={() => handleAuditionNote('C4')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-500/40 font-mono text-xs font-bold cursor-pointer"
            >
              <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>AUDITION CHORD</span>
            </button>
            <button
              id="btn-close-synth-lab"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 cursor-pointer"
              title="Close Synth Lab"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main 2-Column Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 min-h-0 overflow-hidden">
          {/* LEFT PANE (5 cols): Categorized 30+ Preset Browser & Hotkey Pinning */}
          <div className="lg:col-span-5 border-b lg:border-b-0 lg:border-r border-white/10 flex flex-col min-h-0 bg-[#0a0d14]">
            {/* Category Filter Pills */}
            <div className="p-3 border-b border-white/5 flex flex-wrap gap-1">
              {PRESET_CATEGORIES.map((cat) => {
                const active = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    id={`btn-preset-cat-${cat.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2 py-1 rounded-md font-mono text-[10px] font-semibold transition-colors cursor-pointer border ${
                      active
                        ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                        : 'bg-white/[0.03] border-white/10 text-slate-400 hover:text-white hover:bg-white/[0.07]'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            {/* Scrollable Preset List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {filteredPresets.map((preset) => {
                const isSelected = draft.id === preset.id;
                const pinnedSlotIdx = pinnedPresetIds.indexOf(preset.id);

                return (
                  <div
                    key={preset.id}
                    id={`synth-lab-preset-row-${preset.id}`}
                    onClick={() => {
                      onSelectPreset(preset);
                      setDraft(deepClonePreset(preset));
                      setCustomName(preset.name);
                    }}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                      isSelected
                        ? 'bg-[#171c2b] border-amber-400/70'
                        : 'bg-[#111520] border-white/5 hover:border-white/15 hover:bg-[#141926]'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: preset.color }}
                        />
                        <span className="font-mono text-xs font-bold text-white truncate">
                          {preset.name}
                        </span>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-slate-400 border border-white/5">
                          {preset.category}
                        </span>
                        {pinnedSlotIdx !== -1 && (
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                            HOTKEY [{pinnedSlotIdx + 5}]
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {preset.description}
                      </p>
                    </div>

                    {/* Pin to Hotkeys [5]-[9] + Delete Custom */}
                    <div
                      className="flex items-center gap-1 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {[0, 1, 2, 3, 4].map((slotIdx) => {
                        const hotkeyNum = slotIdx + 5;
                        const isPinnedHere = pinnedSlotIdx === slotIdx;
                        return (
                          <button
                            key={hotkeyNum}
                            id={`btn-pin-${preset.id}-slot-${hotkeyNum}`}
                            onClick={() => onPinPresetToHotkey(slotIdx, preset.id)}
                            className={`w-5 h-5 rounded text-[10px] font-mono font-bold border transition-colors cursor-pointer flex items-center justify-center ${
                              isPinnedHere
                                ? 'bg-amber-400 text-slate-950 border-amber-300'
                                : 'bg-black/40 text-slate-500 border-white/10 hover:text-white hover:border-white/30'
                            }`}
                            title={`Pin "${preset.name}" to TopBar Hotkey [${hotkeyNum}]`}
                          >
                            {hotkeyNum}
                          </button>
                        );
                      })}

                      {preset.isCustom && (
                        <button
                          id={`btn-delete-custom-${preset.id}`}
                          onClick={() => onDeleteCustomPreset(preset.id)}
                          className="p-1 rounded bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 ml-1 cursor-pointer"
                          title="Delete custom preset"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT PANE (7 cols): Multi-Layer Sound Designer & Smart Generator */}
          <div className="lg:col-span-7 flex flex-col min-h-0 overflow-y-auto p-4 space-y-4">
            {/* 1. Smart 1-Click Sound Generator Bar */}
            <div className="p-3 rounded-xl bg-[#131826] border border-amber-500/25 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase tracking-wider text-amber-300 font-bold flex items-center gap-1.5">
                  <Wand2 className="w-3.5 h-3.5 text-amber-400" />
                  1-Click Smart Sound Generator (Instant Inspiration)
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  Generates musical patches automatically
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    { id: 'bass', label: '+ Generate Bass / 808', color: 'cyan' },
                    { id: 'pad', label: '+ Generate Lush Pad', color: 'amber' },
                    { id: 'pluck', label: '+ Generate Pluck / Koto', color: 'emerald' },
                    { id: 'lead', label: '+ Generate Synth Lead', color: 'rose' },
                    { id: 'bell', label: '+ Generate FM Bell', color: 'sky' },
                    { id: 'mutate', label: 'Sparkle Mutate Current', color: 'purple' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    id={`btn-smart-gen-${item.id}`}
                    onClick={() => handleSmartGenerate(item.id)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/15 text-xs font-mono font-semibold text-white cursor-pointer transition-colors"
                  >
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Save / Name Custom Patch Bar */}
            <div className="p-3 rounded-xl bg-[#111520] border border-white/10 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                <span className="text-xs font-mono text-slate-400">Patch Name:</span>
                <input
                  id="input-synth-lab-patch-name"
                  type="text"
                  value={customName}
                  maxLength={32}
                  onChange={(e) => setCustomName(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  className="flex-1 bg-black/60 border border-white/15 focus:border-amber-400 rounded-lg px-2.5 py-1 text-xs font-mono font-bold text-white focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  id="btn-save-custom-preset"
                  onClick={handleSavePatch}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-500/40 font-mono text-xs font-bold cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5 text-emerald-400" />
                  <span>SAVE AS CUSTOM PRESET</span>
                </button>
              </div>
            </div>

            {saveBanner && (
              <div className="px-3 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs font-mono font-bold">
                {saveBanner}
              </div>
            )}

            {/* 3. Primary Oscillator & Octave */}
            <div className="p-3.5 rounded-xl bg-[#111520] border border-white/10 space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-mono font-bold uppercase text-cyan-300 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  1. Primary Oscillator &amp; Harmonics
                </span>
                <div className="flex items-center gap-1.5 font-mono text-[11px]">
                  <span className="text-slate-400">Base Octave:</span>
                  {([-2, -1, 0, 1] as const).map((oct) => (
                    <button
                      key={oct}
                      id={`btn-osc-octave-${oct}`}
                      onClick={() =>
                        applyDraftChange((next) => {
                          next.octaveOffset = oct;
                        }, true)
                      }
                      className={`px-2 py-0.5 rounded border cursor-pointer ${
                        draft.octaveOffset === oct
                          ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200 font-bold'
                          : 'bg-black/40 border-white/10 text-slate-400 hover:text-white'
                      }`}
                      title={`Shift the entire instrument ${oct === 0 ? 'to standard pitch' : `${oct} octaves`}`}
                    >
                      {oct > 0 ? `+${oct}` : oct}
                    </button>
                  ))}
                </div>
              </div>

              <div
                id="hint-section-oscillator"
                className="flex items-start gap-2 px-2.5 py-1.5 rounded-lg bg-cyan-500/[0.06] border border-cyan-500/20 text-[11px] text-slate-300 leading-snug"
              >
                <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-cyan-200">Hint:</strong> The core sound generator. Pick{' '}
                  <span className="text-white font-semibold">SuperSaw / Unison</span> for thick, wide synth waves,{' '}
                  <span className="text-white font-semibold">FM</span> for glassy bells &amp; Rhodes keys, or{' '}
                  <span className="text-white font-semibold">Pure</span> for clean retro leads &amp; subs.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono text-slate-300 font-semibold block mb-1">
                    Oscillator Waveform Engine
                  </label>
                  <select
                    id="select-synth-osc-type"
                    value={osc.type}
                    onChange={(e) => {
                      e.currentTarget.blur();
                      applyDraftChange((next) => {
                        next.synthOptions.oscillator.type = e.target.value as any;
                      }, true);
                    }}
                    className="w-full bg-black/60 border border-white/15 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white cursor-pointer"
                  >
                    {OSC_TYPES.map((o) => (
                      <option key={o.value} value={o.value} className="bg-[#0d1018]">
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Changes the fundamental timbre (buzzy saw, hollow square, glassy FM, or smooth sine).
                  </p>
                </div>

                {isFat && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-slate-300">Unison Voices</span>
                        <span className="text-cyan-300 font-bold">{osc.count || 2}x</span>
                      </div>
                      <input
                        id="slider-osc-unison-count"
                        type="range"
                        min={1}
                        max={3}
                        step={1}
                        value={osc.count || 2}
                        onChange={(e) =>
                          applyDraftChange((next) => {
                            next.synthOptions.oscillator.count = Number(e.target.value);
                          }, true)
                        }
                        className="w-full accent-cyan-400 cursor-pointer"
                      />
                      <p className="text-[9px] text-slate-500 leading-tight">
                        Stacks 1–3 waves together for a wider chorus effect.
                      </p>
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-slate-300">Detune Spread</span>
                        <span className="text-cyan-300 font-bold">{osc.spread ?? 15}¢</span>
                      </div>
                      <input
                        id="slider-osc-detune-spread"
                        type="range"
                        min={2}
                        max={40}
                        value={osc.spread ?? 15}
                        onChange={(e) =>
                          applyDraftChange((next) => {
                            next.synthOptions.oscillator.spread = Number(e.target.value);
                            if ((next.synthOptions.oscillator.count || 1) < 2) {
                              next.synthOptions.oscillator.count = 2;
                            }
                          })
                        }
                        onMouseUp={() => scheduleAutoPreview(draft)}
                        onTouchEnd={() => scheduleAutoPreview(draft)}
                        className="w-full accent-cyan-400 cursor-pointer"
                      />
                      <p className="text-[9px] text-slate-500 leading-tight">
                        Low = tight &amp; focused · High = lush, detuned analog width.
                      </p>
                    </div>
                  </div>
                )}

                {isFM && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-slate-300">FM Harmonic Ratio</span>
                        <span className="text-cyan-300 font-bold">{osc.harmonicity ?? 2}x</span>
                      </div>
                      <input
                        id="slider-osc-fm-ratio"
                        type="range"
                        min={0.5}
                        max={6}
                        step={0.5}
                        value={osc.harmonicity ?? 2}
                        onChange={(e) =>
                          applyDraftChange((next) => {
                            next.synthOptions.oscillator.harmonicity = Number(e.target.value);
                          })
                        }
                        onMouseUp={() => scheduleAutoPreview(draft)}
                        onTouchEnd={() => scheduleAutoPreview(draft)}
                        className="w-full accent-cyan-400 cursor-pointer"
                      />
                      <p className="text-[9px] text-slate-500 leading-tight">
                        0.5x = deep sub growl · 1x–2x = warm keys · 3x+ = metallic bells.
                      </p>
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-slate-300">FM Bite / Depth</span>
                        <span className="text-cyan-300 font-bold">{osc.modulationIndex ?? 2}</span>
                      </div>
                      <input
                        id="slider-osc-fm-depth"
                        type="range"
                        min={0.2}
                        max={8}
                        step={0.2}
                        value={osc.modulationIndex ?? 2}
                        onChange={(e) =>
                          applyDraftChange((next) => {
                            next.synthOptions.oscillator.modulationIndex = Number(e.target.value);
                          })
                        }
                        onMouseUp={() => scheduleAutoPreview(draft)}
                        onTouchEnd={() => scheduleAutoPreview(draft)}
                        className="w-full accent-cyan-400 cursor-pointer"
                      />
                      <p className="text-[9px] text-slate-500 leading-tight">
                        Low = mellow Rhodes tone · High = bright, aggressive FM bite.
                      </p>
                    </div>
                  </div>
                )}

                {!isFat && !isFM && (
                  <div className="flex items-center px-3 py-2 rounded-lg bg-black/40 border border-white/5 text-[11px] text-slate-400">
                    Pure single-oscillator mode active. Switch to a <strong className="text-cyan-300 mx-1">SuperSaw / Unison</strong> or <strong className="text-cyan-300 mx-1">FM</strong> engine on the left to unlock multi-voice detune or FM harmonic controls.
                  </div>
                )}
              </div>
            </div>

            {/* 4. Sub-Oscillator & Transient Noise Layers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Sub-Oscillator */}
              <div
                className={`p-3 rounded-xl border space-y-2 transition-colors ${
                  sub.enabled
                    ? 'bg-[#151926] border-amber-500/40'
                    : 'bg-[#111520] border-white/10'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-amber-300">
                    2. Sub-Oscillator Bass Layer
                  </span>
                  <label className="flex items-center gap-1.5 cursor-pointer font-mono text-[10px]">
                    <span className={sub.enabled ? 'text-amber-300 font-bold' : 'text-slate-500'}>
                      {sub.enabled ? 'ACTIVE' : 'OFF'}
                    </span>
                    <input
                      id="toggle-sub-osc"
                      type="checkbox"
                      checked={sub.enabled}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        applyDraftChange((next) => {
                          next.synthOptions.subOsc = {
                            ...sub,
                            enabled: checked,
                            mix: checked && sub.mix < 0.25 ? 0.55 : sub.mix,
                          };
                        }, true);
                      }}
                      className="accent-amber-400 cursor-pointer w-3.5 h-3.5"
                    />
                  </label>
                </div>

                <div
                  id="hint-section-sub-osc"
                  className="flex items-start gap-1.5 px-2 py-1.5 rounded bg-amber-500/[0.07] border border-amber-500/20 text-[10px] text-slate-300 leading-snug"
                >
                  <Info className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-amber-200">Hint:</strong> Layers a deep bass wave 1 or 2 octaves below your note to make thin leads or chords sound huge and chest-hitting.
                  </span>
                </div>

                <div className="flex items-center justify-between gap-1.5 font-mono text-[10px] flex-wrap">
                  <div className="flex items-center gap-1">
                    {(['sine', 'triangle', 'square'] as const).map((t) => (
                      <button
                        key={t}
                        id={`btn-sub-wave-${t}`}
                        onClick={() =>
                          applyDraftChange((next) => {
                            next.synthOptions.subOsc = {
                              ...sub,
                              enabled: true,
                              type: t,
                              mix: sub.mix < 0.2 ? 0.55 : sub.mix,
                            };
                          }, true)
                        }
                        className={`px-2 py-0.5 rounded border cursor-pointer uppercase ${
                          sub.type === t && sub.enabled
                            ? 'bg-amber-500/25 border-amber-400 text-amber-200 font-bold'
                            : 'bg-black/40 border-white/10 text-slate-400 hover:text-white'
                        }`}
                        title={`Sub waveform: ${t === 'sine' ? 'Pure deep sub' : t === 'triangle' ? 'Warm woody sub' : 'Gritty analog octave buzz'}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1">
                    {([-1, -2] as const).map((oct) => (
                      <button
                        key={oct}
                        id={`btn-sub-oct-${Math.abs(oct)}`}
                        onClick={() =>
                          applyDraftChange((next) => {
                            next.synthOptions.subOsc = {
                              ...sub,
                              enabled: true,
                              octaveOffset: oct,
                              mix: sub.mix < 0.2 ? 0.55 : sub.mix,
                            };
                          }, true)
                        }
                        className={`px-1.5 py-0.5 rounded border cursor-pointer ${
                          (sub.octaveOffset || -1) === oct && sub.enabled
                            ? 'bg-amber-500/25 border-amber-400 text-amber-200 font-bold'
                            : 'bg-black/40 border-white/10 text-slate-400 hover:text-white'
                        }`}
                        title={`${oct} Octave below the main note`}
                      >
                        {oct} OCT
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-slate-300">Sub Bass Volume Mix</span>
                    <span className="text-amber-300 font-bold">
                      {sub.enabled ? `${Math.round(sub.mix * 100)}%` : '0% (OFF)'}
                    </span>
                  </div>
                  <input
                    id="slider-sub-osc-mix"
                    type="range"
                    min={0}
                    max={1}
                    step={0.02}
                    value={sub.enabled ? sub.mix : 0}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      applyDraftChange((next) => {
                        next.synthOptions.subOsc = {
                          ...sub,
                          enabled: val > 0.01,
                          mix: val,
                        };
                      });
                    }}
                    onMouseUp={() => scheduleAutoPreview(draft)}
                    onTouchEnd={() => scheduleAutoPreview(draft)}
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                  <p className="text-[9px] text-slate-500 leading-tight">
                    Sine = clean sub rumble · Square = punchy analog octave bass.
                  </p>
                </div>
              </div>

              {/* Transient Attack / Breath Noise */}
              <div
                className={`p-3 rounded-xl border space-y-2 transition-colors ${
                  noise.enabled
                    ? 'bg-[#191422] border-pink-500/40'
                    : 'bg-[#111520] border-white/10'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-pink-300">
                    3. Hammer / Breath Noise Layer
                  </span>
                  <label className="flex items-center gap-1.5 cursor-pointer font-mono text-[10px]">
                    <span className={noise.enabled ? 'text-pink-300 font-bold' : 'text-slate-500'}>
                      {noise.enabled ? 'ACTIVE' : 'OFF'}
                    </span>
                    <input
                      id="toggle-noise-layer"
                      type="checkbox"
                      checked={noise.enabled}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        applyDraftChange((next) => {
                          next.synthOptions.noise = {
                            ...noise,
                            enabled: checked,
                            mix: checked && noise.mix < 0.18 ? 0.42 : noise.mix,
                            decay: checked && noise.decay < 0.04 ? 0.12 : noise.decay,
                          };
                        }, true);
                      }}
                      className="accent-pink-400 cursor-pointer w-3.5 h-3.5"
                    />
                  </label>
                </div>

                <div
                  id="hint-section-noise"
                  className="flex items-start gap-1.5 px-2 py-1.5 rounded bg-pink-500/[0.07] border border-pink-500/20 text-[10px] text-slate-300 leading-snug"
                >
                  <Info className="w-3 h-3 text-pink-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-pink-200">Hint:</strong> Adds acoustic key-hammer click, flute breath, or lo-fi vinyl air. Short decay = percussive snap; Long decay = airy breath.
                  </span>
                </div>

                <div className="flex items-center gap-1.5 font-mono text-[10px]">
                  <span className="text-slate-400">Texture:</span>
                  {(
                    [
                      { id: 'pink', label: 'PINK (Warm Breath)' },
                      { id: 'white', label: 'WHITE (Crisp Snap)' },
                    ] as const
                  ).map((nt) => (
                    <button
                      key={nt.id}
                      id={`btn-noise-type-${nt.id}`}
                      onClick={() =>
                        applyDraftChange((next) => {
                          next.synthOptions.noise = {
                            ...noise,
                            enabled: true,
                            type: nt.id,
                            mix: noise.mix < 0.18 ? 0.42 : noise.mix,
                          };
                        }, true)
                      }
                      className={`px-2 py-0.5 rounded border cursor-pointer ${
                        noise.type === nt.id && noise.enabled
                          ? 'bg-pink-500/25 border-pink-400 text-pink-200 font-bold'
                          : 'bg-black/40 border-white/10 text-slate-400 hover:text-white'
                      }`}
                    >
                      {nt.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-slate-300">Noise Level</span>
                      <span className="text-pink-300 font-bold">
                        {noise.enabled ? `${Math.round(noise.mix * 100)}%` : '0%'}
                      </span>
                    </div>
                    <input
                      id="slider-noise-mix"
                      type="range"
                      min={0}
                      max={1}
                      step={0.02}
                      value={noise.enabled ? noise.mix : 0}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        applyDraftChange((next) => {
                          next.synthOptions.noise = {
                            ...noise,
                            enabled: val > 0.01,
                            mix: val,
                          };
                        });
                      }}
                      onMouseUp={() => scheduleAutoPreview(draft)}
                      onTouchEnd={() => scheduleAutoPreview(draft)}
                      className="w-full accent-pink-400 cursor-pointer"
                    />
                    <p className="text-[9px] text-slate-500 leading-tight">
                      How loud the air/click burst is on each key press.
                    </p>
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-slate-300">Burst Decay</span>
                      <span className="text-pink-300 font-bold">{noise.decay.toFixed(2)}s</span>
                    </div>
                    <input
                      id="slider-noise-decay"
                      type="range"
                      min={0.02}
                      max={0.9}
                      step={0.02}
                      value={noise.decay}
                      onChange={(e) =>
                        applyDraftChange((next) => {
                          next.synthOptions.noise = {
                            ...noise,
                            enabled: true,
                            mix: noise.mix < 0.15 ? 0.4 : noise.mix,
                            decay: Number(e.target.value),
                          };
                        })
                      }
                      onMouseUp={() => scheduleAutoPreview(draft)}
                      onTouchEnd={() => scheduleAutoPreview(draft)}
                      className="w-full accent-pink-400 cursor-pointer"
                    />
                    <p className="text-[9px] text-slate-500 leading-tight">
                      0.03s = tight pluck click · 0.40s+ = sustained breath.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 5. Per-Voice Resonant Filter & Filter Envelope */}
            <div
              className={`p-3.5 rounded-xl border space-y-2.5 transition-colors ${
                flt.enabled
                  ? 'bg-[#111c1c] border-emerald-500/40'
                  : 'bg-[#111520] border-white/10'
              }`}
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-mono font-bold text-emerald-300 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" />
                  4. Per-Voice Resonant Filter &amp; Tone Sweep
                </span>
                <div className="flex items-center gap-2">
                  {(['lowpass', 'bandpass', 'highpass'] as const).map((ft) => (
                    <button
                      key={ft}
                      id={`btn-filter-type-${ft}`}
                      onClick={() =>
                        applyDraftChange((next) => {
                          next.synthOptions.filter = { ...flt, enabled: true, type: ft };
                        }, true)
                      }
                      className={`px-2 py-0.5 rounded text-[10px] font-mono border cursor-pointer uppercase ${
                        flt.enabled && flt.type === ft
                          ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200 font-bold'
                          : 'bg-black/40 border-white/10 text-slate-400 hover:text-white'
                      }`}
                      title={
                        ft === 'lowpass'
                          ? 'Lowpass: Cuts high frequencies for warm, mellow tones'
                          : ft === 'bandpass'
                          ? 'Bandpass: Focuses midrange like a telephone or wah pedal'
                          : 'Highpass: Cuts bass for crisp, airy leads and plucks'
                      }
                    >
                      {ft}
                    </button>
                  ))}
                  <label className="flex items-center gap-1 cursor-pointer font-mono text-[10px] ml-1">
                    <span className={flt.enabled ? 'text-emerald-300 font-bold' : 'text-slate-500'}>
                      {flt.enabled ? 'ON' : 'OFF'}
                    </span>
                    <input
                      id="toggle-voice-filter"
                      type="checkbox"
                      checked={flt.enabled}
                      onChange={(e) =>
                        applyDraftChange((next) => {
                          next.synthOptions.filter = { ...flt, enabled: e.target.checked };
                        }, true)
                      }
                      className="accent-emerald-400 cursor-pointer w-3.5 h-3.5"
                    />
                  </label>
                </div>
              </div>

              <div
                id="hint-section-filter"
                className="flex items-start gap-2 px-2.5 py-1.5 rounded-lg bg-emerald-500/[0.06] border border-emerald-500/20 text-[11px] text-slate-300 leading-snug"
              >
                <Info className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-emerald-200">Hint:</strong> Shapes brightness like a tone knob or wah pedal.{' '}
                  <span className="text-white font-semibold">Lowpass</span> makes sounds warm &amp; underwater;{' '}
                  <span className="text-white font-semibold">Resonance Q</span> adds Acid/Funk squelch;{' '}
                  <span className="text-white font-semibold">Env Sweep</span> makes each note start bright and quickly mellow out.
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-[10px]">
                <div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">Cutoff Freq</span>
                    <span className="text-emerald-300 font-bold">{flt.cutoffHz} Hz</span>
                  </div>
                  <input
                    id="slider-filter-cutoff"
                    type="range"
                    min={120}
                    max={9000}
                    step={20}
                    value={flt.cutoffHz}
                    onChange={(e) =>
                      applyDraftChange((next) => {
                        next.synthOptions.filter = {
                          ...flt,
                          enabled: true,
                          cutoffHz: Number(e.target.value),
                        };
                      })
                    }
                    onMouseUp={() => scheduleAutoPreview(draft)}
                    onTouchEnd={() => scheduleAutoPreview(draft)}
                    className="w-full accent-emerald-400 cursor-pointer"
                  />
                  <p className="text-[9px] text-slate-500 leading-tight font-sans">
                    Low = dark &amp; muffled · High = bright &amp; open.
                  </p>
                </div>

                <div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">Resonance Q</span>
                    <span className="text-emerald-300 font-bold">{flt.resonanceQ.toFixed(1)}</span>
                  </div>
                  <input
                    id="slider-filter-q"
                    type="range"
                    min={0.5}
                    max={10}
                    step={0.1}
                    value={flt.resonanceQ}
                    onChange={(e) =>
                      applyDraftChange((next) => {
                        next.synthOptions.filter = {
                          ...flt,
                          enabled: true,
                          resonanceQ: Number(e.target.value),
                        };
                      })
                    }
                    onMouseUp={() => scheduleAutoPreview(draft)}
                    onTouchEnd={() => scheduleAutoPreview(draft)}
                    className="w-full accent-emerald-400 cursor-pointer"
                  />
                  <p className="text-[9px] text-slate-500 leading-tight font-sans">
                    Boosts the cutoff edge for vocal &quot;wah&quot; or laser bite.
                  </p>
                </div>

                <div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">Env Sweep</span>
                    <span className="text-emerald-300 font-bold">+{flt.envAmountHz} Hz</span>
                  </div>
                  <input
                    id="slider-filter-env-amt"
                    type="range"
                    min={0}
                    max={5500}
                    step={50}
                    value={flt.envAmountHz}
                    onChange={(e) =>
                      applyDraftChange((next) => {
                        next.synthOptions.filter = {
                          ...flt,
                          enabled: true,
                          envAmountHz: Number(e.target.value),
                        };
                      })
                    }
                    onMouseUp={() => scheduleAutoPreview(draft)}
                    onTouchEnd={() => scheduleAutoPreview(draft)}
                    className="w-full accent-emerald-400 cursor-pointer"
                  />
                  <p className="text-[9px] text-slate-500 leading-tight font-sans">
                    How much brighter the note starts before settling to Cutoff.
                  </p>
                </div>

                <div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">Sweep Decay</span>
                    <span className="text-emerald-300 font-bold">{flt.envDecay.toFixed(2)}s</span>
                  </div>
                  <input
                    id="slider-filter-env-decay"
                    type="range"
                    min={0.04}
                    max={1.2}
                    step={0.02}
                    value={flt.envDecay}
                    onChange={(e) =>
                      applyDraftChange((next) => {
                        next.synthOptions.filter = {
                          ...flt,
                          enabled: true,
                          envDecay: Number(e.target.value),
                        };
                      })
                    }
                    onMouseUp={() => scheduleAutoPreview(draft)}
                    onTouchEnd={() => scheduleAutoPreview(draft)}
                    className="w-full accent-emerald-400 cursor-pointer"
                  />
                  <p className="text-[9px] text-slate-500 leading-tight font-sans">
                    Fast = snappy pluck filter · Slow = gradual wah sweep.
                  </p>
                </div>
              </div>
            </div>

            {/* 6. Amplitude ADSR + Vibrato / Pitch Glide */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Amplitude ADSR */}
              <div className="p-3 rounded-xl bg-[#111520] border border-white/10 space-y-2">
                <span className="text-xs font-mono font-bold text-purple-300 block">
                  5. Volume ADSR Envelope (Note Shape)
                </span>

                <div
                  id="hint-section-adsr"
                  className="flex items-start gap-1.5 px-2 py-1.5 rounded bg-purple-500/[0.07] border border-purple-500/20 text-[10px] text-slate-300 leading-snug"
                >
                  <Info className="w-3 h-3 text-purple-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-purple-200">Hint:</strong> Controls how volume changes from key-down to key-release (Pluck vs. Pad).
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 font-mono text-[10px]">
                  <div>
                    <div className="flex justify-between">
                      <span className="text-slate-300">Attack (Fade In)</span>
                      <span className="text-purple-300 font-bold">{env.attack.toFixed(3)}s</span>
                    </div>
                    <input
                      id="slider-adsr-attack"
                      type="range"
                      min={0.005}
                      max={0.4}
                      step={0.005}
                      value={env.attack}
                      onChange={(e) =>
                        applyDraftChange((next) => {
                          next.synthOptions.envelope.attack = Number(e.target.value);
                        })
                      }
                      onMouseUp={() => scheduleAutoPreview(draft)}
                      onTouchEnd={() => scheduleAutoPreview(draft)}
                      className="w-full accent-purple-400 cursor-pointer"
                    />
                    <p className="text-[9px] text-slate-500 leading-tight font-sans">
                      0.005s = instant hit · 0.3s = slow swell.
                    </p>
                  </div>
                  <div>
                    <div className="flex justify-between">
                      <span className="text-slate-300">Decay (Drop)</span>
                      <span className="text-purple-300 font-bold">{env.decay.toFixed(2)}s</span>
                    </div>
                    <input
                      id="slider-adsr-decay"
                      type="range"
                      min={0.05}
                      max={1.5}
                      step={0.02}
                      value={env.decay}
                      onChange={(e) =>
                        applyDraftChange((next) => {
                          next.synthOptions.envelope.decay = Number(e.target.value);
                        })
                      }
                      onMouseUp={() => scheduleAutoPreview(draft)}
                      onTouchEnd={() => scheduleAutoPreview(draft)}
                      className="w-full accent-purple-400 cursor-pointer"
                    />
                    <p className="text-[9px] text-slate-500 leading-tight font-sans">
                      How fast initial peak drops to Sustain level.
                    </p>
                  </div>
                  <div>
                    <div className="flex justify-between">
                      <span className="text-slate-300">Sustain (Hold)</span>
                      <span className="text-purple-300 font-bold">{Math.round(env.sustain * 100)}%</span>
                    </div>
                    <input
                      id="slider-adsr-sustain"
                      type="range"
                      min={0.02}
                      max={1}
                      step={0.02}
                      value={env.sustain}
                      onChange={(e) =>
                        applyDraftChange((next) => {
                          next.synthOptions.envelope.sustain = Number(e.target.value);
                        })
                      }
                      onMouseUp={() => scheduleAutoPreview(draft)}
                      onTouchEnd={() => scheduleAutoPreview(draft)}
                      className="w-full accent-purple-400 cursor-pointer"
                    />
                    <p className="text-[9px] text-slate-500 leading-tight font-sans">
                      Low = short pluck · High = full organ/pad hold.
                    </p>
                  </div>
                  <div>
                    <div className="flex justify-between">
                      <span className="text-slate-300">Release (Tail)</span>
                      <span className="text-purple-300 font-bold">{env.release.toFixed(2)}s</span>
                    </div>
                    <input
                      id="slider-adsr-release"
                      type="range"
                      min={0.08}
                      max={2.2}
                      step={0.04}
                      value={env.release}
                      onChange={(e) =>
                        applyDraftChange((next) => {
                          next.synthOptions.envelope.release = Number(e.target.value);
                        })
                      }
                      onMouseUp={() => scheduleAutoPreview(draft)}
                      onTouchEnd={() => scheduleAutoPreview(draft)}
                      className="w-full accent-purple-400 cursor-pointer"
                    />
                    <p className="text-[9px] text-slate-500 leading-tight font-sans">
                      How long the note rings out after you let go.
                    </p>
                  </div>
                </div>
              </div>

              {/* Vibrato LFO & 808 Pitch Attack */}
              <div className="p-3 rounded-xl bg-[#111520] border border-white/10 space-y-2">
                <span className="text-xs font-mono font-bold text-rose-300 block">
                  6. Vibrato Drift &amp; 808 Pitch Glide
                </span>

                <div
                  id="hint-section-vibrato-pitch"
                  className="flex items-start gap-1.5 px-2 py-1.5 rounded bg-rose-500/[0.07] border border-rose-500/20 text-[10px] text-slate-300 leading-snug"
                >
                  <Info className="w-3 h-3 text-rose-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-rose-200">Hint:</strong> Vibrato wobbles pitch like vintage tape; Pitch Bend slides into the note for 808 kicks or laser zaps.
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 font-mono text-[10px]">
                  <div>
                    <div className="flex justify-between">
                      <span className="text-slate-300">Vibrato Depth</span>
                      <span className="text-rose-300 font-bold">
                        {vibrato.enabled ? `${vibrato.depthCents}¢` : 'OFF'}
                      </span>
                    </div>
                    <input
                      id="slider-vibrato-depth"
                      type="range"
                      min={0}
                      max={45}
                      step={1}
                      value={vibrato.enabled ? vibrato.depthCents : 0}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        applyDraftChange((next) => {
                          next.synthOptions.vibrato = {
                            ...vibrato,
                            enabled: val > 0,
                            depthCents: val,
                          };
                        });
                      }}
                      onMouseUp={() => scheduleAutoPreview(draft)}
                      onTouchEnd={() => scheduleAutoPreview(draft)}
                      className="w-full accent-rose-400 cursor-pointer"
                    />
                    <p className="text-[9px] text-slate-500 leading-tight font-sans">
                      Amount of pitch wobble (8¢ = lo-fi tape, 25¢+ = synth lead).
                    </p>
                  </div>
                  <div>
                    <div className="flex justify-between">
                      <span className="text-slate-300">Vibrato Speed</span>
                      <span className="text-rose-300 font-bold">{vibrato.rateHz.toFixed(1)} Hz</span>
                    </div>
                    <input
                      id="slider-vibrato-rate"
                      type="range"
                      min={0.8}
                      max={10}
                      step={0.2}
                      value={vibrato.rateHz}
                      onChange={(e) =>
                        applyDraftChange((next) => {
                          next.synthOptions.vibrato = {
                            ...vibrato,
                            enabled: true,
                            depthCents: vibrato.depthCents < 2 ? 12 : vibrato.depthCents,
                            rateHz: Number(e.target.value),
                          };
                        })
                      }
                      onMouseUp={() => scheduleAutoPreview(draft)}
                      onTouchEnd={() => scheduleAutoPreview(draft)}
                      className="w-full accent-rose-400 cursor-pointer"
                    />
                    <p className="text-[9px] text-slate-500 leading-tight font-sans">
                      1–3 Hz = slow tape drift · 5–8 Hz = fast singer vibrato.
                    </p>
                  </div>
                  <div>
                    <div className="flex justify-between">
                      <span className="text-slate-300">Pitch Attack Bend</span>
                      <span className="text-rose-300 font-bold">
                        {pitchEnv.enabled ? `${pitchEnv.semitones > 0 ? '+' : ''}${pitchEnv.semitones} st` : '0 st'}
                      </span>
                    </div>
                    <input
                      id="slider-pitch-bend-semitones"
                      type="range"
                      min={-12}
                      max={12}
                      step={0.5}
                      value={pitchEnv.enabled ? pitchEnv.semitones : 0}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        applyDraftChange((next) => {
                          next.synthOptions.pitchEnv = {
                            ...pitchEnv,
                            enabled: Math.abs(val) > 0.1,
                            semitones: val,
                            decay: pitchEnv.decay || 0.06,
                          };
                        });
                      }}
                      onMouseUp={() => scheduleAutoPreview(draft)}
                      onTouchEnd={() => scheduleAutoPreview(draft)}
                      className="w-full accent-rose-400 cursor-pointer"
                    />
                    <p className="text-[9px] text-slate-500 leading-tight font-sans">
                      +st = drops down (808/laser) · -st = scoops up (brass).
                    </p>
                  </div>
                  <div>
                    <div className="flex justify-between">
                      <span className="text-slate-300">Bend Speed</span>
                      <span className="text-rose-300 font-bold">{(pitchEnv.decay || 0.06).toFixed(2)}s</span>
                    </div>
                    <input
                      id="slider-pitch-bend-decay"
                      type="range"
                      min={0.02}
                      max={0.45}
                      step={0.01}
                      value={pitchEnv.decay || 0.06}
                      onChange={(e) =>
                        applyDraftChange((next) => {
                          next.synthOptions.pitchEnv = {
                            ...pitchEnv,
                            enabled: true,
                            semitones: Math.abs(pitchEnv.semitones) < 0.5 ? 7 : pitchEnv.semitones,
                            decay: Number(e.target.value),
                          };
                        })
                      }
                      onMouseUp={() => scheduleAutoPreview(draft)}
                      onTouchEnd={() => scheduleAutoPreview(draft)}
                      className="w-full accent-rose-400 cursor-pointer"
                    />
                    <p className="text-[9px] text-slate-500 leading-tight font-sans">
                      0.03s = punchy 808 kick thump · 0.25s = slow riser slide.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
