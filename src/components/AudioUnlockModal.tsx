import React, { useState } from 'react';
import { Play, Music, Sparkles, Sliders, Disc3 } from 'lucide-react';

interface AudioUnlockModalProps {
  onUnlock: () => Promise<void>;
}

export const AudioUnlockModal: React.FC<AudioUnlockModalProps> = ({ onUnlock }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    try {
      setIsLoading(true);
      await onUnlock();
    } catch (e) {
      console.error('Audio unlock failed', e);
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
      <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#0d0f14] p-8 shadow-2xl">
        {/* Glow ambient background */}
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-48 bg-cyan-500/10 blur-[80px] pointer-events-none rounded-full" />

        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 text-cyan-400">
            <Disc3 className="h-7 w-7 animate-spin-slow" />
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
            AuraKeys Studio
          </h1>
          <p className="text-xs uppercase tracking-widest text-cyan-400 font-mono mb-4">
            Solo 4-Track Live Looping Synthesizer
          </p>

          <p className="text-sm text-slate-400 leading-relaxed max-w-md mb-6">
            Harmonically locked to musical scales so every key sounds incredible together.
            Play live chords, record and overdub 4 quantized tracks in real time on your standard PC keyboard.
          </p>

          {/* Feature Highlights Grid */}
          <div className="grid grid-cols-2 gap-2.5 w-full mb-6 text-left text-xs font-mono">
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.03] border border-white/5 text-slate-300">
              <Music className="h-4 w-4 text-amber-400 shrink-0" />
              <span>No Wrong Notes (Scale-Locked)</span>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.03] border border-white/5 text-slate-300">
              <Disc3 className="h-4 w-4 text-cyan-400 shrink-0" />
              <span>4-Track Quantized Looper</span>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.03] border border-white/5 text-slate-300">
              <Sparkles className="h-4 w-4 text-purple-400 shrink-0" />
              <span>Shift: 1-Finger Triad Chords</span>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.03] border border-white/5 text-slate-300">
              <Sliders className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>2D XY Mood Sound Shaper</span>
            </div>
          </div>

          {/* Launch Button */}
          <button
            id="btn-unlock-audio"
            onClick={handleClick}
            disabled={isLoading}
            className="group relative flex items-center justify-center gap-2.5 w-full py-3.5 px-6 rounded-xl font-medium text-sm text-white bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 active:scale-[0.98] transition-all duration-150 border border-cyan-400/30 shadow-lg shadow-cyan-950/50 cursor-pointer disabled:opacity-50"
          >
            <Play className="h-4 w-4 fill-white" />
            <span>{isLoading ? 'Initializing Web Audio...' : 'Launch AuraKeys Studio'}</span>
          </button>

          <p className="mt-3 text-[11px] text-slate-500 font-mono">
            Requires Web Audio API. Zero external audio downloads.
          </p>
        </div>
      </div>
    </div>
  );
};
