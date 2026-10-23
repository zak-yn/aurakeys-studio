import React from 'react';
import { KeyNoteInfo, ROW_TOP, ROW_MID, ROW_BOT } from '../audio/scales';
import { RegisteredVoice, SamplerEngine } from '../audio/SamplerEngine';
import { Paintbrush, X } from 'lucide-react';

interface KeyboardGridProps {
  keyboardMap: Map<string, KeyNoteInfo>;
  activeKeys: Set<string>;
  isShiftHeld: boolean;
  isChordModeToggled: boolean;
  isSustainActive: boolean;
  onToggleSustain?: () => void;
  onVirtualKeyDown: (code: string) => void;
  onVirtualKeyUp: (code: string) => void;
  // Multi-Voice Key Mapping Props
  keyVoiceMap?: Record<string, string>;
  voices?: RegisteredVoice[];
  activePaintVoiceId?: string | null;
  isPaintMode?: boolean;
  onPaintKey?: (code: string) => void;
  onStartPaintMode?: (voiceId: string) => void;
  onExitPaintMode?: () => void;
  isSamplerVoiceActive?: boolean;
}

const KeyboardGridComponent: React.FC<KeyboardGridProps> = ({
  keyboardMap,
  activeKeys,
  isShiftHeld,
  isChordModeToggled,
  isSustainActive,
  onToggleSustain,
  onVirtualKeyDown,
  onVirtualKeyUp,
  keyVoiceMap = {},
  voices = [],
  activePaintVoiceId = null,
  isPaintMode = false,
  onPaintKey,
  onStartPaintMode,
  onExitPaintMode,
  isSamplerVoiceActive = false,
}) => {
  const isChordMode = isShiftHeld || isChordModeToggled;
  const activePaintVoice =
    voices.find((v) => v.id === activePaintVoiceId) ||
    (activePaintVoiceId ? SamplerEngine.getInstance().getVoiceById(activePaintVoiceId) : null);

  const renderKey = (code: string) => {
    const keyInfo = keyboardMap.get(code);
    if (!keyInfo) return null;

    const isActive = activeKeys.has(code);
    const assignedVoiceId = keyVoiceMap[code];
    const assignedVoice = assignedVoiceId
      ? voices.find((v) => v.id === assignedVoiceId) || SamplerEngine.getInstance().getVoiceById(assignedVoiceId)
      : null;
    const isUnmappedInSampler = isSamplerVoiceActive && !assignedVoice;

    return (
      <button
        key={code}
        id={`key-${code}`}
        onPointerDown={(e) => {
          e.preventDefault();
          if (isPaintMode && onPaintKey) {
            onPaintKey(code);
          }
          onVirtualKeyDown(code);
        }}
        onPointerUp={(e) => {
          e.preventDefault();
          onVirtualKeyUp(code);
        }}
        onPointerLeave={() => {
          if (isActive) onVirtualKeyUp(code);
        }}
        style={
          assignedVoice
            ? {
                borderColor: isActive
                  ? assignedVoice.color
                  : isPaintMode
                  ? `${assignedVoice.color}80`
                  : `${assignedVoice.color}40`,
                boxShadow: isActive ? `0 0 16px ${assignedVoice.color}60` : undefined,
              }
            : undefined
        }
        className={`group relative flex flex-col justify-between p-1.5 sm:p-2 rounded-lg sm:rounded-xl border transition-all duration-75 select-none touch-none cursor-pointer flex-1 min-w-0 h-[80px] sm:h-[88px] ${
          isActive
            ? assignedVoice
              ? 'translate-y-0.5 bg-black/60'
              : 'bg-cyan-500/25 border-cyan-400 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)] translate-y-0.5'
            : isUnmappedInSampler
            ? 'bg-[#0d0f17]/50 border-white/[0.04] text-slate-500 hover:border-white/10'
            : isPaintMode
            ? 'bg-[#141724] border-white/20 hover:border-cyan-400/80 hover:bg-[#1a1f33]'
            : 'bg-[#12151f]/80 border-white/[0.08] text-slate-300 hover:border-white/20 hover:bg-[#181c2a]'
        }`}
      >
        <div className="flex items-center justify-between w-full">
          <span
            className={`font-mono font-bold text-[10px] sm:text-xs px-1 sm:px-1.5 py-0.5 rounded leading-none ${
              isActive
                ? assignedVoice
                  ? 'text-slate-950'
                  : 'bg-cyan-400 text-slate-950'
                : 'bg-black/40 text-slate-400 border border-white/5'
            }`}
            style={isActive && assignedVoice ? { backgroundColor: assignedVoice.color } : undefined}
          >
            {keyInfo.label}
          </span>
          <span className="text-[9px] sm:text-[10px] font-mono text-slate-500 leading-none">
            {keyInfo.scaleDegree}
          </span>
        </div>

        {/* Assigned Voice Tag Pill */}
        {assignedVoice ? (
          <div
            className="flex items-center gap-1 w-full px-1.5 py-1 rounded-md text-[10px] sm:text-[11px] font-mono font-semibold truncate shrink-0 my-0.5 border"
            style={{
              backgroundColor: `${assignedVoice.color}1c`,
              borderColor: `${assignedVoice.color}50`,
            }}
            title={`Assigned Voice: ${assignedVoice.name} (Root: ${
              assignedVoice.rootNoteOverride || assignedVoice.analysis.detectedNote
            })`}
          >
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: assignedVoice.color }}
            />
            <span className="truncate font-semibold tracking-tight text-white/95 leading-normal">
              {assignedVoice.name}
            </span>
          </div>
        ) : isUnmappedInSampler ? (
          <div className="flex items-center justify-center w-full my-auto shrink-0 opacity-40">
            <span className="text-[9px] font-mono text-slate-600 tracking-wider">
              —
            </span>
          </div>
        ) : (
          <div className="flex-1 min-h-[4px]" />
        )}

        <div className="flex items-end justify-between w-full">
          <span
            className={`font-mono font-bold text-xs sm:text-sm leading-tight tracking-tight ${
              isActive
                ? assignedVoice
                  ? 'text-white'
                  : 'text-cyan-300'
                : isUnmappedInSampler
                ? 'text-slate-600'
                : 'text-slate-100'
            }`}
          >
            {keyInfo.note}
          </span>
          {isChordMode && !assignedVoice && (
            <span className="text-[8px] sm:text-[9px] font-mono text-purple-300 truncate leading-none">
              [{keyInfo.chordNotes.join(',')}]
            </span>
          )}
        </div>
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-2 w-full bg-[#0c0e14]/90 border border-white/5 rounded-2xl p-3.5 backdrop-blur-md relative">
      {/* Paint Mode Active Banner */}
      {isPaintMode && activePaintVoice && (
        <div className="flex items-center justify-between px-3 py-1.5 mb-1 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-200 text-xs font-mono">
          <div className="flex items-center gap-2">
            <Paintbrush className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span>
              <strong>Paint Mode Active:</strong> Click any key to map{' '}
              <span
                className="px-1.5 py-0.5 rounded font-bold"
                style={{
                  backgroundColor: `${activePaintVoice.color}30`,
                  color: activePaintVoice.color,
                }}
              >
                ● {activePaintVoice.name}
              </span>
              . Click an assigned key to unmap it.
            </span>
          </div>
          {onExitPaintMode && (
            <button
              onClick={onExitPaintMode}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-slate-300 text-[11px] transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              <span>Done Painting</span>
            </button>
          )}
        </div>
      )}

      {/* Row 1: Octave 5 (Lead/Highs) */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <span className="w-16 sm:w-20 text-[9px] sm:text-[10px] font-mono uppercase text-cyan-400/80 shrink-0 font-semibold">
          High [Q-P]
        </span>
        <div className="flex gap-1 sm:gap-1.5 flex-1 min-w-0">
          {ROW_TOP.map((code) => renderKey(code))}
        </div>
      </div>

      {/* Row 2: Octave 4 (Chords/Main) */}
      <div className="flex items-center gap-1.5 sm:gap-2 pl-1.5 sm:pl-3">
        <span className="w-16 sm:w-20 text-[9px] sm:text-[10px] font-mono uppercase text-amber-400/80 shrink-0 font-semibold">
          Mid [A- ;]
        </span>
        <div className="flex gap-1 sm:gap-1.5 flex-1 min-w-0">
          {ROW_MID.map((code) => renderKey(code))}
        </div>
      </div>

      {/* Row 3: Octave 3 (Bass/Warm) */}
      <div className="flex items-center gap-1.5 sm:gap-2 pl-3 sm:pl-6">
        <span className="w-16 sm:w-20 text-[9px] sm:text-[10px] font-mono uppercase text-emerald-400/80 shrink-0 font-semibold">
          Bass [Z- /]
        </span>
        <div className="flex gap-1 sm:gap-1.5 flex-1 min-w-0">
          {ROW_BOT.map((code) => renderKey(code))}
        </div>
      </div>

      {/* Bottom Keyboard Hotkey Status Strip */}
      <div className="flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-400 border-t border-white/5 pt-2 mt-1 gap-2">
        <div className="flex items-center gap-3">
          <button
            id="btn-toggle-sustain"
            onClick={onToggleSustain}
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
              isSustainActive
                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-bold shadow-sm shadow-cyan-500/20'
                : 'bg-black/30 border-white/5 text-slate-500 hover:text-slate-300 hover:border-white/10'
            }`}
            title="Sustain Pedal: Hold [Alt] or ['] or click to toggle latch"
          >
            <span className={`h-1.5 w-1.5 rounded-full ${isSustainActive ? 'bg-cyan-400 shadow-[0_0_6px_#22d3ee]' : 'bg-slate-600'}`} />
            <span>SUSTAIN: [ALT / ']</span>
          </button>

          <div
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md border transition-all ${
              isChordMode
                ? 'bg-purple-500/20 border-purple-400 text-purple-300 font-bold shadow-sm shadow-purple-500/20'
                : 'bg-black/30 border-white/5 text-slate-500'
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
            <span>TRIAD CHORDS: [SHIFT]</span>
          </div>

          {isSamplerVoiceActive && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-pink-500/10 border border-pink-500/30 text-pink-300 font-bold">
              <span className="h-1.5 w-1.5 rounded-full bg-pink-400 animate-pulse" />
              <span>VOICE SAMPLER ACTIVE (Unmapped keys silent)</span>
            </div>
          )}

          {activePaintVoice && !isPaintMode && (
            <button
              id="btn-keyboard-start-paint"
              onClick={() => onStartPaintMode?.(activePaintVoice.id)}
              className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 border border-pink-500/40 text-[11px] font-mono font-semibold transition-all cursor-pointer"
            >
              <Paintbrush className="w-3.5 h-3.5 text-pink-400" />
              <span>PAINT KEYS ({activePaintVoice.name.slice(0, 16)})</span>
            </button>
          )}
        </div>

        {/* Quick Hotkey Legend */}
        <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-500">
          <span>
            <strong className="text-emerald-400">[Space]</strong> Play/Pause
          </span>
          <span>
            <strong className="text-cyan-400">[Alt / ']</strong> Sustain
          </span>
          <span>
            <strong className="text-slate-300">[1-4]</strong> Rec Track
          </span>
          <span>
            <strong className="text-slate-300">[Shift+1-4]</strong> Mute
          </span>
          <span>
            <strong className="text-slate-300">[5-9]</strong> Synths
          </span>
          <span>
            <strong className="text-pink-400">[0]</strong> Multi-Voice Sampler
          </span>
          <span>
            <strong className="text-cyan-400">[` - = []</strong> Drum Pads
          </span>
          <span>
            <strong className="text-slate-300">[Tab]</strong> Drum Mute
          </span>
          <span>
            <strong className="text-slate-300">[Backspace]</strong> Clear
          </span>
        </div>
      </div>
    </div>
  );
};

export const KeyboardGrid = React.memo(KeyboardGridComponent);
