import React, { useState, useEffect } from 'react';
import {
  Play,
  Square,
  Circle,
  Sparkles,
  Music2,
  Clock,
  Mic,
  Cpu,
  Sliders,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { SCALES, SCALE_CATEGORIES, ROOT_NOTES, ScaleDef } from '../audio/scales';
import { PRESETS, PresetConfig } from '../audio/presets';
import { CustomSampleData } from '../audio/SamplerEngine';

interface TopBarProps {
  allPresets?: PresetConfig[];
  currentPreset: PresetConfig;
  onSelectPreset: (index: number) => void;
  currentScale: ScaleDef;
  onSelectScale: (scale: ScaleDef) => void;
  currentRoot: string;
  onSelectRoot: (root: string) => void;
  bpm: number;
  onChangeBpm: (bpm: number) => void;
  bars: 2 | 4 | 8;
  onChangeBars: (bars: 2 | 4 | 8) => void;
  isChordMode: boolean;
  onToggleChordMode: () => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onStartExport: () => Promise<void>;
  onStopExport: () => Promise<void>;
  currentSample: CustomSampleData | null;
  onOpenSamplerModal: () => void;
  onOpenSynthLabModal?: () => void;
  onOpenDiagnosticModal?: () => void;
}

const TopBarComponent: React.FC<TopBarProps> = ({
  allPresets = PRESETS,
  currentPreset,
  onSelectPreset,
  currentScale,
  onSelectScale,
  currentRoot,
  onSelectRoot,
  bpm,
  onChangeBpm,
  bars,
  onChangeBars,
  isChordMode,
  onToggleChordMode,
  isPlaying,
  onTogglePlay,
  onStartExport,
  onStopExport,
  currentSample,
  onOpenSamplerModal,
  onOpenSynthLabModal,
  onOpenDiagnosticModal,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportSeconds, setExportSeconds] = useState(0);

  useEffect(() => {
    let timer: any;
    if (isExporting) {
      setExportSeconds(0);
      timer = setInterval(() => {
        setExportSeconds((s) => s + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isExporting]);

  const handleExportClick = async () => {
    if (!isExporting) {
      await onStartExport();
      setIsExporting(true);
    } else {
      await onStopExport();
      setIsExporting(false);
    }
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const currentIdx = Math.max(
    0,
    allPresets.findIndex((p) => p.id === currentPreset.id)
  );
  // First 6 slots are the pinned hotkeys [5]-[9] and [0] Multi-Voice Sampler
  const hotkeySlots = allPresets.slice(0, 6);

  const handleStepPreset = (delta: number) => {
    const nextIdx = (currentIdx + delta + allPresets.length) % allPresets.length;
    onSelectPreset(nextIdx);
  };

  const currentScaleIdx = Math.max(
    0,
    SCALES.findIndex((s) => s.id === currentScale.id)
  );

  const handleStepScale = (delta: number) => {
    const nextScaleIdx = (currentScaleIdx + delta + SCALES.length) % SCALES.length;
    onSelectScale(SCALES[nextScaleIdx]);
  };

  return (
    <header className="w-full border-b border-white/[0.08] bg-[#0c0e14] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2.5 text-xs select-none">
      {/* Brand & Transport Status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-[#161b29] border border-cyan-500/30 flex items-center justify-center">
            <Music2 className="h-4 w-4 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold tracking-tight text-white text-sm">AuraKeys</span>
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                Studio v2.6
              </span>
            </div>
          </div>
        </div>

        {/* Master Transport Start/Stop */}
        <button
          id="btn-toggle-transport"
          onClick={onTogglePlay}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono font-medium border transition-all cursor-pointer ${
            isPlaying
              ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
              : 'bg-white/[0.04] border-white/10 text-slate-300 hover:bg-white/[0.08]'
          }`}
          title="Master Transport Play / Pause [Space]"
        >
          {isPlaying ? (
            <>
              <Square className="h-3 w-3 fill-amber-400 text-amber-400" />
              <span>PAUSE</span>
            </>
          ) : (
            <>
              <Play className="h-3 w-3 fill-emerald-400 text-emerald-400" />
              <span>START LOOP</span>
            </>
          )}
          <kbd className="text-[9px] text-slate-400 bg-black/40 px-1 py-0.5 rounded border border-white/10 font-mono ml-0.5">
            SPACE
          </kbd>
        </button>
      </div>

      {/* All 30+ Presets Quick Browser (< Dropdown >) + Pinned Hotkeys [5-9, 0] + Synth Lab + Voice Studio */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {/* < All 30+ Presets Stepper & Dropdown > */}
        <div className="flex items-center bg-black/50 rounded-lg border border-white/10 p-0.5">
          <button
            id="btn-preset-prev"
            onClick={() => handleStepPreset(-1)}
            className="p-1 text-slate-400 hover:text-white hover:bg-white/10 rounded cursor-pointer"
            title="Previous Preset"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <select
            id="preset-dropdown"
            value={currentIdx}
            onChange={(e) => {
              onSelectPreset(parseInt(e.target.value, 10));
              e.currentTarget.blur();
            }}
            className="bg-transparent text-white font-mono text-[11px] font-semibold px-1.5 py-0.5 focus:outline-none cursor-pointer max-w-[200px]"
            title="Browse All 30+ Studio Presets & Custom Sounds"
          >
            {allPresets.map((p, idx) => (
              <option key={p.id} value={idx} className="bg-slate-900 text-white">
                {p.hotkeyLabel ? `[${p.hotkeyLabel}] ` : ''}
                {p.name} · {p.category}
              </option>
            ))}
          </select>
          <button
            id="btn-preset-next"
            onClick={() => handleStepPreset(1)}
            className="p-1 text-slate-400 hover:text-white hover:bg-white/10 rounded cursor-pointer"
            title="Next Preset"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 6 Pinned Hotkey Slots [5]-[9] & [0] */}
        <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-white/5 flex-wrap">
          {hotkeySlots.map((p, idx) => {
            const isActive = currentPreset.id === p.id;
            const displayLabel = p.isSamplerVoice
              ? currentSample
                ? `${currentSample.name.slice(0, 10)}`
                : 'Multi-Voice'
              : p.name;

            return (
              <button
                key={p.id}
                id={`btn-preset-${p.id}`}
                onClick={() => onSelectPreset(idx)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md font-mono text-[11px] transition-all cursor-pointer ${
                  isActive
                    ? 'bg-white/10 text-white font-medium border border-white/15'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                }`}
                style={{
                  borderColor: isActive ? p.color : undefined,
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: p.color }}
                />
                <span>{displayLabel}</span>
                <kbd className="text-[9px] text-slate-500 bg-black/40 px-1 rounded border border-white/5 font-mono">
                  {p.hotkeyLabel}
                </kbd>
              </button>
            );
          })}
        </div>

        {/* Open Synth Lab & 30+ Preset Designer Modal */}
        {onOpenSynthLabModal && (
          <button
            id="btn-open-synth-lab"
            onClick={onOpenSynthLabModal}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-mono text-[11px] font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 cursor-pointer transition-all"
            title="Open Synth Lab: 30+ Presets, Sound Designer & Smart Sound Generator"
          >
            <Sliders className="h-3.5 w-3.5 text-amber-400" />
            <span>SYNTH LAB ({allPresets.length})</span>
          </button>
        )}

        {/* Open Mic / Multi-Voice Studio Modal */}
        <button
          id="btn-open-sampler-studio"
          onClick={onOpenSamplerModal}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-mono text-[11px] font-semibold bg-pink-500/15 hover:bg-pink-500/25 text-pink-300 border border-pink-500/40 cursor-pointer transition-all"
          title="Open Multi-Voice Studio & Keyboard Mapper"
        >
          <Mic className="h-3.5 w-3.5 text-pink-400" />
          <span>VOICE STUDIO</span>
        </button>
      </div>

      {/* Musical Harmony & Root */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded-lg border border-white/5">
          <span className="text-[10px] font-mono text-slate-500">KEY:</span>
          <select
            id="select-root-note"
            value={currentRoot}
            onChange={(e) => {
              onSelectRoot(e.target.value);
              e.currentTarget.blur();
            }}
            className="bg-transparent font-mono text-cyan-300 font-bold focus:outline-none cursor-pointer"
          >
            {ROOT_NOTES.map((r) => (
              <option key={r} value={r} className="bg-slate-900 text-white">
                {r}
              </option>
            ))}
          </select>
        </div>

        <div
          className="flex items-center gap-0.5 bg-black/50 p-0.5 rounded-lg border border-white/10"
          title={`${currentScale.name} (${currentScale.mood}) — ${currentScale.description}`}
        >
          <button
            id="btn-scale-prev"
            onClick={() => handleStepScale(-1)}
            className="p-1 text-slate-400 hover:text-white hover:bg-white/10 rounded cursor-pointer"
            title="Previous Musical Scale"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-mono text-slate-500 pl-0.5">SCALE:</span>
          <select
            id="select-scale-mode"
            value={currentScale.id}
            onChange={(e) => {
              const found = SCALES.find((s) => s.id === e.target.value);
              if (found) onSelectScale(found);
              e.currentTarget.blur();
            }}
            className="bg-transparent font-mono text-[11px] text-amber-200 font-semibold px-1 py-1 focus:outline-none cursor-pointer max-w-[195px]"
          >
            {SCALE_CATEGORIES.map((category) => (
              <optgroup
                key={category}
                label={`── ${category} ──`}
                className="bg-slate-950 text-amber-300 font-mono"
              >
                {SCALES.filter((s) => s.category === category).map((s) => (
                  <option key={s.id} value={s.id} className="bg-slate-900 text-white">
                    {s.name} ({s.mood})
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <button
            id="btn-scale-next"
            onClick={() => handleStepScale(1)}
            className="p-1 text-slate-400 hover:text-white hover:bg-white/10 rounded cursor-pointer"
            title="Next Musical Scale"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          id="btn-toggle-chord-mode"
          onClick={onToggleChordMode}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono text-[11px] border transition-all cursor-pointer ${
            isChordMode
              ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
              : 'bg-black/40 border-white/5 text-slate-400 hover:text-slate-200'
          }`}
          title="Toggle Triad Chord Mode (Hold Shift also triggers Chords)"
        >
          <Sparkles className="h-3 w-3 text-purple-400" />
          <span>CHORD</span>
          <span className="text-[9px] text-slate-500 uppercase bg-black/50 px-1 rounded border border-white/5">
            Shift
          </span>
        </button>
      </div>

      {/* BPM & Loop Length & Master Export */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded-lg border border-white/5 font-mono">
          <Clock className="h-3 w-3 text-slate-400" />
          <span className="text-slate-200 font-bold w-7 text-right">{bpm}</span>
          <span className="text-[10px] text-slate-500">BPM</span>
          <input
            type="range"
            id="slider-bpm"
            min={70}
            max={140}
            value={bpm}
            onChange={(e) => onChangeBpm(Number(e.target.value))}
            className="w-16 accent-cyan-400 cursor-pointer h-1.5"
          />
        </div>

        <div className="flex items-center bg-black/40 p-0.5 rounded-lg border border-white/5 font-mono text-[11px]">
          {([2, 4, 8] as const).map((b) => (
            <button
              key={b}
              id={`btn-loop-bars-${b}`}
              onClick={() => onChangeBars(b)}
              className={`px-2 py-0.5 rounded cursor-pointer transition-all ${
                bars === b
                  ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {b}B
            </button>
          ))}
        </div>

        {onOpenDiagnosticModal && (
          <button
            id="btn-open-diagnostic-modal"
            onClick={onOpenDiagnosticModal}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-mono text-[11px] font-semibold border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 transition-all cursor-pointer"
            title="Open AI Multi-Key Diagnostic & Acoustic Test Suite"
          >
            <Cpu className="h-3 w-3 text-cyan-400" />
            <span>AI TEST</span>
          </button>
        )}

        <button
          id="btn-master-export"
          onClick={handleExportClick}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-[11px] font-semibold border transition-all cursor-pointer ${
            isExporting
              ? 'bg-rose-500/20 border-rose-500 text-rose-300 animate-pulse'
              : 'bg-white/[0.04] border-white/10 text-slate-300 hover:bg-white/[0.08]'
          }`}
          title={isExporting ? 'Click to Stop & Save .webm' : 'Record all live & looped audio'}
        >
          {isExporting ? (
            <>
              <Square className="h-3 w-3 fill-rose-500 text-rose-500" />
              <span>{formatTimer(exportSeconds)} SAVE</span>
            </>
          ) : (
            <>
              <Circle className="h-3 w-3 fill-rose-500 text-rose-500" />
              <span>EXPORT .WEBM</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};

export const TopBar = React.memo(TopBarComponent);
