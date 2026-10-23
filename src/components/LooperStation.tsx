import React from 'react';
import { Circle, VolumeX, Volume2, Trash2, Mic } from 'lucide-react';
import { LooperTrack } from '../audio/LooperEngine';

interface LooperStationProps {
  tracks: LooperTrack[];
  selectedTrackIndex: number;
  currentStep: number;
  totalSteps: number;
  onSelectTrack: (index: number) => void;
  onToggleRecord: (index: number) => void;
  onToggleMute: (index: number) => void;
  onClearTrack: (index: number) => void;
  onChangeVolume: (index: number, volDb: number) => void;
}

const LooperStationComponent: React.FC<LooperStationProps> = ({
  tracks,
  selectedTrackIndex,
  currentStep,
  totalSteps,
  onSelectTrack,
  onToggleRecord,
  onToggleMute,
  onClearTrack,
  onChangeVolume,
}) => {
  const barsCount = totalSteps / 16;

  return (
    <div className="flex flex-col gap-2.5 w-full">
      <div className="flex items-center justify-between text-xs font-mono text-slate-400 px-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-200">4-TRACK LOOP STATION</span>
          <span className="text-[10px] text-slate-500">
            Auto-Quantized 16th Grid • Scale-Locked Re-Pitching
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
          const isRecording = track.state === 'RECORDING';
          const isOverdubbing = track.state === 'OVERDUBBING';
          const isPlaying = track.state === 'PLAYING';
          const isEmpty = track.state === 'EMPTY';

          return (
            <div
              key={track.id}
              id={`looper-track-${idx}`}
              onClick={() => onSelectTrack(idx)}
              className={`relative rounded-xl border transition-all p-2.5 bg-[#10121a]/80 backdrop-blur-sm ${
                isSelected
                  ? 'border-white/20 bg-white/[0.04] shadow-md ring-1'
                  : 'border-white/5 hover:border-white/10'
              }`}
              style={{
                boxShadow: isSelected ? `0 0 0 1px ${track.color}80, 0 4px 12px rgba(0,0,0,0.5)` : undefined,
              }}
            >
              {/* Top Row: Track Meta & Controls */}
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className="flex items-center justify-center w-6 h-6 rounded-md font-mono text-xs font-bold text-white shadow-inner"
                    style={{ backgroundColor: `${track.color}25`, border: `1px solid ${track.color}60` }}
                  >
                    {idx + 1}
                  </div>

                  <span className="text-xs font-medium text-slate-200">
                    {track.name}
                  </span>

                  {/* Preset or Custom Auto-Pitch Sample Badge */}
                  <span
                    className="text-[10px] font-mono px-2 py-0.5 rounded-full border flex items-center gap-1"
                    style={{
                      color: track.preset.color,
                      borderColor: `${track.preset.color}40`,
                      backgroundColor: `${track.preset.color}15`,
                    }}
                  >
                    {track.preset.isSamplerVoice && <Mic className="h-2.5 w-2.5" />}
                    <span>{track.customSampleLabel || track.preset.name}</span>
                  </span>

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
                    {isRecording && <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-ping" />}
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
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-mono text-[11px] font-medium border transition-all cursor-pointer ${
                      isRecording
                        ? 'bg-rose-500 text-white border-rose-400 shadow-sm shadow-rose-500/50'
                        : isOverdubbing
                        ? 'bg-amber-500/30 text-amber-200 border-amber-400'
                        : isPlaying
                        ? 'bg-white/10 text-slate-300 border-white/20 hover:bg-white/15'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20'
                    }`}
                    title={`Toggle Record / Play / Overdub [${idx + 1}]`}
                  >
                    <Circle className={`h-2.5 w-2.5 ${isRecording ? 'fill-white' : 'fill-rose-500'}`} />
                    <span>{isEmpty ? 'REC' : isRecording ? 'PLAY' : isOverdubbing ? 'PLAY' : 'OVD'}</span>
                    <kbd className="text-[9px] text-slate-400 opacity-70">[{idx + 1}]</kbd>
                  </button>

                  <button
                    id={`btn-track-mute-${idx}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleMute(idx);
                    }}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md font-mono text-[11px] border transition-all cursor-pointer ${
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

              {/* Bottom Row: Loop Timeline Grid & Playhead */}
              <div className="relative h-10 w-full rounded-lg bg-black/50 border border-white/5 overflow-hidden">
                <div className="absolute inset-0 flex pointer-events-none">
                  {Array.from({ length: totalSteps }).map((_, stepIdx) => {
                    const isBarStart = stepIdx % 16 === 0;
                    const isBeatStart = stepIdx % 4 === 0;
                    return (
                      <div
                        key={stepIdx}
                        className={`h-full flex-1 border-r ${
                          isBarStart
                            ? 'border-white/20 bg-white/[0.015]'
                            : isBeatStart
                            ? 'border-white/[0.07]'
                            : 'border-white/[0.02]'
                        }`}
                      />
                    );
                  })}
                </div>

                {/* Recorded Note Blocks */}
                <div className="absolute inset-0 pointer-events-none">
                  {track.events.map((ev) => {
                    const leftPct = (ev.step / totalSteps) * 100;
                    const widthPct = Math.max(0.8, (ev.durationSteps / totalSteps) * 100);
                    return (
                      <div
                        key={ev.id}
                        className="absolute top-1 bottom-1 rounded flex items-center px-1 text-[9px] font-mono text-white/90 overflow-hidden shadow-sm"
                        style={{
                          left: `${leftPct}%`,
                          width: `${widthPct}%`,
                          backgroundColor: track.color,
                          boxShadow: `0 0 8px ${track.color}60`,
                        }}
                      >
                        <span className="truncate">{ev.notes.join(',')}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Moving Playhead Indicator */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-cyan-400 shadow-[0_0_8px_#38bdf8] z-10 pointer-events-none"
                  style={{
                    left: `${(currentStep / totalSteps) * 100}%`,
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
