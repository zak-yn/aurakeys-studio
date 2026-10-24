import React, { useState, useEffect } from 'react';
import { Play, Square, Circle, Sparkles, Music2, Clock, Mic, Cpu } from 'lucide-react';
import { SCALES, ROOT_NOTES, ScaleDef } from '../audio/scales';
import { PRESETS, PresetConfig } from '../audio/presets';
import { CustomSampleData } from '../audio/SamplerEngine';

interface TopBarProps {
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
  onOpenDiagnosticModal?: () => void;
}

const TopBarComponent: React.FC<TopBarProps> = ({
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

  return (
    <header className="w-full border-b border-white/[0.08] bg-[#0c0e14] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2.5 text-xs select-none">
      {/* Brand & Transport Status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-tr from-cyan-500 to-indigo-500 flex items-center justify-center shadow-sm shadow-cyan-500/30">
            <Music2 className="h-4 w-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold tracking-tight text-white text-sm">AuraKeys</span>
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                Studio v2
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
              ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-sm shadow-amber-500/20'
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

      {/* Preset Bar (Hotkeys 5 - 9 & 0 for Sampler) + Mic Sample Studio Button */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {/* Compact Preset Dropdown */}
        <select
          id="preset-dropdown"
          value={PRESETS.findIndex((p) => p.name === currentPreset.name)}
          onChange={(e) => onSelectPreset(parseInt(e.target.value, 10))}
          className="bg-black/40 text-slate-300 border border-white/10 rounded px-2 py-1 focus:outline-none"
          title="Select Synth Preset"
        >
          {PRESETS.map((p, idx) => (
            <option key={idx} value={idx}>
              {p.name} ({p.category})
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-white/5 flex-wrap">
          <span className="text-[10px] font-mono text-slate-500 px-1.5">VOICE:</span>
          {PRESETS.map((p, idx) => {
            const isActive = currentPreset.id === p.id;
            const displayLabel =
              p.isSamplerVoice
                ? currentSample
                  ? `${currentSample.name.slice(0, 10)} (${currentSample.rootNoteOverride || currentSample.analysis.detectedNote})`
                  : 'Multi-Voice'
                : p.name;

            return (
              <button
                key={p.id}
                id={`btn-preset-${p.id}`}
                onClick={() => onSelectPreset(idx)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md font-mono text-[11px] transition-all cursor-pointer ${
                  isActive
                    ? 'bg-white/10 text-white font-medium border border-white/15 shadow-sm'
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

        {/* Open Mic / Multi-Voice Studio Modal */}
        <button
          id="btn-open-sampler-studio"
          onClick={onOpenSamplerModal}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-mono text-[11px] font-semibold bg-pink-500/15 hover:bg-pink-500/25 text-pink-300 border border-pink-500/40 shadow-sm shadow-pink-500/10 cursor-pointer transition-all"
          title="Open Multi-Voice Studio & Keyboard Mapper"
        >
          <Mic className="h-3.5 w-3.5 text-pink-400" />
          <span>VOICE STUDIO & MAPPER</span>
        </button>
      </div>

      {/* Musical Harmony & Root */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded-lg border border-white/5">
          <span className="text-[10px] font-mono text-slate-500">KEY:</span>
          <select
            id="select-root-note"
            value={currentRoot}
            onChange={(e) => onSelectRoot(e.target.value)}
            className="bg-transparent font-mono text-cyan-300 font-bold focus:outline-none cursor-pointer"
          >
            {ROOT_NOTES.map((r) => (
              <option key={r} value={r} className="bg-slate-900 text-white">
                {r}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded-lg border border-white/5">
          <span className="text-[10px] font-mono text-slate-500">SCALE:</span>
          <select
            id="select-scale-mode"
            value={currentScale.id}
            onChange={(e) => {
              const found = SCALES.find((s) => s.id === e.target.value);
              if (found) onSelectScale(found);
            }}
            className="bg-transparent font-sans text-slate-200 font-medium focus:outline-none cursor-pointer"
          >
            {SCALES.map((s) => (
              <option key={s.id} value={s.id} className="bg-slate-900 text-white">
                {s.name} ({s.mood})
              </option>
            ))}
          </select>
        </div>

        <button
          id="btn-toggle-chord-mode"
          onClick={onToggleChordMode}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono text-[11px] border transition-all cursor-pointer ${
            isChordMode
              ? 'bg-purple-500/20 border-purple-500/40 text-purple-300 shadow-sm shadow-purple-500/20'
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
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-mono text-[11px] font-semibold border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 transition-all cursor-pointer shadow-sm"
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
              ? 'bg-rose-500/20 border-rose-500 text-rose-300 shadow-sm shadow-rose-500/30 animate-pulse'
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
