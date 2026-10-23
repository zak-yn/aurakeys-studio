import React, { useState } from 'react';
import { X, CheckCircle2, AlertTriangle, Play, RefreshCw, Cpu, Volume2, ShieldCheck } from 'lucide-react';
import { AuraKeysHarness, DiagnosticTestResult, AudioQualityMetrics } from '../audio/AuraKeysHarness';

interface AIDiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AIDiagnosticModal: React.FC<AIDiagnosticModalProps> = ({ isOpen, onClose }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<DiagnosticTestResult[] | null>(null);
  const [metrics, setMetrics] = useState<AudioQualityMetrics | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRunSuite = async () => {
    setIsRunning(true);
    setResults(null);
    setMetrics(null);
    setAudioUrl(null);

    const harness = AuraKeysHarness.getInstance();
    const suite = await harness.runFullSuite();

    setResults(suite.tests);
    setMetrics(suite.audioMetrics);
    setAudioUrl(suite.audioBlobUrl);
    setIsRunning(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-xl rounded-2xl border border-white/10 bg-[#0d0f15] p-6 shadow-2xl flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-cyan-400" />
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">
                AI Self-Test & Diagnostic Harness
              </h2>
              <p className="text-[10px] font-mono text-slate-400">
                Automated multi-key verification, cycle transition & acoustic analysis
              </p>
            </div>
          </div>
          <button
            id="btn-close-diagnostic-modal"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Action button */}
        <div className="flex items-center justify-between bg-black/40 p-3 rounded-xl border border-white/5">
          <div className="text-xs text-slate-300">
            <span className="font-semibold text-white">Full Autonomous Verification</span>
            <p className="text-[11px] text-slate-400">
              Plays multi-voice chords, tests looper cycle overdub, and analyzes recorded audio.
            </p>
          </div>
          <button
            id="btn-run-full-diagnostic"
            onClick={handleRunSuite}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 active:scale-95 text-white transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-cyan-950"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRunning ? 'animate-spin' : ''}`} />
            <span>{isRunning ? 'Testing...' : 'Run Diagnostics'}</span>
          </button>
        </div>

        {/* Test Results List */}
        <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
          {results ? (
            results.map((res, i) => (
              <div
                key={i}
                className={`p-3 rounded-xl border font-mono text-xs flex flex-col gap-1 transition-all ${
                  res.passed
                    ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                    : 'bg-rose-950/20 border-rose-500/30 text-rose-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold">
                    {res.passed ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
                    )}
                    <span>{res.name}</span>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                      res.passed ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                    }`}
                  >
                    {res.passed ? 'PASSED' : 'FAILED'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 pl-6 leading-relaxed">{res.message}</p>
              </div>
            ))
          ) : (
            <div className="py-8 text-center text-xs font-mono text-slate-500 border border-dashed border-white/5 rounded-xl">
              Click &quot;Run Diagnostics&quot; to execute automated multi-key tests & audio analysis.
            </div>
          )}
        </div>

        {/* Acoustic Metrics & Audio Player */}
        {metrics && (
          <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 flex flex-col gap-2 font-mono text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                <Volume2 className="h-3.5 w-3.5 text-cyan-400" />
                <span>Recorded Acoustic Quality</span>
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                  metrics.isAudible && !metrics.isDistorted
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-rose-500/20 text-rose-300'
                }`}
              >
                {metrics.isAudible && !metrics.isDistorted ? 'CLEAN & AUDIBLE' : 'DEGRADED'}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2 text-[10px] text-slate-400">
              <div className="bg-black/30 p-1.5 rounded">
                <div>RMS</div>
                <div className="text-white font-bold">{metrics.rmsDb} dB</div>
              </div>
              <div className="bg-black/30 p-1.5 rounded">
                <div>Peak</div>
                <div className="text-white font-bold">{metrics.peakAmplitude}</div>
              </div>
              <div className="bg-black/30 p-1.5 rounded">
                <div>Clips</div>
                <div className="text-white font-bold">{metrics.clippingSamples}</div>
              </div>
              <div className="bg-black/30 p-1.5 rounded">
                <div>Duration</div>
                <div className="text-white font-bold">{metrics.durationSeconds.toFixed(1)}s</div>
              </div>
            </div>

            {audioUrl && (
              <div className="mt-1">
                <audio controls src={audioUrl} className="w-full h-8" />
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-1 border-t border-white/5">
          <span className="flex items-center gap-1">
            <ShieldCheck className="h-3 w-3 text-cyan-400" />
            <span>Self-Healing Autonomous Verification Loop</span>
          </span>
          <span>lookAhead: 45ms</span>
        </div>
      </div>
    </div>
  );
};
