import React, { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import {
  Mic,
  Square,
  Upload,
  Play,
  X,
  Check,
  Drum,
  Music,
  Sliders,
  Paintbrush,
  Trash2,
  Plus,
  RotateCcw,
  Clock,
  Pencil,
} from 'lucide-react';
import {
  RegisteredVoice,
  SamplerEngine,
  VOICE_PALETTE,
} from '../audio/SamplerEngine';
import { DrumLaneId } from '../audio/DrumMachine';
import { ROW_TOP, ROW_MID, ROW_BOT } from '../audio/scales';

interface SamplerStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRoot: string;
  currentScaleName: string;
  onSelectSamplerPreset: () => void;
  onAssignToDrumLane: (laneId: DrumLaneId) => void;
  onStartPaintMode: (voiceId: string) => void;
}

const ROOT_NOTE_OPTIONS = [
  'C1', 'D1', 'E1', 'F1', 'G1', 'A1', 'B1',
  'C2', 'D2', 'E2', 'F2', 'G2', 'A2', 'B2',
  'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3',
  'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4',
  'C5', 'D5', 'E5',
];

export const SamplerStudioModal: React.FC<SamplerStudioModalProps> = ({
  isOpen,
  onClose,
  currentRoot,
  currentScaleName,
  onSelectSamplerPreset,
  onAssignToDrumLane,
  onStartPaintMode,
}) => {
  const engine = SamplerEngine.getInstance();

  const [voices, setVoices] = useState<RegisteredVoice[]>(engine.voices);
  const [keyVoiceMap, setKeyVoiceMap] = useState<Record<string, string>>(engine.keyVoiceMap);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>(
    engine.voices[0]?.id || ''
  );
  const [activeTab, setActiveTab] = useState<'voices' | 'map'>('voices');

  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [micLevel, setMicLevel] = useState(0);
  const [newVoiceName, setNewVoiceName] = useState('My Vocal Phrase');
  const [feedback, setFeedback] = useState<string | null>(null);

  // Inline Voice Renaming State
  const [editingVoiceId, setEditingVoiceId] = useState<string | null>(null);
  const [editingVoiceName, setEditingVoiceName] = useState<string>('');
  const renameInputRef = useRef<HTMLInputElement | null>(null);

  // Studio Pre-roll Count-in State
  const [countInSeconds, setCountInSeconds] = useState<3 | 1 | 0>(3);
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownTimerRef = useRef<any>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Play crisp acoustic metronome blip during count-in
  const playCountdownBeep = (isFinal = false) => {
    try {
      const rawCtx = Tone.getContext().rawContext as AudioContext;
      if (!rawCtx) return;
      const osc = rawCtx.createOscillator();
      const gain = rawCtx.createGain();
      osc.type = 'sine';
      const freq = isFinal ? 1760 : 880;
      osc.frequency.setValueAtTime(freq, rawCtx.currentTime);
      gain.gain.setValueAtTime(0.08, rawCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, rawCtx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(rawCtx.destination);
      osc.start();
      osc.stop(rawCtx.currentTime + 0.09);
    } catch {}
  };

  const handleCancelCountdown = () => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setCountdown(null);
  };

  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const unsubVoices = engine.subscribeVoices((newVoices, newMap) => {
      setVoices([...newVoices]);
      setKeyVoiceMap({ ...newMap });
      if (!newVoices.some((v) => v.id === selectedVoiceId) && newVoices[0]) {
        setSelectedVoiceId(newVoices[0].id);
      }
    });
    const unsubMic = engine.subscribeMicLevel((lvl) => setMicLevel(lvl));

    return () => {
      unsubVoices();
      unsubMic();
    };
  }, [isOpen, selectedVoiceId]);

  useEffect(() => {
    let timer: any;
    if (isRecording) {
      setRecordSeconds(0);
      timer = setInterval(() => {
        setRecordSeconds((prev) => {
          if (prev >= 3.8) {
            handleStopMicRecord();
            return 4.0;
          }
          return Math.round((prev + 0.1) * 10) / 10;
        });
      }, 100);
    }
    return () => clearInterval(timer);
  }, [isRecording]);

  if (!isOpen) return null;

  const currentVoice =
    voices.find((v) => v.id === selectedVoiceId) || voices[0] || null;

  const handleStartMicRecord = async () => {
    try {
      setFeedback(null);
      await engine.startMicRecording();
      setIsRecording(true);
    } catch (err) {
      console.error('Microphone access denied:', err);
    }
  };

  const handleTriggerRecordWithCountdown = () => {
    setFeedback(null);
    if (countInSeconds === 0) {
      handleStartMicRecord();
      return;
    }

    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }

    let remaining = countInSeconds;
    setCountdown(remaining);
    playCountdownBeep(false);

    countdownTimerRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        setCountdown(remaining);
        playCountdownBeep(false);
      } else {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
        setCountdown(null);
        playCountdownBeep(true);
        handleStartMicRecord();
      }
    }, 1000);
  };

  const handleStopMicRecord = async () => {
    setIsRecording(false);
    const created = await engine.stopMicRecording(newVoiceName.trim() || 'New Voice');
    if (created) {
      setSelectedVoiceId(created.id);
      engine.setPaintVoice(created.id);
      setFeedback(`Voice "${created.name}" recorded & pitch-detected!`);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFeedback(null);
    const loaded = await engine.loadAudioFile(file);
    if (loaded) {
      setSelectedVoiceId(loaded.id);
      engine.setPaintVoice(loaded.id);
      setFeedback(`Loaded "${loaded.name}" into Voice Bank!`);
    }
  };

  const handlePaintToKeyboard = (voiceId: string) => {
    engine.setPaintVoice(voiceId);
    onStartPaintMode(voiceId);
    onSelectSamplerPreset();
    onClose();
  };

  const handleAssignRowToVoice = (rowCodes: string[], voiceId: string) => {
    rowCodes.forEach((code) => {
      engine.keyVoiceMap[code] = voiceId;
    });
    setKeyVoiceMap({ ...engine.keyVoiceMap });
    engine.paintKey(rowCodes[0], voiceId); // triggers persistence & notify
    setFeedback(`Assigned row to "${currentVoice?.name}"!`);
  };

  const handleClearAllMappings = () => {
    engine.clearAllKeyMappings();
    setFeedback('All key assignments cleared. Unmapped keys are silent.');
  };

  const handleResetFactoryKit = async () => {
    await engine.resetToDefaults();
    setVoices([...engine.voices]);
    setKeyVoiceMap({ ...engine.keyVoiceMap });
    setSelectedVoiceId(engine.voices[0]?.id || '');
    setEditingVoiceId(null);
    setFeedback('Reset to default Studio Voices & key maps.');
  };

  const handleStartRename = (voice: RegisteredVoice, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedVoiceId(voice.id);
    setEditingVoiceId(voice.id);
    setEditingVoiceName(voice.name);
    requestAnimationFrame(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    });
  };

  const handleSaveRename = (voiceId: string, e?: React.MouseEvent | React.FormEvent) => {
    if (e) e.stopPropagation();
    const trimmed = editingVoiceName.trim();
    if (trimmed) {
      const updated = engine.renameVoice(voiceId, trimmed);
      if (updated) {
        setFeedback(`Renamed voice to "${trimmed}"!`);
      }
    }
    setEditingVoiceId(null);
  };

  const handleCancelRename = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingVoiceId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 select-none">
      <div className="relative w-full max-w-3xl rounded-2xl border border-pink-500/30 bg-[#0c0e16] p-6 shadow-2xl text-slate-100 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-pink-500/20 border border-pink-500/40 flex items-center justify-center text-pink-400">
              <Mic className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                <span>Multi-Voice Studio & Key Mapper</span>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-pink-500/15 text-pink-300 border border-pink-500/30">
                  Preset [0]
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Register multiple voice clips and map them across your keyboard keys tuned to{' '}
                <span className="text-cyan-300 font-mono font-semibold">
                  {currentRoot} {currentScaleName}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-reset-factory-voice-kit"
              onClick={handleResetFactoryKit}
              title="Reset to factory demo voices"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white font-mono text-xs cursor-pointer border border-white/10"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset Kit</span>
            </button>
            <button
              id="btn-close-sampler-modal"
              onClick={() => {
                handleCancelCountdown();
                onClose();
              }}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 mb-4 border-b border-white/10 pb-2 shrink-0">
          <button
            onClick={() => setActiveTab('voices')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
              activeTab === 'voices'
                ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            1. VOICE LIBRARY ({voices.length})
          </button>
          <button
            onClick={() => setActiveTab('map')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'map'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Paintbrush className="w-3.5 h-3.5 text-cyan-400" />
            <span>2. KEYBOARD MAPPER ({Object.keys(keyVoiceMap).length} KEYS)</span>
          </button>
        </div>

        {/* Tab 1: Voice Library & Recording */}
        {activeTab === 'voices' && (
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {/* Record / Upload New Voice Bar */}
            <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 flex flex-col sm:flex-row items-center gap-3">
              <div className="flex-1 w-full">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-mono text-slate-400 uppercase">
                    New Voice Name
                  </label>
                  <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400">
                    <Clock className="w-3 h-3 text-amber-400" />
                    <span>COUNTDOWN:</span>
                    {([3, 1, 0] as const).map((sec) => (
                      <button
                        key={sec}
                        id={`btn-countin-${sec}`}
                        onClick={() => setCountInSeconds(sec)}
                        className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                          countInSeconds === sec
                            ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40'
                            : 'text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        {sec === 0 ? 'OFF' : `${sec}s`}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="text"
                  value={newVoiceName}
                  onChange={(e) => setNewVoiceName(e.target.value)}
                  placeholder="e.g. Hello, Thank You, Yeah"
                  className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-pink-400"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                {countdown !== null ? (
                  <div className="flex items-center gap-1.5 flex-1 sm:flex-none">
                    <button
                      id="btn-sampler-countdown-active"
                      disabled
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 py-2 px-3.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-400/80 font-mono text-xs font-bold shadow-md shadow-amber-950/40 cursor-wait"
                    >
                      <span className="w-4 h-4 rounded-full bg-amber-400 text-black font-extrabold flex items-center justify-center text-[10px] animate-pulse">
                        {countdown}
                      </span>
                      <span>READY IN {countdown}s</span>
                    </button>
                    <button
                      id="btn-sampler-cancel-countdown"
                      onClick={handleCancelCountdown}
                      className="flex items-center justify-center gap-1 py-2 px-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 border border-white/20 font-mono text-xs cursor-pointer"
                      title="Cancel Countdown"
                    >
                      <X className="h-3.5 w-3.5" />
                      <span>CANCEL</span>
                    </button>
                  </div>
                ) : !isRecording ? (
                  <button
                    id="btn-sampler-record-mic"
                    onClick={handleTriggerRecordWithCountdown}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 font-mono text-xs font-semibold cursor-pointer"
                  >
                    <Mic className="h-3.5 w-3.5 text-rose-400" />
                    <span>
                      REC MIC {countInSeconds > 0 ? `(${countInSeconds}s COUNTDOWN)` : '(INSTANT)'}
                    </span>
                  </button>
                ) : (
                  <button
                    id="btn-sampler-stop-mic"
                    onClick={handleStopMicRecord}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-rose-500 text-white border border-rose-400 font-mono text-xs font-bold animate-pulse cursor-pointer"
                  >
                    <Square className="h-3.5 w-3.5 fill-white" />
                    <span>STOP ({recordSeconds.toFixed(1)}s)</span>
                  </button>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  id="btn-sampler-upload-file"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 font-mono text-xs cursor-pointer"
                >
                  <Upload className="h-3.5 w-3.5 text-cyan-400" />
                  <span>INSTALL FILE</span>
                </button>
              </div>
            </div>

            {/* Visual Countdown Overlay Banner */}
            {countdown !== null && (
              <div
                id="sampler-countdown-strip"
                className="flex items-center justify-between p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/50 text-amber-200 text-xs font-mono shadow-lg shadow-amber-950/30"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center font-bold text-lg text-amber-300 shadow-md shadow-amber-500/30 animate-pulse">
                    {countdown}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-amber-300 uppercase tracking-wide text-sm">
                        Get Ready to Sing or Speak in {countdown}...
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                        Metronome Cue Active
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-200/70 mt-0.5">
                      Clear your breath. Audio recording begins automatically when the timer reaches 0.
                    </p>
                  </div>
                </div>

                <button
                  id="btn-cancel-countdown-strip"
                  onClick={handleCancelCountdown}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 text-xs font-semibold transition-colors cursor-pointer border border-white/10"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Cancel</span>
                </button>
              </div>
            )}

            {/* Live Mic Level */}
            {isRecording && (
              <div className="bg-black/50 p-2.5 rounded-lg border border-rose-500/30">
                <div className="flex justify-between text-[10px] font-mono text-rose-300 mb-1">
                  <span>LISTENING TO MIC... SPEAK OR SING</span>
                  <span>LEVEL: {micLevel}%</span>
                </div>
                <div className="w-full h-2 bg-black rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-500 transition-all duration-75"
                    style={{ width: `${micLevel}%` }}
                  />
                </div>
              </div>
            )}

            {/* Recording Feedback & Immediate Paint Action */}
            {feedback && (
              <div
                id="sampler-feedback-banner"
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 rounded-xl bg-pink-950/40 border border-pink-500/40 text-pink-200 text-xs font-mono"
              >
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-pink-400 shrink-0" />
                  <span className="font-semibold">{feedback}</span>
                </div>
                {currentVoice && (
                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    <button
                      id="btn-feedback-rename-now"
                      onClick={(e) => handleStartRename(currentVoice, e)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-pink-200 font-bold text-xs transition-colors cursor-pointer border border-pink-400/30"
                      title="Rename this voice"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>RENAME</span>
                    </button>
                    <button
                      id="btn-feedback-fill-all-now"
                      onClick={() => {
                        engine.assignKeysToVoice(
                          [...ROW_TOP, ...ROW_MID, ...ROW_BOT],
                          currentVoice.id
                        );
                        onSelectSamplerPreset();
                        onClose();
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-colors shrink-0 cursor-pointer"
                      title="Map this voice across all 30 keys and start playing immediately"
                    >
                      <span>FILL ALL 30 KEYS &amp; PLAY</span>
                    </button>
                    <button
                      id="btn-feedback-paint-now"
                      onClick={() => handlePaintToKeyboard(currentVoice.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-pink-500 hover:bg-pink-600 text-white font-bold text-xs transition-colors shrink-0 cursor-pointer shadow-md shadow-pink-500/20"
                    >
                      <Paintbrush className="w-3.5 h-3.5" />
                      <span>PAINT TO KEYS</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Voices List Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {voices.map((voice) => {
                const isSelected = voice.id === currentVoice?.id;
                const mappedKeysCount = Object.values(keyVoiceMap).filter(
                  (vid) => vid === voice.id
                ).length;

                return (
                  <div
                    key={voice.id}
                    onClick={() => setSelectedVoiceId(voice.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-[#141724] border-pink-400/80 shadow-md shadow-pink-950/40'
                        : 'bg-black/40 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div>
                      {/* Top Bar of Card */}
                      <div className="flex items-center justify-between mb-2 gap-2">
                        {editingVoiceId === voice.id ? (
                          <div
                            className="flex items-center gap-1 flex-1 min-w-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: voice.color }}
                            />
                            <input
                              ref={renameInputRef}
                              id={`input-rename-voice-${voice.id}`}
                              type="text"
                              value={editingVoiceName}
                              maxLength={28}
                              onChange={(e) => setEditingVoiceName(e.target.value)}
                              onKeyDown={(e) => {
                                e.stopPropagation();
                                if (e.key === 'Enter') {
                                  handleSaveRename(voice.id);
                                } else if (e.key === 'Escape') {
                                  handleCancelRename();
                                }
                              }}
                              className="flex-1 min-w-0 bg-black/80 border border-pink-400/80 rounded px-2 py-0.5 font-mono text-xs font-bold text-white focus:outline-none"
                              placeholder="Enter voice name..."
                            />
                            <button
                              id={`btn-save-voice-name-${voice.id}`}
                              onClick={(e) => handleSaveRename(voice.id, e)}
                              className="p-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 shrink-0 cursor-pointer"
                              title="Save Voice Name (Enter)"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button
                              id={`btn-cancel-voice-name-${voice.id}`}
                              onClick={(e) => handleCancelRename(e)}
                              className="p-1 rounded bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white shrink-0 cursor-pointer"
                              title="Cancel Rename (Esc)"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div
                              className="flex items-center gap-2 min-w-0 group/title"
                              onClick={(e) => handleStartRename(voice, e)}
                              title="Click to rename voice"
                            >
                              <span
                                className="w-3 h-3 rounded-full shrink-0"
                                style={{ backgroundColor: voice.color }}
                              />
                              <span className="font-mono text-xs font-bold text-white truncate group-hover/title:text-pink-300 transition-colors">
                                {voice.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                id={`btn-rename-voice-${voice.id}`}
                                onClick={(e) => handleStartRename(voice, e)}
                                className="p-1 rounded bg-white/5 hover:bg-pink-500/20 text-slate-400 hover:text-pink-300 cursor-pointer"
                                title="Edit Voice Name"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  engine.previewVoice(voice.id);
                                }}
                                className="p-1 rounded bg-white/5 hover:bg-white/15 text-cyan-300 cursor-pointer"
                                title="Audition Voice"
                              >
                                <Play className="w-3 h-3 fill-cyan-300" />
                              </button>
                              {voices.length > 1 && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    engine.deleteVoice(voice.id);
                                  }}
                                  className="p-1 rounded bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 cursor-pointer"
                                  title="Delete Voice"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Waveform Strip */}
                      <div className="h-8 w-full bg-[#080a0f] rounded border border-white/5 px-1 flex items-center gap-[1px] mb-2">
                        {voice.analysis.waveformPeaks.map((peak, idx) => (
                          <div
                            key={idx}
                            className="flex-1 rounded-full"
                            style={{
                              backgroundColor: voice.color,
                              height: `${Math.max(10, Math.round(peak * 85))}%`,
                              opacity: 0.8,
                            }}
                          />
                        ))}
                      </div>

                      {/* Pitch & Root Note Configuration */}
                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-2 gap-2">
                        <span>
                          Det: <strong className="text-cyan-300">{voice.analysis.detectedNote}</strong> (
                          {voice.analysis.frequencyHz}Hz)
                        </span>

                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <span>ROOT:</span>
                          <select
                            value={voice.rootNoteOverride || voice.analysis.detectedNote}
                            onChange={(e) =>
                              engine.updateVoice(voice.id, {
                                rootNoteOverride: e.target.value,
                              })
                            }
                            className="bg-black border border-white/20 rounded px-1 py-0.5 text-white font-bold text-[10px] focus:outline-none"
                          >
                            {ROOT_NOTE_OPTIONS.map((note) => (
                              <option key={note} value={note}>
                                {note}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Color Palette Selector */}
                      <div
                        className="flex items-center gap-1.5 mb-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="text-[9px] font-mono text-slate-500">TAG:</span>
                        {VOICE_PALETTE.map((c) => (
                          <button
                            key={c}
                            onClick={() => engine.updateVoice(voice.id, { color: c })}
                            className={`w-3.5 h-3.5 rounded-full border transition-all ${
                              voice.color === c ? 'scale-125 border-white' : 'border-transparent'
                            }`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Paint to Keyboard Button */}
                    <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                      <span className="text-[10px] font-mono text-slate-400">
                        {mappedKeysCount > 0 ? (
                          <span className="text-cyan-300 font-bold">{mappedKeysCount} keys mapped</span>
                        ) : (
                          <span className="text-slate-500">Unmapped</span>
                        )}
                      </span>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePaintToKeyboard(voice.id);
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 border border-pink-500/40 text-[10px] font-mono font-bold cursor-pointer"
                      >
                        <Paintbrush className="w-3 h-3" />
                        <span>PAINT TO KEYS</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 2: Keyboard Mapper Overview */}
        {activeTab === 'map' && currentVoice && (
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            <div className="p-3.5 rounded-xl bg-black/40 border border-cyan-500/30 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-white font-mono flex items-center gap-2">
                  <span>Selected Voice for Painting:</span>
                  <span
                    className="px-2 py-0.5 rounded text-[11px]"
                    style={{ backgroundColor: `${currentVoice.color}30`, color: currentVoice.color }}
                  >
                    ● {currentVoice.name}
                  </span>
                </span>
                <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                  Click 'Paint Mode' below or use quick row assign buttons. Unmapped keys are silent.
                </p>
              </div>

              <button
                onClick={() => handlePaintToKeyboard(currentVoice.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500 text-slate-950 font-mono text-xs font-bold hover:bg-cyan-400 cursor-pointer shadow-md shadow-cyan-950/50"
              >
                <Paintbrush className="w-3.5 h-3.5" />
                <span>START PAINTING KEYS</span>
              </button>
            </div>

            {/* Quick Row Assignment Helpers */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="p-2.5 rounded-xl bg-black/30 border border-white/5 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase text-cyan-400 font-bold block mb-1">
                    High Row [Q-P]
                  </span>
                  <p className="text-[10px] text-slate-400 mb-2">Lead octaves (Q, W, E, R, T...)</p>
                </div>
                <button
                  onClick={() => handleAssignRowToVoice(ROW_TOP, currentVoice.id)}
                  className="w-full py-1 rounded bg-white/5 hover:bg-white/10 text-cyan-300 font-mono text-[10px] border border-white/10"
                >
                  Map "{currentVoice.name}"
                </button>
              </div>

              <div className="p-2.5 rounded-xl bg-black/30 border border-white/5 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase text-amber-400 font-bold block mb-1">
                    Mid Row [A-;]
                  </span>
                  <p className="text-[10px] text-slate-400 mb-2">Chords & center scale (A, S, D, F...)</p>
                </div>
                <button
                  onClick={() => handleAssignRowToVoice(ROW_MID, currentVoice.id)}
                  className="w-full py-1 rounded bg-white/5 hover:bg-white/10 text-amber-300 font-mono text-[10px] border border-white/10"
                >
                  Map "{currentVoice.name}"
                </button>
              </div>

              <div className="p-2.5 rounded-xl bg-black/30 border border-white/5 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase text-emerald-400 font-bold block mb-1">
                    Bass Row [Z-/]
                  </span>
                  <p className="text-[10px] text-slate-400 mb-2">Deep basslines (Z, X, C, V...)</p>
                </div>
                <button
                  onClick={() => handleAssignRowToVoice(ROW_BOT, currentVoice.id)}
                  className="w-full py-1 rounded bg-white/5 hover:bg-white/10 text-emerald-300 font-mono text-[10px] border border-white/10"
                >
                  Map "{currentVoice.name}"
                </button>
              </div>
            </div>

            {/* Clear All Mappings */}
            <div className="flex justify-end pt-2">
              <button
                onClick={handleClearAllMappings}
                className="flex items-center gap-1 text-[11px] font-mono text-rose-400 hover:text-rose-300 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All Key Mappings</span>
              </button>
            </div>
          </div>
        )}

        {/* Feedback Banner */}
        {feedback && (
          <div className="mt-3 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-mono flex items-center gap-2 shrink-0">
            <Check className="h-3.5 w-3.5 shrink-0" />
            <span>{feedback}</span>
          </div>
        )}

        {/* Bottom Actions */}
        <div className="mt-4 pt-3 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <Drum className="w-4 h-4 text-cyan-400" />
            <span className="text-[10px] font-mono text-slate-400">ASSIGN CURRENT VOICE TO DRUM PAD:</span>
            {(
              [
                { id: 'kick', label: 'KICK [`]' },
                { id: 'snare', label: 'SNARE [-]' },
                { id: 'hihat', label: 'HAT [=]' },
                { id: 'perc', label: 'PERC [[]' },
              ] as const
            ).map((d) => (
              <button
                key={d.id}
                onClick={() => {
                  onAssignToDrumLane(d.id);
                  setFeedback(`Assigned "${currentVoice?.name}" to ${d.label}!`);
                }}
                className="px-2 py-0.5 rounded bg-white/5 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-white/10 font-mono text-[9px] cursor-pointer"
              >
                {d.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              onSelectSamplerPreset();
              onClose();
            }}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-mono text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-pink-950/40"
          >
            <Music className="w-4 h-4" />
            <span>PLAY ON KEYBOARD [PRESET 0]</span>
          </button>
        </div>
      </div>
    </div>
  );
};
