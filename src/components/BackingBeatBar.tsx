import React from 'react';
import { Drum, Volume2, VolumeX, Grid, Circle, ChevronUp, ChevronDown } from 'lucide-react';
import { DRUM_BEATS, DrumStyle } from '../audio/DrumMachine';

interface BackingBeatBarProps {
  currentStyle: DrumStyle;
  isMuted: boolean;
  volumeDb: number;
  isSequencerOpen: boolean;
  isDrumRecording: boolean;
  onSelectStyle: (style: DrumStyle) => void;
  onToggleMute: () => void;
  onChangeVolume: (volDb: number) => void;
  onToggleSequencer: () => void;
  onToggleDrumRecording: () => void;
  onTriggerPad: (laneIdx: number) => void;
}

const BackingBeatBarComponent: React.FC<BackingBeatBarProps> = ({
  currentStyle,
  isMuted,
  volumeDb,
  isSequencerOpen,
  isDrumRecording,
  onSelectStyle,
  onToggleMute,
  onChangeVolume,
  onToggleSequencer,
  onToggleDrumRecording,
  onTriggerPad,
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 bg-[#10121a] border border-white/5 rounded-xl p-2.5">
      {/* Left: Drum Machine Label, Mute Button & Step Sequencer Drawer Toggle */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-slate-300">
          <Drum className="h-4 w-4 text-cyan-400" />
          <span>DRUM MACHINE:</span>
        </div>

        <button
          id="btn-drum-mute"
          onClick={onToggleMute}
          className={`flex items-center gap-1 px-2 py-1 rounded-md font-mono text-[11px] border transition-all cursor-pointer ${
            isMuted
              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
              : 'bg-white/[0.04] text-slate-300 border-white/10 hover:bg-white/[0.08]'
          }`}
          title="Toggle Drum Mute (Hotkey: Tab)"
        >
          {isMuted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
          <span>{isMuted ? 'MUTED' : 'ON'}</span>
          <kbd className="text-[9px] text-slate-500 bg-black/40 px-1 rounded border border-white/5 font-mono">
            Tab
          </kbd>
        </button>

        {/* Toggle 16-Step Sequencer Grid */}
        <button
          id="btn-toggle-drum-sequencer"
          onClick={onToggleSequencer}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-mono text-[11px] font-semibold border transition-all cursor-pointer ${
            isSequencerOpen
              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm shadow-cyan-500/20'
              : 'bg-white/[0.04] text-slate-300 border-white/10 hover:bg-white/[0.08]'
          }`}
          title="Open 4-Lane x 16-Step Interactive Drum Sequencer"
        >
          <Grid className="h-3 w-3 text-cyan-400" />
          <span>16-STEP SEQ</span>
          {isSequencerOpen ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronUp className="h-3 w-3" />
          )}
        </button>

        {/* Live Pad Quantize Record Toggle */}
        <button
          id="btn-toggle-drum-rec"
          onClick={onToggleDrumRecording}
          className={`flex items-center gap-1 px-2 py-1 rounded-md font-mono text-[10px] border transition-all cursor-pointer ${
            isDrumRecording
              ? 'bg-rose-500/25 text-rose-300 border-rose-500/50 animate-pulse font-bold'
              : 'bg-black/30 text-slate-400 border-white/5 hover:text-slate-200'
          }`}
          title="When active, hitting Drum Pads [` - = [] records into the 16-step grid"
        >
          <Circle className="h-2.5 w-2.5 fill-rose-500 text-rose-500" />
          <span>PAD REC</span>
        </button>
      </div>

      {/* Middle: Preset Beat Style Buttons */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {DRUM_BEATS.map((beat) => {
          const isActive = currentStyle === beat.id && !isMuted;
          return (
            <button
              key={beat.id}
              id={`btn-drum-${beat.id}`}
              onClick={() => onSelectStyle(beat.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono text-[11px] border transition-all cursor-pointer ${
                isActive
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-semibold shadow-sm shadow-cyan-500/20'
                  : 'bg-black/30 text-slate-400 border-white/5 hover:text-slate-200 hover:bg-white/[0.04]'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isActive ? 'bg-cyan-400 animate-ping' : 'bg-slate-600'
                }`}
              />
              <span>{beat.name}</span>
            </button>
          );
        })}
      </div>

      {/* Right: Quick Live Hit Pads & Master Drum Volume */}
      <div className="flex items-center gap-2">
        <div className="hidden xl:flex items-center gap-1">
          {(['KICK `', 'SNARE -', 'HAT =', 'PERC ['] as const).map((label, idx) => (
            <button
              key={label}
              onPointerDown={(e) => {
                e.preventDefault();
                onTriggerPad(idx);
              }}
              className="px-1.5 py-0.5 rounded bg-white/[0.04] hover:bg-cyan-500/20 border border-white/10 text-[9px] font-mono text-slate-300 active:scale-95 cursor-pointer"
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded-lg border border-white/5 font-mono text-[10px] text-slate-400">
          <span>VOL:</span>
          <input
            type="range"
            id="slider-drum-vol"
            min={-36}
            max={2}
            value={volumeDb}
            onChange={(e) => onChangeVolume(Number(e.target.value))}
            className="w-14 accent-cyan-400 cursor-pointer h-1"
          />
        </div>
      </div>
    </div>
  );
};

export const BackingBeatBar = React.memo(BackingBeatBarComponent);
