import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Sliders, Activity, Compass } from 'lucide-react';
import { SynthEngine, MacroControls } from '../audio/SynthEngine';

interface VisualizerAndXYProps {
  macros: MacroControls;
  onChangeMacro: (key: keyof MacroControls, val: number) => void;
  onXYChange: (x: number, y: number) => void;
  isUnlocked: boolean;
}

const VisualizerAndXYComponent: React.FC<VisualizerAndXYProps> = ({
  macros,
  onChangeMacro,
  onXYChange,
  isUnlocked,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const xyPadRef = useRef<HTMLDivElement | null>(null);
  const [isDraggingXY, setIsDraggingXY] = useState(false);

  // 60fps Waveform Visualizer
  useEffect(() => {
    if (!isUnlocked) return;

    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const synthEngine = SynthEngine.getInstance();
    // Pre-allocated static buffer to eliminate 60fps GC allocations
    const sampleBuffer = new Float32Array(256);

    const draw = () => {
      animId = requestAnimationFrame(draw);

      const width = canvas.width;
      const height = canvas.height;

      ctx.fillStyle = 'rgba(10, 12, 18, 0.45)';
      ctx.fillRect(0, 0, width, height);

      // Grid line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();

      if (!synthEngine.isReady || !synthEngine.analyser) {
        return;
      }

      // Zero-allocation waveform extraction directly from Web Audio AnalyserNode
      const nativeAnalyser = (synthEngine.analyser as any)._analyser as AnalyserNode | undefined;
      if (nativeAnalyser && nativeAnalyser.getFloatTimeDomainData) {
        nativeAnalyser.getFloatTimeDomainData(sampleBuffer);
      } else {
        const temp = synthEngine.analyser.getValue() as Float32Array;
        if (temp) sampleBuffer.set(temp.subarray(0, sampleBuffer.length));
      }

      // High-performance direct stroke without expensive CPU shadowBlur software rasterization
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.75;

      ctx.beginPath();
      const step = 2;
      const count = sampleBuffer.length / step;
      const sliceWidth = width / count;
      let x = 0;

      for (let i = 0; i < sampleBuffer.length; i += step) {
        const v = sampleBuffer[i];
        // v is typically -1.0 to 1.0
        const y = (v * 0.75 + 1) * (height / 2);

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }

      ctx.stroke();
    };

    draw();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isUnlocked]);

  // Handle XY Pad Dragging
  const handleXYMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!xyPadRef.current) return;
      const rect = xyPadRef.current.getBoundingClientRect();
      const rawX = (clientX - rect.left) / rect.width;
      // Invert Y so top is 100%, bottom is 0%
      const rawY = 1 - (clientY - rect.top) / rect.height;

      const x = Math.round(Math.max(0, Math.min(1, rawX)) * 100);
      const y = Math.round(Math.max(0, Math.min(1, rawY)) * 100);

      onXYChange(x, y);
    },
    [onXYChange]
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDraggingXY(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    handleXYMove(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDraggingXY) {
      handleXYMove(e.clientX, e.clientY);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDraggingXY(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* 1. Waveform Visualizer Canvas */}
      <div className="rounded-xl border border-white/5 bg-[#10121a]/90 p-2.5 backdrop-blur-sm">
        <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1.5">
          <div className="flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-cyan-400" />
            <span className="font-semibold text-slate-200">MASTER SPECTRUM</span>
          </div>
          <span className="text-[10px] text-cyan-400/80 font-mono">60 FPS ANALYSER</span>
        </div>
        <canvas
          ref={canvasRef}
          width={400}
          height={80}
          className="w-full h-20 rounded-lg bg-black/60 border border-white/5"
        />
      </div>

      {/* 2. 2D XY Mood Pad */}
      <div className="rounded-xl border border-white/5 bg-[#10121a]/90 p-2.5 backdrop-blur-sm flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs font-mono text-slate-400">
          <div className="flex items-center gap-1.5">
            <Compass className="h-3.5 w-3.5 text-purple-400" />
            <span className="font-semibold text-slate-200">2D MOOD SHAPER</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            X:{macros.warmth}% Y:{macros.space}%
          </span>
        </div>

        {/* The XY Surface */}
        <div
          ref={xyPadRef}
          id="pad-xy-mood"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="relative h-28 w-full rounded-lg bg-gradient-to-tr from-slate-950 via-[#131622] to-slate-900 border border-white/10 cursor-crosshair select-none overflow-hidden touch-none"
        >
          {/* Subtle Quadrant Labels */}
          <span className="absolute top-1.5 left-2 text-[9px] font-mono text-slate-500 uppercase tracking-wider">Dreamy Lush</span>
          <span className="absolute top-1.5 right-2 text-[9px] font-mono text-slate-500 uppercase tracking-wider">Bright Cosmic</span>
          <span className="absolute bottom-1.5 left-2 text-[9px] font-mono text-slate-500 uppercase tracking-wider">Warm Intimate</span>
          <span className="absolute bottom-1.5 right-2 text-[9px] font-mono text-slate-500 uppercase tracking-wider">Crisp Direct</span>

          {/* Crosshair Center Lines */}
          <div className="absolute inset-x-0 top-1/2 border-t border-white/[0.04] pointer-events-none" />
          <div className="absolute inset-y-0 left-1/2 border-l border-white/[0.04] pointer-events-none" />

          {/* Interactive Puck */}
          <div
            className="absolute w-5 h-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-cyan-400 shadow-[0_0_12px_#06b6d4] pointer-events-none transition-transform duration-75"
            style={{
              left: `${macros.warmth}%`,
              top: `${100 - macros.space}%`,
              transform: isDraggingXY ? 'translate(-50%, -50%) scale(1.2)' : 'translate(-50%, -50%)',
            }}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
        </div>

        <div className="flex justify-between text-[9px] font-mono text-slate-500 px-1">
          <span>← Mellow (Warmth) Bright →</span>
          <span>↓ Dry (Space) Wet ↑</span>
        </div>
      </div>

      {/* 3. Four Intuitive Macro Sliders */}
      <div className="rounded-xl border border-white/5 bg-[#10121a]/90 p-2.5 backdrop-blur-sm">
        <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400 mb-2">
          <Sliders className="h-3.5 w-3.5 text-emerald-400" />
          <span className="font-semibold text-slate-200">MACRO SOUND CONTROLS</span>
        </div>

        <div className="grid grid-cols-2 gap-2.5 font-mono text-xs">
          {/* Warmth (Filter Cutoff) */}
          <div className="bg-black/40 p-2 rounded-lg border border-white/5 flex flex-col gap-1">
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-slate-300">WARMTH</span>
              <span className="text-amber-400 font-bold">{macros.warmth}%</span>
            </div>
            <input
              type="range"
              id="slider-macro-warmth"
              min={0}
              max={100}
              value={macros.warmth}
              onChange={(e) => onChangeMacro('warmth', Number(e.target.value))}
              className="accent-amber-400 cursor-pointer h-1.5"
            />
          </div>

          {/* Space (Reverb) */}
          <div className="bg-black/40 p-2 rounded-lg border border-white/5 flex flex-col gap-1">
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-slate-300">SPACE</span>
              <span className="text-cyan-400 font-bold">{macros.space}%</span>
            </div>
            <input
              type="range"
              id="slider-macro-space"
              min={0}
              max={100}
              value={macros.space}
              onChange={(e) => onChangeMacro('space', Number(e.target.value))}
              className="accent-cyan-400 cursor-pointer h-1.5"
            />
          </div>

          {/* Snap (Envelope) */}
          <div className="bg-black/40 p-2 rounded-lg border border-white/5 flex flex-col gap-1">
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-slate-300">SNAP</span>
              <span className="text-emerald-400 font-bold">{macros.snap}%</span>
            </div>
            <input
              type="range"
              id="slider-macro-snap"
              min={0}
              max={100}
              value={macros.snap}
              onChange={(e) => onChangeMacro('snap', Number(e.target.value))}
              className="accent-emerald-400 cursor-pointer h-1.5"
            />
          </div>

          {/* Echo (Delay) */}
          <div className="bg-black/40 p-2 rounded-lg border border-white/5 flex flex-col gap-1">
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-slate-300">ECHO</span>
              <span className="text-purple-400 font-bold">{macros.echo}%</span>
            </div>
            <input
              type="range"
              id="slider-macro-echo"
              min={0}
              max={100}
              value={macros.echo}
              onChange={(e) => onChangeMacro('echo', Number(e.target.value))}
              className="accent-purple-400 cursor-pointer h-1.5"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export const VisualizerAndXY = React.memo(VisualizerAndXYComponent);
