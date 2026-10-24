import React from 'react';
import { Volume2, VolumeX, RotateCcw, Trash2, Sparkles, X } from 'lucide-react';
import { DrumLaneState, DrumLaneId } from '../audio/DrumMachine';

interface DrumSequencerPanelProps {
  lanes: DrumLaneState[];
  currentStepInBar: number;
  isDrumRecording: boolean;
  onToggleStep: (laneIdx: number, stepIdx: number) => void;
  onToggleLaneMute: (laneIdx: number) => void;
  onChangeLaneVolume: (laneIdx: number, volDb: number) => void;
  onTriggerPad: (laneIdx: number) => void;
  onClearCustomSample: (laneId: DrumLaneId) => void;
  onClearAllSteps: () => void;
  onResetPresetPattern: () => void;
}

const DrumSequencerPanelComponent: React.FC<DrumSequencerPanelProps> = ({
  lanes,
  currentStepInBar,
  isDrumRecording,
  onToggleStep,
  onToggleLaneMute,
  onChangeLaneVolume,
  onTriggerPad,
  onClearCustomSample,
  onClearAllSteps,
  onResetPresetPattern,
}) => {
  return (
    <div className="rounded-xl border border-cyan-500/20 bg-[#0d1017] p-3">
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5 pb-2 border-b border-white/5 text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="font-bold text-cyan-300 tracking-wide">
            4-LANE × 16-STEP DRUM SEQUENCER
          </span>
          <span className="text-[10px] text-slate-500">
            Click step: Off → Normal → Accent • Keys [` - = [] trigger pads
          </span>
          {isDrumRecording && (
            <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
              LIVE PAD QUANTIZE REC
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-drum-seq-reset"
            onClick={onResetPresetPattern}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 border border-white/10 text-[10px] cursor-pointer transition-colors"
            title="Restore default pattern for current style"
          >
            <RotateCcw className="h-3 w-3 text-cyan-400" />
            <span>RESET PATTERN</span>
          </button>

          <button
            id="btn-drum-seq-clear"
            onClick={onClearAllSteps}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] cursor-pointer transition-colors"
            title="Clear all 16 steps across all drum lanes"
          >
            <Trash2 className="h-3 w-3" />
            <span>CLEAR ALL</span>
          </button>
        </div>
      </div>

      {/* 4 Drum Lanes */}
      <div className="flex flex-col gap-2">
        {lanes.map((lane, laneIdx) => {
          return (
            <div
              key={lane.id}
              className="flex flex-col sm:flex-row sm:items-center gap-2 bg-black/40 p-2 rounded-lg border border-white/5"
            >
              {/* Left Controls: Live Hit Pad, Mute, Volume, Custom Sample Pill */}
              <div className="flex items-center justify-between sm:w-64 shrink-0 gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  {/* Live Hit Pad Button */}
                  <button
                    id={`btn-drum-pad-${lane.id}`}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      onTriggerPad(laneIdx);
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md font-mono text-[11px] font-bold text-white border transition-transform active:scale-95 cursor-pointer shrink-0"
                    style={{
                      backgroundColor: `${lane.color}25`,
                      borderColor: `${lane.color}70`,
                      boxShadow: `0 0 8px ${lane.color}30`,
                    }}
                    title={`Trigger ${lane.name} Live Pad [Hotkey: ${lane.hotkeyLabel}]`}
                  >
                    <span>{lane.shortLabel}</span>
                    <kbd className="text-[9px] px-1 rounded bg-black/50 text-slate-300 border border-white/10">
                      {lane.hotkeyLabel}
                    </kbd>
                  </button>

                  {/* Custom Sample Badge if assigned */}
                  {lane.customSampleName ? (
                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-pink-500/20 border border-pink-500/40 text-pink-300 text-[9px] font-mono truncate max-w-[95px]">
                      <Sparkles className="h-2.5 w-2.5 shrink-0" />
                      <span className="truncate">{lane.customSampleName}</span>
                      <button
                        onClick={() => onClearCustomSample(lane.id)}
                        className="hover:text-white cursor-pointer"
                        title="Revert to synthesized drum sound"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-[10px] font-mono text-slate-400 truncate">
                      {lane.name}
                    </span>
                  )}
                </div>

                {/* Lane Mute & Volume */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    id={`btn-drum-lane-mute-${lane.id}`}
                    onClick={() => onToggleLaneMute(laneIdx)}
                    className={`p-1 rounded border text-[10px] font-mono cursor-pointer transition-colors ${
                      lane.isMuted
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                        : 'bg-white/[0.04] border-white/5 text-slate-400 hover:text-white'
                    }`}
                    title={`Mute ${lane.name}`}
                  >
                    {lane.isMuted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                  </button>

                  <input
                    type="range"
                    min={-24}
                    max={4}
                    value={lane.volumeDb}
                    onChange={(e) => onChangeLaneVolume(laneIdx, Number(e.target.value))}
                    className="w-12 accent-cyan-400 cursor-pointer h-1"
                    title={`${lane.name} Volume (${lane.volumeDb} dB)`}
                  />
                </div>
              </div>

              {/* Right: 16 Step Buttons */}
              <div
                className="grid gap-1 flex-1"
                style={{ gridTemplateColumns: 'repeat(16, minmax(0, 1fr))' }}
              >
                {lane.steps.map((vel, stepIdx) => {
                  const isCurrentStep = currentStepInBar === stepIdx;
                  const isBeatStart = stepIdx % 4 === 0;
                  const isActive = vel > 0;
                  const isAccent = vel === 2;

                  return (
                    <button
                      key={stepIdx}
                      id={`drum-step-${lane.id}-${stepIdx}`}
                      onClick={() => onToggleStep(laneIdx, stepIdx)}
                      className={`relative h-7 rounded-md border font-mono text-[9px] flex flex-col items-center justify-center transition-all cursor-pointer ${
                        isCurrentStep
                          ? 'ring-2 ring-cyan-400 z-10'
                          : ''
                      } ${
                        !isActive
                          ? isBeatStart
                            ? 'bg-white/[0.06] border-white/15 text-slate-500 hover:bg-white/10'
                            : 'bg-white/[0.02] border-white/5 text-slate-600 hover:bg-white/[0.06]'
                          : 'text-slate-950 font-bold'
                      }`}
                      style={
                        isActive
                          ? {
                              backgroundColor: isAccent ? lane.color : `${lane.color}90`,
                              borderColor: lane.color,
                              boxShadow: isAccent ? `0 0 10px ${lane.color}80` : undefined,
                            }
                          : undefined
                      }
                      title={`Step ${stepIdx + 1} (${
                        vel === 0 ? 'Off' : vel === 1 ? 'Normal' : 'Accent'
                      })`}
                    >
                      <span>{stepIdx + 1}</span>
                      {isAccent && (
                        <span className="w-1 h-1 rounded-full bg-white absolute bottom-0.5" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const DrumSequencerPanel = React.memo(DrumSequencerPanelComponent);
