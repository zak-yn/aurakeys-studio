import React, { useState, useEffect } from 'react';
import {
  X,
  Sliders,
  Sparkles,
  Save,
  Trash2,
  Volume2,
  Pin,
  Wand2,
  Layers,
  Activity,
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

  useEffect(() => {
    if (!currentPreset.isSamplerVoice) {
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

  const applyDraftChange = (updater: (next: PresetConfig) => void) => {
    const next = deepClonePreset(draft);
    updater(next);
    setDraft(next);
    onUpdateLivePreset(next);
  };

  const handleAuditionNote = (note = 'C4') => {
    const engine = SynthEngine.getInstance();
    if (!engine.isReady || !engine.liveSynth) return;
    engine.setLivePreset(draft, false);
    const notes = engine.transposeNotes([note, 'E4', 'G4'], draft.octaveOffset);
    engine.liveSynth.triggerAttackRelease(notes, 0.45);
  };

  const handleSmartGenerate = (archetype: 'bass' | 'pad' | 'pluck' | 'lead' | 'bell' | 'mutate') => {
    const generated = generateSmartPreset(archetype, draft);
    setDraft(generated);
    setCustomName(generated.name);
    onUpdateLivePreset(generated);
    setTimeout(() => handleAuditionNote('C4'), 20);
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

          <div className="flex items-center gap-2">
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
            <div className="p-3.5 rounded-xl bg-[#111520] border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold uppercase text-cyan-300 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  1. Primary Oscillator &amp; Harmonics
                </span>
                <div className="flex items-center gap-1.5 font-mono text-[11px]">
                  <span className="text-slate-400">Octave:</span>
                  {([-2, -1, 0, 1] as const).map((oct) => (
                    <button
                      key={oct}
                      id={`btn-osc-octave-${oct}`}
                      onClick={() =>
                        applyDraftChange((next) => {
                          next.octaveOffset = oct;
                        })
                      }
                      className={`px-2 py-0.5 rounded border cursor-pointer ${
                        draft.octaveOffset === oct
                          ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200 font-bold'
                          : 'bg-black/40 border-white/10 text-slate-400'
                      }`}
                    >
                      {oct > 0 ? `+${oct}` : oct}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono text-slate-400 block mb-1">
                    Oscillator Engine
                  </label>
                  <select
                    id="select-synth-osc-type"
                    value={osc.type}
                    onChange={(e) => {
                      e.currentTarget.blur();
                      applyDraftChange((next) => {
                        next.synthOptions.oscillator.type = e.target.value as any;
                      });
                    }}
                    className="w-full bg-black/60 border border-white/15 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white"
                  >
                    {OSC_TYPES.map((o) => (
                      <option key={o.value} value={o.value} className="bg-[#0d1018]">
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                {isFat && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-slate-400">Unison Voices</span>
                        <span className="text-cyan-300">{osc.count || 2}</span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={3}
                        step={1}
                        value={osc.count || 2}
                        onChange={(e) =>
                          applyDraftChange((next) => {
                            next.synthOptions.oscillator.count = Number(e.target.value);
                          })
                        }
                        className="w-full accent-cyan-400 cursor-pointer"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-slate-400">Detune Spread</span>
                        <span className="text-cyan-300">{osc.spread ?? 15}¢</span>
                      </div>
                      <input
                        type="range"
                        min={2}
                        max={40}
                        value={osc.spread ?? 15}
                        onChange={(e) =>
                          applyDraftChange((next) => {
                            next.synthOptions.oscillator.spread = Number(e.target.value);
                          })
                        }
                        className="w-full accent-cyan-400 cursor-pointer"
                      />
                    </div>
                  </div>
                )}

                {isFM && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-slate-400">FM Ratio</span>
                        <span className="text-cyan-300">{osc.harmonicity ?? 2}x</span>
                      </div>
                      <input
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
                        className="w-full accent-cyan-400 cursor-pointer"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-slate-400">FM Mod Depth</span>
                        <span className="text-cyan-300">{osc.modulationIndex ?? 2}</span>
                      </div>
                      <input
                        type="range"
                        min={0.2}
                        max={6}
                        step={0.2}
                        value={osc.modulationIndex ?? 2}
                        onChange={(e) =>
                          applyDraftChange((next) => {
                            next.synthOptions.oscillator.modulationIndex = Number(e.target.value);
                          })
                        }
                        className="w-full accent-cyan-400 cursor-pointer"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 4. Sub-Oscillator & Transient Noise Layers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Sub-Oscillator */}
              <div className="p-3 rounded-xl bg-[#111520] border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-amber-300">
                    2. Sub-Oscillator Layer
                  </span>
                  <input
                    id="toggle-sub-osc"
                    type="checkbox"
                    checked={sub.enabled}
                    onChange={(e) =>
                      applyDraftChange((next) => {
                        next.synthOptions.subOsc = { ...sub, enabled: e.target.checked };
                      })
                    }
                    className="accent-amber-400 cursor-pointer"
                  />
                </div>
                <div className="flex items-center gap-2 font-mono text-[10px]">
                  {(['sine', 'triangle', 'square'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() =>
                        applyDraftChange((next) => {
                          next.synthOptions.subOsc = { ...sub, enabled: true, type: t };
                        })
                      }
                      className={`px-2 py-0.5 rounded border cursor-pointer uppercase ${
                        sub.type === t && sub.enabled
                          ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                          : 'bg-black/40 border-white/10 text-slate-400'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <div>
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-slate-400">Sub Mix (-1 Oct)</span>
                    <span className="text-amber-300">{Math.round(sub.mix * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={0.8}
                    step={0.02}
                    value={sub.mix}
                    onChange={(e) =>
                      applyDraftChange((next) => {
                        next.synthOptions.subOsc = {
                          ...sub,
                          enabled: true,
                          mix: Number(e.target.value),
                        };
                      })
                    }
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                </div>
              </div>

              {/* Transient Attack / Breath Noise */}
              <div className="p-3 rounded-xl bg-[#111520] border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-pink-300">
                    3. Hammer / Breath Noise
                  </span>
                  <input
                    id="toggle-noise-layer"
                    type="checkbox"
                    checked={noise.enabled}
                    onChange={(e) =>
                      applyDraftChange((next) => {
                        next.synthOptions.noise = { ...noise, enabled: e.target.checked };
                      })
                    }
                    className="accent-pink-400 cursor-pointer"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-slate-400">Noise Level</span>
                      <span className="text-pink-300">{Math.round(noise.mix * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={0.4}
                      step={0.01}
                      value={noise.mix}
                      onChange={(e) =>
                        applyDraftChange((next) => {
                          next.synthOptions.noise = {
                            ...noise,
                            enabled: true,
                            mix: Number(e.target.value),
                          };
                        })
                      }
                      className="w-full accent-pink-400 cursor-pointer"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-slate-400">Burst Decay</span>
                      <span className="text-pink-300">{noise.decay.toFixed(2)}s</span>
                    </div>
                    <input
                      type="range"
                      min={0.01}
                      max={0.8}
                      step={0.01}
                      value={noise.decay}
                      onChange={(e) =>
                        applyDraftChange((next) => {
                          next.synthOptions.noise = {
                            ...noise,
                            enabled: true,
                            decay: Number(e.target.value),
                          };
                        })
                      }
                      className="w-full accent-pink-400 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 5. Per-Voice Resonant Filter & Filter Envelope */}
            <div className="p-3.5 rounded-xl bg-[#111520] border border-white/10 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-emerald-300 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" />
                  4. Per-Voice Resonant Filter &amp; Envelope Sweep
                </span>
                <div className="flex items-center gap-2">
                  {(['lowpass', 'bandpass', 'highpass'] as const).map((ft) => (
                    <button
                      key={ft}
                      onClick={() =>
                        applyDraftChange((next) => {
                          next.synthOptions.filter = { ...flt, enabled: true, type: ft };
                        })
                      }
                      className={`px-2 py-0.5 rounded text-[10px] font-mono border cursor-pointer uppercase ${
                        flt.enabled && flt.type === ft
                          ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 font-bold'
                          : 'bg-black/40 border-white/10 text-slate-400'
                      }`}
                    >
                      {ft}
                    </button>
                  ))}
                  <input
                    id="toggle-voice-filter"
                    type="checkbox"
                    checked={flt.enabled}
                    onChange={(e) =>
                      applyDraftChange((next) => {
                        next.synthOptions.filter = { ...flt, enabled: e.target.checked };
                      })
                    }
                    className="accent-emerald-400 cursor-pointer"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-[10px]">
                <div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Cutoff</span>
                    <span className="text-emerald-300">{flt.cutoffHz} Hz</span>
                  </div>
                  <input
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
                    className="w-full accent-emerald-400 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Resonance Q</span>
                    <span className="text-emerald-300">{flt.resonanceQ.toFixed(1)}</span>
                  </div>
                  <input
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
                    className="w-full accent-emerald-400 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Env Sweep</span>
                    <span className="text-emerald-300">+{flt.envAmountHz} Hz</span>
                  </div>
                  <input
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
                    className="w-full accent-emerald-400 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Sweep Decay</span>
                    <span className="text-emerald-300">{flt.envDecay.toFixed(2)}s</span>
                  </div>
                  <input
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
                    className="w-full accent-emerald-400 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* 6. Amplitude ADSR + Vibrato / Pitch Glide */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Amplitude ADSR */}
              <div className="p-3 rounded-xl bg-[#111520] border border-white/10 space-y-2">
                <span className="text-xs font-mono font-bold text-purple-300 block">
                  5. Amplitude ADSR Envelope
                </span>
                <div className="grid grid-cols-2 gap-2 font-mono text-[10px]">
                  <div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Attack</span>
                      <span className="text-purple-300">{env.attack.toFixed(3)}s</span>
                    </div>
                    <input
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
                      className="w-full accent-purple-400 cursor-pointer"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Decay</span>
                      <span className="text-purple-300">{env.decay.toFixed(2)}s</span>
                    </div>
                    <input
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
                      className="w-full accent-purple-400 cursor-pointer"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Sustain</span>
                      <span className="text-purple-300">{Math.round(env.sustain * 100)}%</span>
                    </div>
                    <input
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
                      className="w-full accent-purple-400 cursor-pointer"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Release</span>
                      <span className="text-purple-300">{env.release.toFixed(2)}s</span>
                    </div>
                    <input
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
                      className="w-full accent-purple-400 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Vibrato LFO & 808 Pitch Attack */}
              <div className="p-3 rounded-xl bg-[#111520] border border-white/10 space-y-2">
                <span className="text-xs font-mono font-bold text-rose-300 block">
                  6. Vibrato Drift &amp; 808 Pitch Punch
                </span>
                <div className="grid grid-cols-2 gap-2 font-mono text-[10px]">
                  <div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Vibrato Depth</span>
                      <span className="text-rose-300">
                        {vibrato.enabled ? `${vibrato.depthCents}¢` : 'OFF'}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={30}
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
                      className="w-full accent-rose-400 cursor-pointer"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Vibrato Rate</span>
                      <span className="text-rose-300">{vibrato.rateHz.toFixed(1)} Hz</span>
                    </div>
                    <input
                      type="range"
                      min={0.8}
                      max={9}
                      step={0.2}
                      value={vibrato.rateHz}
                      onChange={(e) =>
                        applyDraftChange((next) => {
                          next.synthOptions.vibrato = {
                            ...vibrato,
                            enabled: true,
                            rateHz: Number(e.target.value),
                          };
                        })
                      }
                      className="w-full accent-rose-400 cursor-pointer"
                    />
                  </div>
                  <div className="col-span-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Pitch Attack Bend (808 / Pluck Snap)</span>
                      <span className="text-rose-300">
                        {pitchEnv.enabled ? `${pitchEnv.semitones > 0 ? '+' : ''}${pitchEnv.semitones} st` : '0 st'}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-6}
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
                          };
                        });
                      }}
                      className="w-full accent-rose-400 cursor-pointer"
                    />
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
