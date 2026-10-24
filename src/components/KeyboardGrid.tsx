import React, { useMemo, useState, useRef, useCallback } from 'react';
import { KeyNoteInfo, ROW_TOP, ROW_MID, ROW_BOT } from '../audio/scales';
import { RegisteredVoice, SamplerEngine } from '../audio/SamplerEngine';
import { Paintbrush, X, Check, Pencil, Mic, RotateCcw, Trash2, Sparkles } from 'lucide-react';

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
  onOpenSamplerModal?: () => void;
  isSamplerVoiceActive?: boolean;
}

interface KeyboardKeyButtonProps {
  code: string;
  keyInfo: KeyNoteInfo;
  isActive: boolean;
  assignedVoice: RegisteredVoice | null;
  isUnmappedInSampler: boolean;
  isPaintMode: boolean;
  isChordMode: boolean;
  onKeyPointerDown: (code: string) => void;
  onVirtualKeyUp: (code: string) => void;
}

const KeyboardKeyButton = React.memo<KeyboardKeyButtonProps>(
  ({
    code,
    keyInfo,
    isActive,
    assignedVoice,
    isUnmappedInSampler,
    isPaintMode,
    isChordMode,
    onKeyPointerDown,
    onVirtualKeyUp,
  }) => {
    return (
      <button
        id={`key-${code}`}
        data-key-code={code}
        onPointerDown={(e) => {
          e.preventDefault();
          onKeyPointerDown(code);
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
                boxShadow: isActive ? `0 0 12px ${assignedVoice.color}50` : undefined,
              }
            : undefined
        }
        className={`group relative flex flex-col justify-between p-1.5 sm:p-2 rounded-lg sm:rounded-xl border select-none touch-none cursor-pointer flex-1 min-w-0 h-[80px] sm:h-[88px] ${
          isActive
            ? assignedVoice
              ? 'translate-y-0.5 bg-black/60'
              : 'bg-cyan-500/25 border-cyan-400 text-white translate-y-0.5'
            : isUnmappedInSampler
            ? 'bg-[#0d0f17]/50 border-white/[0.04] text-slate-500 hover:border-white/10'
            : isPaintMode
            ? 'bg-[#141724] border-white/20 hover:border-cyan-400/80 hover:bg-[#1a1f33]'
            : 'bg-[#12151f] border-white/[0.08] text-slate-300 hover:border-white/20 hover:bg-[#181c2a]'
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
            <span className="text-[9px] font-mono text-slate-600 tracking-wider">—</span>
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
  }
);

const ALL_30_KEYS = [...ROW_TOP, ...ROW_MID, ...ROW_BOT];

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
  onOpenSamplerModal,
  isSamplerVoiceActive = false,
}) => {
  const isChordMode = isShiftHeld || isChordModeToggled;

  // Inline rename state on docked palette bar
  const [isRenamingDocked, setIsRenamingDocked] = useState(false);
  const [dockedRenameText, setDockedRenameText] = useState('');
  const dockedRenameInputRef = useRef<HTMLInputElement | null>(null);

  // O(1) Voice Map lookup instead of O(N) array search per key
  const voiceById = useMemo(() => {
    const map = new Map<string, RegisteredVoice>();
    for (let i = 0; i < voices.length; i++) {
      map.set(voices[i].id, voices[i]);
    }
    return map;
  }, [voices]);

  const activePaintVoice = activePaintVoiceId
    ? voiceById.get(activePaintVoiceId) ||
      SamplerEngine.getInstance().getVoiceById(activePaintVoiceId)
    : voices[0] || null;

  const isPaintModeRef = useRef(isPaintMode);
  isPaintModeRef.current = isPaintMode;
  const activePaintVoiceIdRef = useRef(activePaintVoice?.id || null);
  activePaintVoiceIdRef.current = activePaintVoice?.id || null;
  const keyVoiceMapRef = useRef(keyVoiceMap);
  keyVoiceMapRef.current = keyVoiceMap;

  const handleKeyPointerDown = useCallback(
    (code: string) => {
      if (isPaintModeRef.current && activePaintVoiceIdRef.current) {
        const targetId = activePaintVoiceIdRef.current;
        SamplerEngine.getInstance().setPaintVoice(targetId);
        const alreadyAssigned = keyVoiceMapRef.current[code] === targetId;
        SamplerEngine.getInstance().setKeyVoiceExplicit(code, alreadyAssigned ? null : targetId);
      }
      onVirtualKeyDown(code);
    },
    [onVirtualKeyDown]
  );

  const handleSelectBrushVoice = (voice: RegisteredVoice) => {
    SamplerEngine.getInstance().setPaintVoice(voice.id);
    SamplerEngine.getInstance().previewVoice(voice.id);
    onStartPaintMode?.(voice.id);
  };

  const handleFillKeys = (codes: string[]) => {
    if (!activePaintVoice) return;
    SamplerEngine.getInstance().assignKeysToVoice(codes, activePaintVoice.id);
    if (!isSamplerVoiceActive && onStartPaintMode) {
      onStartPaintMode(activePaintVoice.id);
    }
  };

  const handleStartDockedRename = () => {
    if (!activePaintVoice) return;
    setDockedRenameText(activePaintVoice.name);
    setIsRenamingDocked(true);
    requestAnimationFrame(() => {
      dockedRenameInputRef.current?.focus();
      dockedRenameInputRef.current?.select();
    });
  };

  const handleCommitDockedRename = () => {
    if (activePaintVoice && dockedRenameText.trim()) {
      SamplerEngine.getInstance().renameVoice(activePaintVoice.id, dockedRenameText.trim());
    }
    setIsRenamingDocked(false);
  };

  const showDockedPalette = isSamplerVoiceActive || isPaintMode;

  const renderKey = (code: string) => {
    const keyInfo = keyboardMap.get(code);
    if (!keyInfo) return null;

    const isActive = activeKeys.has(code);
    const assignedVoiceId = keyVoiceMap[code];
    const assignedVoice = assignedVoiceId
      ? voiceById.get(assignedVoiceId) ||
        SamplerEngine.getInstance().getVoiceById(assignedVoiceId)
      : null;
    const isUnmappedInSampler = isSamplerVoiceActive && !assignedVoice;

    return (
      <KeyboardKeyButton
        key={code}
        code={code}
        keyInfo={keyInfo}
        isActive={isActive}
        assignedVoice={assignedVoice}
        isUnmappedInSampler={isUnmappedInSampler}
        isPaintMode={isPaintMode}
        isChordMode={isChordMode}
        onKeyPointerDown={handleKeyPointerDown}
        onVirtualKeyUp={onVirtualKeyUp}
      />
    );
  };

  return (
    <div className="flex flex-col gap-2 w-full bg-[#0c0e14] border border-white/5 rounded-2xl p-3.5 relative">
      {/* Docked Voice Palette & 1-Click Key Mapper Bar (No Modal Hopping Needed) */}
      {showDockedPalette && activePaintVoice && (
        <div
          id="docked-voice-palette-bar"
          className="flex flex-col gap-2 p-2.5 mb-0.5 rounded-xl bg-[#111522] border border-pink-500/25"
        >
          {/* Top Row: Active Brush Status, Inline Rename & 1-Click Row/Keyboard Fills */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Toggle Paint Mode Button */}
              <button
                id="btn-docked-toggle-paint"
                onClick={() => {
                  if (isPaintMode) {
                    onExitPaintMode?.();
                  } else {
                    onStartPaintMode?.(activePaintVoice.id);
                  }
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono text-xs font-bold border transition-colors cursor-pointer ${
                  isPaintMode
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                    : 'bg-white/5 border-white/15 text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
                title="Toggle Click Key Painting Mode"
              >
                <Paintbrush className={`w-3.5 h-3.5 ${isPaintMode ? 'text-cyan-300 animate-pulse' : 'text-pink-400'}`} />
                <span>{isPaintMode ? 'BRUSH ON (Click Keys)' : 'CLICK TO PAINT KEYS'}</span>
              </button>

              {/* Selected Brush Voice + Inline Rename */}
              <div className="flex items-center gap-1.5 bg-black/50 border border-white/10 rounded-lg px-2 py-1 font-mono text-xs">
                <span className="text-[10px] text-slate-400 uppercase">Brush:</span>
                {isRenamingDocked ? (
                  <div className="flex items-center gap-1">
                    <input
                      ref={dockedRenameInputRef}
                      id="input-docked-rename-voice"
                      type="text"
                      value={dockedRenameText}
                      maxLength={28}
                      onChange={(e) => setDockedRenameText(e.target.value)}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Enter') handleCommitDockedRename();
                        if (e.key === 'Escape') setIsRenamingDocked(false);
                      }}
                      className="w-32 bg-black border border-pink-400 rounded px-1.5 py-0.5 text-xs font-mono font-bold text-white focus:outline-none"
                    />
                    <button
                      id="btn-docked-save-rename"
                      onClick={handleCommitDockedRename}
                      className="p-0.5 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 cursor-pointer"
                      title="Save Name"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      id="btn-docked-cancel-rename"
                      onClick={() => setIsRenamingDocked(false)}
                      className="p-0.5 rounded bg-white/10 text-slate-300 hover:bg-white/20 cursor-pointer"
                      title="Cancel"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <span
                      className="px-1.5 py-0.5 rounded font-bold flex items-center gap-1 cursor-pointer"
                      style={{
                        backgroundColor: `${activePaintVoice.color}28`,
                        color: activePaintVoice.color,
                      }}
                      onClick={handleStartDockedRename}
                      title="Click to rename selected voice"
                    >
                      ● {activePaintVoice.name}
                    </span>
                    <button
                      id="btn-docked-rename-voice"
                      onClick={handleStartDockedRename}
                      className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-pink-300 cursor-pointer"
                      title="Rename selected voice"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Right: 1-Click Quick-Fill Buttons */}
            <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
              <button
                id="btn-docked-fill-all"
                onClick={() => handleFillKeys(ALL_30_KEYS)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-pink-500/20 hover:bg-pink-500/30 text-pink-200 border border-pink-500/40 font-bold cursor-pointer"
                title={`Map "${activePaintVoice.name}" across all 30 keyboard keys to play it melodically`}
              >
                <Sparkles className="w-3 h-3 text-pink-400" />
                <span>FILL ALL 30 KEYS</span>
              </button>

              <button
                id="btn-docked-fill-top"
                onClick={() => handleFillKeys(ROW_TOP)}
                className="px-2 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 font-semibold cursor-pointer"
                title={`Fill High Row [Q-P] with "${activePaintVoice.name}"`}
              >
                Fill High [Q-P]
              </button>

              <button
                id="btn-docked-fill-mid"
                onClick={() => handleFillKeys(ROW_MID)}
                className="px-2 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 font-semibold cursor-pointer"
                title={`Fill Mid Row [A-;] with "${activePaintVoice.name}"`}
              >
                Fill Mid [A-;]
              </button>

              <button
                id="btn-docked-fill-bot"
                onClick={() => handleFillKeys(ROW_BOT)}
                className="px-2 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 font-semibold cursor-pointer"
                title={`Fill Bass Row [Z-/] with "${activePaintVoice.name}"`}
              >
                Fill Bass [Z-/]
              </button>

              <button
                id="btn-docked-restore-30"
                onClick={() => SamplerEngine.getInstance().restoreDefaultKeyMap()}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 cursor-pointer"
                title="Restore default 30-word map while keeping your recorded voices"
              >
                <RotateCcw className="w-3 h-3" />
                <span>30-Word Map</span>
              </button>

              <button
                id="btn-docked-clear-all"
                onClick={() => SamplerEngine.getInstance().clearAllKeyMappings()}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-white/10 cursor-pointer"
                title="Unmap all keys"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear</span>
              </button>

              {onOpenSamplerModal && (
                <button
                  id="btn-docked-open-studio"
                  onClick={onOpenSamplerModal}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 font-bold cursor-pointer"
                  title="Record new microphone voice or upload audio file"
                >
                  <Mic className="w-3 h-3 text-rose-400" />
                  <span>+ REC MIC</span>
                </button>
              )}

              {isPaintMode && onExitPaintMode && (
                <button
                  id="btn-docked-exit-paint"
                  onClick={onExitPaintMode}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold cursor-pointer"
                >
                  <X className="w-3 h-3" />
                  <span>Done</span>
                </button>
              )}
            </div>
          </div>

          {/* Second Row: Horizontal Scrollable Voice Brush Palette */}
          <div
            id="docked-voice-chips"
            className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 scrollbar-thin"
          >
            <span className="text-[10px] font-mono uppercase text-slate-400 shrink-0 mr-1">
              Voices ({voices.length}):
            </span>
            {voices.map((voice) => {
              const isSelectedBrush = activePaintVoice.id === voice.id;
              return (
                <button
                  key={voice.id}
                  id={`docked-voice-chip-${voice.id}`}
                  onClick={() => handleSelectBrushVoice(voice)}
                  style={{
                    borderColor: isSelectedBrush ? voice.color : `${voice.color}40`,
                    backgroundColor: isSelectedBrush ? `${voice.color}28` : '#0a0c12',
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-mono text-[11px] shrink-0 transition-all cursor-pointer ${
                    isSelectedBrush
                      ? 'text-white font-bold scale-[1.02]'
                      : 'text-slate-300 hover:text-white'
                  }`}
                  title={`Click to select "${voice.name}" brush, then click any key below to assign`}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: voice.color }}
                  />
                  <span>{voice.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Row 1: Octave 5 (Lead/Highs) */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <div data-row-fill="top" className="w-16 sm:w-20 shrink-0 flex flex-col gap-1">
          <span className="text-[9px] sm:text-[10px] font-mono uppercase text-cyan-400/80 font-semibold leading-tight">
            High [Q-P]
          </span>
          {showDockedPalette && activePaintVoice && (
            <button
              id="btn-row-fill-top"
              onClick={() => handleFillKeys(ROW_TOP)}
              className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 w-fit cursor-pointer"
              title={`Fill High Row [Q-P] with "${activePaintVoice.name}"`}
            >
              Fill Row
            </button>
          )}
        </div>
        <div className="flex gap-1 sm:gap-1.5 flex-1 min-w-0">
          {ROW_TOP.map((code) => renderKey(code))}
        </div>
      </div>

      {/* Row 2: Octave 4 (Chords/Main) */}
      <div className="flex items-center gap-1.5 sm:gap-2 pl-1.5 sm:pl-3">
        <div data-row-fill="mid" className="w-16 sm:w-20 shrink-0 flex flex-col gap-1">
          <span className="text-[9px] sm:text-[10px] font-mono uppercase text-amber-400/80 font-semibold leading-tight">
            Mid [A- ;]
          </span>
          {showDockedPalette && activePaintVoice && (
            <button
              id="btn-row-fill-mid"
              onClick={() => handleFillKeys(ROW_MID)}
              className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 w-fit cursor-pointer"
              title={`Fill Mid Row [A-;] with "${activePaintVoice.name}"`}
            >
              Fill Row
            </button>
          )}
        </div>
        <div className="flex gap-1 sm:gap-1.5 flex-1 min-w-0">
          {ROW_MID.map((code) => renderKey(code))}
        </div>
      </div>

      {/* Row 3: Octave 3 (Bass/Warm) */}
      <div className="flex items-center gap-1.5 sm:gap-2 pl-3 sm:pl-6">
        <div data-row-fill="bot" className="w-16 sm:w-20 shrink-0 flex flex-col gap-1">
          <span className="text-[9px] sm:text-[10px] font-mono uppercase text-emerald-400/80 font-semibold leading-tight">
            Bass [Z- /]
          </span>
          {showDockedPalette && activePaintVoice && (
            <button
              id="btn-row-fill-bot"
              onClick={() => handleFillKeys(ROW_BOT)}
              className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 w-fit cursor-pointer"
              title={`Fill Bass Row [Z-/] with "${activePaintVoice.name}"`}
            >
              Fill Row
            </button>
          )}
        </div>
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
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md border transition-colors cursor-pointer ${
              isSustainActive
                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-bold'
                : 'bg-black/30 border-white/5 text-slate-500 hover:text-slate-300 hover:border-white/10'
            }`}
            title="Sustain Pedal: Hold [Alt] or ['] or click to toggle latch"
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isSustainActive ? 'bg-cyan-400' : 'bg-slate-600'
              }`}
            />
            <span>SUSTAIN: [ALT / &apos;]</span>
          </button>

          <div
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md border ${
              isChordMode
                ? 'bg-purple-500/20 border-purple-400 text-purple-300 font-bold'
                : 'bg-black/30 border-white/5 text-slate-500'
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
            <span>TRIAD CHORDS: [SHIFT]</span>
          </div>

          {isSamplerVoiceActive && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-pink-500/10 border border-pink-500/30 text-pink-300 font-bold">
              <span className="h-1.5 w-1.5 rounded-full bg-pink-400" />
              <span>VOICE SAMPLER ACTIVE (Unmapped keys silent)</span>
            </div>
          )}

          {activePaintVoice && !isPaintMode && (
            <button
              id="btn-keyboard-start-paint"
              onClick={() => onStartPaintMode?.(activePaintVoice.id)}
              className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 border border-pink-500/40 text-[11px] font-mono font-semibold transition-colors cursor-pointer"
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
            <strong className="text-cyan-400">[Alt / &apos;]</strong> Sustain
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
