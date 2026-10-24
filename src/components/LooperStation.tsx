import React, { useState, useRef } from 'react';
import {
  Circle,
  VolumeX,
  Volume2,
  Trash2,
  Mic,
  Grid,
  Clock,
  ChevronLeft,
  ChevronRight,
  Magnet,
  X,
} from 'lucide-react';
import { LooperTrack, LoopNoteEvent, QuantizeMode } from '../audio/LooperEngine';
import { PRESETS, PresetConfig } from '../audio/presets';

interface LooperStationProps {
  tracks: LooperTrack[];
  allPresets?: PresetConfig[];
  selectedTrackIndex: number;
  currentStep: number;
  totalSteps: number;
  onSelectTrack: (index: number) => void;
  onToggleRecord: (index: number) => void;
  onToggleMute: (index: number) => void;
  onClearTrack: (index: number) => void;
  onChangeVolume: (index: number, volDb: number) => void;
  onChangeTrackPreset?: (trackIndex: number, preset: PresetConfig) => void;
  onChangeTrackQuantize?: (trackIndex: number, mode: QuantizeMode) => void;
  onSnapTrackToGrid?: (trackIndex: number) => void;
  onNudgeTrackTiming?: (trackIndex: number, deltaSteps: number) => void;
  onMoveNoteEvent?: (trackIndex: number, eventId: string, targetRawStep: number) => void;
  onDeleteNoteEvent?: (trackIndex: number, eventId: string) => void;
}

const StaticTimelineGrid = React.memo<{ totalSteps: number; quantizeMode: QuantizeMode }>(
  ({ totalSteps, quantizeMode }) => {
    return (
      <div className="absolute inset-0 flex pointer-events-none">
        {Array.from({ length: totalSteps }).map((_, stepIdx) => {
          const isBarStart = stepIdx % 16 === 0;
          const isBeatStart = stepIdx % 4 === 0;
          const isEighthStart = stepIdx % 2 === 0;

          let borderClass = 'border-white/[0.025]';
          if (quantizeMode === 'free') {
            borderClass = isBarStart
              ? 'border-white/15 bg-white/[0.01]'
              : isBeatStart
              ? 'border-white/[0.04] border-dashed'
              : 'border-transparent';
          } else if (quantizeMode === '4n') {
            borderClass = isBarStart
              ? 'border-cyan-400/30 bg-white/[0.015]'
              : isBeatStart
              ? 'border-cyan-400/15'
              : 'border-white/[0.015]';
          } else if (quantizeMode === '8n') {
            borderClass = isBarStart
              ? 'border-white/20 bg-white/[0.015]'
              : isBeatStart
              ? 'border-white/[0.09]'
              : isEighthStart
              ? 'border-white/[0.05]'
              : 'border-white/[0.015]';
          } else {
            borderClass = isBarStart
              ? 'border-white/20 bg-white/[0.015]'
              : isBeatStart
              ? 'border-white/[0.08]'
              : 'border-white/[0.03]';
          }

          return <div key={stepIdx} className={`h-full flex-1 border-r ${borderClass}`} />;
        })}
      </div>
    );
  }
);

interface RecordedEventsLayerProps {
  trackIdx: number;
  events: LoopNoteEvent[];
  totalSteps: number;
  color: string;
  quantizeMode: QuantizeMode;
  onMoveNoteEvent?: (trackIndex: number, eventId: string, targetRawStep: number) => void;
  onDeleteNoteEvent?: (trackIndex: number, eventId: string) => void;
}

const RecordedEventsLayer = React.memo<RecordedEventsLayerProps>(
  ({
    trackIdx,
    events,
    totalSteps,
    color,
    quantizeMode,
    onMoveNoteEvent,
    onDeleteNoteEvent,
  }) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [dragState, setDragState] = useState<{
      eventId: string;
      previewPosSteps: number;
    } | null>(null);

    const computeDisplaySteps = (ev: LoopNoteEvent) => {
      if (dragState && dragState.eventId === ev.id) {
        return dragState.previewPosSteps;
      }
      if (quantizeMode === 'free') {
        return ev.step + (ev.microOffsetSteps || 0);
      }
      return ev.step;
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>, ev: LoopNoteEvent) => {
      if (e.button === 2) return; // Right click handled by context menu
      e.stopPropagation();
      const container = containerRef.current;
      if (!container || !onMoveNoteEvent) return;

      const rect = container.getBoundingClientRect();
      const startX = e.clientX;
      const initialStepPos =
        quantizeMode === 'free' ? ev.step + (ev.microOffsetSteps || 0) : ev.step;

      let latestRawTarget = initialStepPos;
      setDragState({ eventId: ev.id, previewPosSteps: initialStepPos });

      const handleWindowPointerMove = (moveEvt: PointerEvent) => {
        const deltaX = moveEvt.clientX - startX;
        const deltaSteps = (deltaX / Math.max(1, rect.width)) * totalSteps;
        const rawTarget =
          (((initialStepPos + deltaSteps) % totalSteps) + totalSteps) % totalSteps;

        latestRawTarget = rawTarget;
        let previewPos = rawTarget;
        if (quantizeMode !== 'free') {
          const gridUnit = quantizeMode === '4n' ? 4 : quantizeMode === '8n' ? 2 : 1;
          previewPos = (Math.round(rawTarget / gridUnit) * gridUnit) % totalSteps;
        }
        setDragState({ eventId: ev.id, previewPosSteps: previewPos });
      };

      const handleWindowPointerUp = () => {
        window.removeEventListener('pointermove', handleWindowPointerMove);
        window.removeEventListener('pointerup', handleWindowPointerUp);
        setDragState(null);
        onMoveNoteEvent(trackIdx, ev.id, latestRawTarget);
      };

      window.addEventListener('pointermove', handleWindowPointerMove);
      window.addEventListener('pointerup', handleWindowPointerUp);
    };

    return (
      <div ref={containerRef} className="absolute inset-0">
        {events.map((ev) => {
          const posSteps = computeDisplaySteps(ev);
          const leftPct = (posSteps / totalSteps) * 100;
          const widthPct = Math.max(1.4, (ev.durationSteps / totalSteps) * 100);
          const isBeingDragged = dragState?.eventId === ev.id;
          const isOffGridFree = quantizeMode === 'free' && (ev.microOffsetSteps || 0) > 0.04;

          return (
            <div
              key={ev.id}
              data-testid={`loop-note-event-${trackIdx}-${ev.id}`}
              onPointerDown={(e) => handlePointerDown(e, ev)}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (onDeleteNoteEvent) onDeleteNoteEvent(trackIdx, ev.id);
              }}
              title={`Note: ${ev.notes.join(', ')} • Step ${(posSteps + 1).toFixed(
                quantizeMode === 'free' ? 2 : 0
              )} (Drag left/right to adjust timing, Right-click to delete)`}
              className={`group absolute top-1 bottom-1 rounded flex items-center justify-between px-1 text-[9px] font-mono text-white/95 overflow-hidden select-none cursor-grab active:cursor-grabbing transition-shadow ${
                isBeingDragged
                  ? 'ring-2 ring-white z-20 shadow-lg'
                  : 'hover:ring-1 hover:ring-white/80 z-10'
              } ${isOffGridFree ? 'border border-dashed border-white/60' : ''}`}
              style={{
                left: `${leftPct}%`,
                width: `${widthPct}%`,
                backgroundColor: color,
              }}
            >
              <span className="truncate pointer-events-none">
                {isBeingDragged
                  ? `${(posSteps + 1).toFixed(quantizeMode === 'free' ? 1 : 0)}`
                  : ev.notes.join(',')}
              </span>
              {onDeleteNoteEvent && (
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteNoteEvent(trackIdx, ev.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 ml-0.5 p-0.5 rounded bg-black/40 hover:bg-rose-500 text-white transition-opacity cursor-pointer shrink-0"
                  title="Delete this note"
                >
                  <X className="h-2 w-2" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    );
  }
);

interface TrackHeaderRowProps {
  track: LooperTrack;
  idx: number;
  allPresets: PresetConfig[];
  onToggleRecord: (index: number) => void;
  onToggleMute: (index: number) => void;
  onClearTrack: (index: number) => void;
  onChangeVolume: (index: number, volDb: number) => void;
  onChangeTrackPreset?: (trackIndex: number, preset: PresetConfig) => void;
  onChangeTrackQuantize?: (trackIndex: number, mode: QuantizeMode) => void;
  onSnapTrackToGrid?: (trackIndex: number) => void;
  onNudgeTrackTiming?: (trackIndex: number, deltaSteps: number) => void;
}

const TrackHeaderRow = React.memo<TrackHeaderRowProps>(
  ({
    track,
    idx,
    allPresets,
    onToggleRecord,
    onToggleMute,
    onClearTrack,
    onChangeVolume,
    onChangeTrackPreset,
    onChangeTrackQuantize,
    onSnapTrackToGrid,
    onNudgeTrackTiming,
  }) => {
    const isRecording = track.state === 'RECORDING';
    const isOverdubbing = track.state === 'OVERDUBBING';
    const isPlaying = track.state === 'PLAYING';
    const isEmpty = track.state === 'EMPTY';
    const hasEvents = track.events.length > 0;
    const isFreeMode = track.quantizeMode === 'free';
    const nudgeDelta = isFreeMode ? 0.25 : 1;

    return (
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <div
            className="flex items-center justify-center w-6 h-6 rounded-md font-mono text-xs font-bold text-white"
            style={{
              backgroundColor: `${track.color}25`,
              border: `1px solid ${track.color}60`,
            }}
          >
            {idx + 1}
          </div>

          <span className="text-xs font-medium text-slate-200">{track.name}</span>

          {/* Live Track Instrument Swapper Dropdown */}
          <div
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-mono"
            style={{
              color: track.preset.color,
              borderColor: `${track.preset.color}40`,
              backgroundColor: `${track.preset.color}15`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {track.preset.isSamplerVoice && <Mic className="h-2.5 w-2.5 shrink-0" />}
            <select
              id={`select-track-preset-${idx}`}
              value={track.preset.id}
              onChange={(e) => {
                const chosen = allPresets.find((p) => p.id === e.target.value);
                if (chosen && onChangeTrackPreset) {
                  onChangeTrackPreset(idx, chosen);
                }
                e.currentTarget.blur();
              }}
              className="bg-transparent font-mono text-[10px] font-semibold focus:outline-none cursor-pointer max-w-[130px]"
              style={{ color: track.preset.color }}
              title="Swap Track Instrument (works live even while loop is playing!)"
            >
              {allPresets.map((p) => (
                <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                  {p.name} ({p.category})
                </option>
              ))}
            </select>
          </div>

          {/* Timing Grid / Quantize Mode Selector + Post-Recording Nudge */}
          <div
            className="flex items-center gap-1 bg-black/35 px-1.5 py-0.5 rounded-md border border-white/10 text-[10px] font-mono"
            onClick={(e) => e.stopPropagation()}
          >
            {isFreeMode ? (
              <Clock className="h-2.5 w-2.5 text-amber-400 shrink-0" />
            ) : (
              <Grid className="h-2.5 w-2.5 text-cyan-400 shrink-0" />
            )}
            <select
              id={`select-track-quantize-${idx}`}
              value={track.quantizeMode}
              onChange={(e) => {
                if (onChangeTrackQuantize) {
                  onChangeTrackQuantize(idx, e.target.value as QuantizeMode);
                }
                e.currentTarget.blur();
              }}
              className={`bg-transparent font-mono text-[10px] font-semibold focus:outline-none cursor-pointer ${
                isFreeMode ? 'text-amber-300' : 'text-cyan-300'
              }`}
              title="Timing Mode: Choose Auto-Snap Grid (1/16, 1/8, 1/4) or Free Timing (As-Is). Works before AND after recording!"
            >
              <option value="16n" className="bg-slate-900 text-cyan-300">
                GRID 1/16 (Auto-Snap)
              </option>
              <option value="8n" className="bg-slate-900 text-cyan-300">
                GRID 1/8 (Auto-Snap)
              </option>
              <option value="4n" className="bg-slate-900 text-cyan-300">
                GRID 1/4 (Beat Snap)
              </option>
              <option value="free" className="bg-slate-900 text-amber-300">
                FREE (As-Is Timing)
              </option>
            </select>

            {/* Post-Recording Timing Adjust Buttons (Nudge Left / Right & Snap) */}
            {hasEvents && (
              <div className="flex items-center gap-0.5 pl-1 ml-0.5 border-l border-white/10">
                <button
                  type="button"
                  id={`btn-track-nudge-left-${idx}`}
                  onClick={() => onNudgeTrackTiming && onNudgeTrackTiming(idx, -nudgeDelta)}
                  className="p-0.5 rounded hover:bg-white/10 text-slate-300 hover:text-white cursor-pointer"
                  title={`Shift recorded notes earlier (-${nudgeDelta} step)`}
                >
                  <ChevronLeft className="h-2.5 w-2.5" />
                </button>
                <button
                  type="button"
                  id={`btn-track-nudge-right-${idx}`}
                  onClick={() => onNudgeTrackTiming && onNudgeTrackTiming(idx, nudgeDelta)}
                  className="p-0.5 rounded hover:bg-white/10 text-slate-300 hover:text-white cursor-pointer"
                  title={`Shift recorded notes later (+${nudgeDelta} step)`}
                >
                  <ChevronRight className="h-2.5 w-2.5" />
                </button>
                {isFreeMode && onSnapTrackToGrid && (
                  <button
                    type="button"
                    id={`btn-track-snap-now-${idx}`}
                    onClick={() => onSnapTrackToGrid(idx)}
                    className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-[9px] font-semibold cursor-pointer ml-0.5"
                    title="Snap all recorded notes on this track to the nearest 1/16 grid line"
                  >
                    <Magnet className="h-2.5 w-2.5" />
                    <span>SNAP</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* State Pill */}
          <span
            className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded font-semibold flex items-center gap-1 ${
              isRecording
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                : isOverdubbing
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : isPlaying
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-white/[0.03] text-slate-500 border border-white/5'
            }`}
          >
            {isRecording && <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />}
            {track.state}
          </span>
        </div>

        {/* Right: Actions (Rec, Mute, Clear, Volume) */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-black/30 px-2 py-1 rounded-md border border-white/5 text-[10px] font-mono text-slate-400">
            <Volume2 className="h-3 w-3 text-slate-500" />
            <input
              type="range"
              id={`slider-track-vol-${idx}`}
              min={-30}
              max={2}
              value={track.volumeDb}
              onChange={(e) => onChangeVolume(idx, Number(e.target.value))}
              className="w-14 accent-cyan-400 cursor-pointer h-1"
            />
          </div>

          <button
            id={`btn-track-rec-${idx}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleRecord(idx);
            }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-mono text-[11px] font-medium border transition-colors cursor-pointer ${
              isRecording
                ? 'bg-rose-500 text-white border-rose-400'
                : isOverdubbing
                ? 'bg-amber-500/30 text-amber-200 border-amber-400'
                : isPlaying
                ? 'bg-white/10 text-slate-300 border-white/20 hover:bg-white/15'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20'
            }`}
            title={`Toggle Record / Play / Overdub [${idx + 1}]`}
          >
            <Circle className={`h-2.5 w-2.5 ${isRecording ? 'fill-white' : 'fill-rose-500'}`} />
            <span>
              {isEmpty ? 'REC' : isRecording ? 'PLAY' : isOverdubbing ? 'PLAY' : 'OVD'}
            </span>
            <kbd className="text-[9px] text-slate-400 opacity-70">[{idx + 1}]</kbd>
          </button>

          <button
            id={`btn-track-mute-${idx}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleMute(idx);
            }}
            className={`flex items-center gap-1 px-2 py-1 rounded-md font-mono text-[11px] border transition-colors cursor-pointer ${
              track.isMuted
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-white/[0.04] text-slate-400 border-white/5 hover:text-white'
            }`}
            title={`Mute/Unmute Track [Shift + ${idx + 1}]`}
          >
            {track.isMuted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
            <span>MUTE</span>
          </button>

          <button
            id={`btn-track-clear-${idx}`}
            onClick={(e) => {
              e.stopPropagation();
              onClearTrack(idx);
            }}
            disabled={isEmpty}
            className="p-1 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-20 cursor-pointer"
            title="Clear Track Events"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }
);

const LooperStationComponent: React.FC<LooperStationProps> = ({
  tracks,
  allPresets = PRESETS,
  selectedTrackIndex,
  currentStep,
  totalSteps,
  onSelectTrack,
  onToggleRecord,
  onToggleMute,
  onClearTrack,
  onChangeVolume,
  onChangeTrackPreset,
  onChangeTrackQuantize,
  onSnapTrackToGrid,
  onNudgeTrackTiming,
  onMoveNoteEvent,
  onDeleteNoteEvent,
}) => {
  const barsCount = totalSteps / 16;
  const playheadLeftPct = `${(currentStep / totalSteps) * 100}%`;

  return (
    <div className="flex flex-col gap-2.5 w-full">
      <div className="flex items-center justify-between text-xs font-mono text-slate-400 px-1 flex-wrap gap-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-200">4-TRACK LOOP STATION</span>
          <span className="text-[10px] text-slate-500">
            Grid Snap (1/16, 1/8, 1/4) or Free Timing • Drag Notes to Adjust Timing After Recording
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="text-slate-400">
            BAR <span className="text-cyan-300 font-bold">{Math.floor(currentStep / 16) + 1}</span> / {barsCount}
          </span>
          <span className="text-slate-500">
            STEP <span className="text-white font-mono">{currentStep + 1}</span>/{totalSteps}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {tracks.map((track, idx) => {
          const isSelected = selectedTrackIndex === idx;

          return (
            <div
              key={track.id}
              id={`looper-track-${idx}`}
              onClick={() => onSelectTrack(idx)}
              className={`relative rounded-xl border p-2.5 bg-[#10121a] ${
                isSelected
                  ? 'border-white/20 bg-[#141722]'
                  : 'border-white/5 hover:border-white/10'
              }`}
              style={{
                boxShadow: isSelected ? `0 0 0 1px ${track.color}80` : undefined,
              }}
            >
              {/* Top Row: Memoized Track Meta & Controls */}
              <TrackHeaderRow
                track={track}
                idx={idx}
                allPresets={allPresets}
                onToggleRecord={onToggleRecord}
                onToggleMute={onToggleMute}
                onClearTrack={onClearTrack}
                onChangeVolume={onChangeVolume}
                onChangeTrackPreset={onChangeTrackPreset}
                onChangeTrackQuantize={onChangeTrackQuantize}
                onSnapTrackToGrid={onSnapTrackToGrid}
                onNudgeTrackTiming={onNudgeTrackTiming}
              />

              {/* Bottom Row: Loop Timeline Grid, Interactive Note Blocks & Playhead */}
              <div className="relative h-10 w-full rounded-lg bg-black/50 border border-white/5 overflow-hidden">
                <StaticTimelineGrid totalSteps={totalSteps} quantizeMode={track.quantizeMode} />

                <RecordedEventsLayer
                  trackIdx={idx}
                  events={track.events}
                  totalSteps={totalSteps}
                  color={track.color}
                  quantizeMode={track.quantizeMode}
                  onMoveNoteEvent={onMoveNoteEvent}
                  onDeleteNoteEvent={onDeleteNoteEvent}
                />

                {/* Moving Playhead Indicator */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-cyan-400 z-30 pointer-events-none"
                  style={{
                    left: playheadLeftPct,
                  }}
                >
                  <div className="w-1.5 h-1.5 -ml-[2px] bg-white rounded-full" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const LooperStation = React.memo(LooperStationComponent);
