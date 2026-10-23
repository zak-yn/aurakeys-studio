import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { SynthEngine, MacroControls } from './audio/SynthEngine';
import { LooperEngine, LooperTrack } from './audio/LooperEngine';
import { DrumMachine, DrumStyle, DrumLaneState, DrumLaneId } from './audio/DrumMachine';
import { SamplerEngine, CustomSampleData, RegisteredVoice } from './audio/SamplerEngine';
import { SCALES, ScaleDef, buildKeyboardMap } from './audio/scales';
import { PRESETS, PresetConfig } from './audio/presets';
import { usePCKeyboard } from './hooks/usePCKeyboard';

import { TopBar } from './components/TopBar';
import { LooperStation } from './components/LooperStation';
import { BackingBeatBar } from './components/BackingBeatBar';
import { DrumSequencerPanel } from './components/DrumSequencerPanel';
import { SamplerStudioModal } from './components/SamplerStudioModal';
import { VisualizerAndXY } from './components/VisualizerAndXY';
import { KeyboardGrid } from './components/KeyboardGrid';
import { AudioUnlockModal } from './components/AudioUnlockModal';
import { AIDiagnosticModal } from './components/AIDiagnosticModal';
import { AuraKeysHarness } from './audio/AuraKeysHarness';

export const App: React.FC = () => {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [currentPreset, setCurrentPreset] = useState<PresetConfig>(PRESETS[0]);
  const [currentScale, setCurrentScale] = useState<ScaleDef>(SCALES[0]);
  const [currentRoot, setCurrentRoot] = useState<string>('C');
  const [bpm, setBpm] = useState<number>(100);
  const [bars, setBars] = useState<2 | 4 | 8>(4);
  const [isChordMode, setIsChordMode] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  const [currentStep, setCurrentStep] = useState<number>(0);
  const [totalSteps, setTotalSteps] = useState<number>(64);
  const [tracks, setTracks] = useState<LooperTrack[]>(LooperEngine.getInstance().tracks);
  const [selectedTrackIndex, setSelectedTrackIndex] = useState<number>(0);

  // Drum Machine & Step Sequencer State
  const [drumStyle, setDrumStyle] = useState<DrumStyle>('lofi');
  const [isDrumMuted, setIsDrumMuted] = useState<boolean>(false);
  const [drumVolumeDb, setDrumVolumeDb] = useState<number>(-6);
  const [drumLanes, setDrumLanes] = useState<DrumLaneState[]>(DrumMachine.getInstance().lanes);
  const [isSequencerOpen, setIsSequencerOpen] = useState<boolean>(false);
  const [isDrumRecording, setIsDrumRecording] = useState<boolean>(false);

  // Multi-Voice Sampler & Key Mapping State
  const [currentSample, setCurrentSample] = useState<CustomSampleData | null>(null);
  const [voices, setVoices] = useState<RegisteredVoice[]>(SamplerEngine.getInstance().voices);
  const [keyVoiceMap, setKeyVoiceMap] = useState<Record<string, string>>(
    SamplerEngine.getInstance().keyVoiceMap
  );
  const [activePaintVoiceId, setActivePaintVoiceId] = useState<string | null>(
    SamplerEngine.getInstance().activePaintVoiceId
  );
  const [isPaintMode, setIsPaintMode] = useState<boolean>(false);

  const [isSamplerModalOpen, setIsSamplerModalOpen] = useState<boolean>(false);
  const [isDiagnosticModalOpen, setIsDiagnosticModalOpen] = useState<boolean>(false);

  const [macros, setMacros] = useState<MacroControls>({
    warmth: 65,
    space: 35,
    snap: 40,
    echo: 20,
  });

  // Scale Keyboard Mapping
  const keyboardMap = useMemo(() => {
    return buildKeyboardMap(currentRoot, currentScale);
  }, [currentRoot, currentScale]);

  // Dynamically re-harmonize existing loop tracks whenever Root or Scale changes!
  useEffect(() => {
    if (isUnlocked) {
      LooperEngine.getInstance().reharmonizeTracks(keyboardMap);
    }
  }, [keyboardMap, isUnlocked]);

  // Unlock Audio Engine
  const handleUnlockAudio = async () => {
    const synthEngine = SynthEngine.getInstance();
    await synthEngine.init();

    const drumMachine = DrumMachine.getInstance();
    drumMachine.init(synthEngine.limiter);
    drumMachine.onLanesUpdate = (updatedLanes) => {
      setDrumLanes(updatedLanes);
    };

    const samplerEngine = SamplerEngine.getInstance();
    await samplerEngine.initDefaultSample();
    setVoices([...samplerEngine.voices]);
    setKeyVoiceMap({ ...samplerEngine.keyVoiceMap });
    setActivePaintVoiceId(samplerEngine.activePaintVoiceId);

    samplerEngine.subscribeVoices((newVoices, newMap) => {
      setVoices([...newVoices]);
      setKeyVoiceMap({ ...newMap });
    });
    samplerEngine.subscribePaintVoice((voiceId) => {
      setActivePaintVoiceId(voiceId);
    });
    samplerEngine.subscribeSample((sample) => {
      setCurrentSample(sample);
    });
    setCurrentSample(samplerEngine.currentSample);

    const looperEngine = LooperEngine.getInstance();
    looperEngine.init();

    looperEngine.onStepChange = (step, total) => {
      setCurrentStep(step);
      setTotalSteps(total);
    };

    looperEngine.onTracksUpdate = (newTracks) => {
      setTracks(newTracks);
    };

    looperEngine.start();
    setIsPlaying(true);
    setIsUnlocked(true);
  };

  // Preset Selection
  const handleSelectPreset = useCallback((index: number) => {
    if (index >= 0 && index < PRESETS.length) {
      const preset = PRESETS[index];
      setCurrentPreset(preset);
      SynthEngine.getInstance().setLivePreset(preset);
    }
  }, []);

  // Scale & Root
  const handleSelectScale = useCallback((scale: ScaleDef) => {
    setCurrentScale(scale);
  }, []);

  const handleSelectRoot = useCallback((root: string) => {
    setCurrentRoot(root);
  }, []);

  // BPM & Bars
  const handleChangeBpm = useCallback((newBpm: number) => {
    setBpm(newBpm);
    LooperEngine.getInstance().setBpm(newBpm);
  }, []);

  const handleChangeBars = useCallback((newBars: 2 | 4 | 8) => {
    setBars(newBars);
    setTotalSteps(newBars * 16);
    LooperEngine.getInstance().setBars(newBars);
  }, []);

  // Chord Mode
  const handleToggleChordMode = useCallback(() => {
    setIsChordMode((prev) => !prev);
  }, []);

  // Transport Play/Pause
  const handleTogglePlay = useCallback(() => {
    const looper = LooperEngine.getInstance();
    setIsPlaying((prev) => {
      if (prev) {
        looper.stop();
        return false;
      } else {
        looper.start();
        return true;
      }
    });
  }, []);

  // Looper Actions
  const handleSelectTrack = (index: number) => {
    setSelectedTrackIndex(index);
    LooperEngine.getInstance().selectTrack(index);
  };

  const handleToggleRecord = (index: number) => {
    LooperEngine.getInstance().toggleRecordTrack(index);
    setSelectedTrackIndex(index);
    setIsPlaying(true);
  };

  const handleToggleTrackMute = (index: number) => {
    LooperEngine.getInstance().toggleMuteTrack(index);
  };

  const handleClearTrack = (index: number) => {
    LooperEngine.getInstance().clearTrack(index);
  };

  const handleChangeTrackVolume = (index: number, volDb: number) => {
    LooperEngine.getInstance().setTrackVolume(index, volDb);
  };

  // Drum Machine & Step Sequencer Actions
  const handleSelectDrumStyle = (style: DrumStyle) => {
    setDrumStyle(style);
    DrumMachine.getInstance().setStyle(style);
  };

  const handleToggleDrumMute = () => {
    const isMuted = DrumMachine.getInstance().toggleMute();
    setIsDrumMuted(isMuted);
  };

  const handleChangeDrumVolume = (volDb: number) => {
    setDrumVolumeDb(volDb);
    DrumMachine.getInstance().setVolume(volDb);
  };

  const handleToggleDrumStep = (laneIdx: number, stepIdx: number) => {
    DrumMachine.getInstance().toggleStep(laneIdx, stepIdx);
  };

  const handleToggleDrumLaneMute = (laneIdx: number) => {
    DrumMachine.getInstance().toggleLaneMute(laneIdx);
  };

  const handleChangeDrumLaneVolume = (laneIdx: number, volDb: number) => {
    DrumMachine.getInstance().setLaneVolume(laneIdx, volDb);
  };

  const handleTriggerDrumPad = useCallback((laneIdx: number) => {
    DrumMachine.getInstance().triggerLivePad(laneIdx);
  }, []);

  const handleToggleDrumRecording = () => {
    const dm = DrumMachine.getInstance();
    dm.isDrumRecording = !dm.isDrumRecording;
    setIsDrumRecording(dm.isDrumRecording);
  };

  const handleClearCustomDrumSample = (laneId: DrumLaneId) => {
    DrumMachine.getInstance().clearCustomLaneSample(laneId);
  };

  const handleClearAllDrumSteps = () => {
    DrumMachine.getInstance().clearAllSteps();
  };

  const handleResetDrumPattern = () => {
    DrumMachine.getInstance().setStyle(drumStyle);
  };

  // Sampler Actions
  const handleAssignSampleToDrumLane = (laneId: DrumLaneId) => {
    SamplerEngine.getInstance().assignCurrentSampleToDrumLane(laneId);
    setIsSequencerOpen(true);
  };

  // Sound Shaping Macros & XY
  const handleChangeMacro = useCallback((key: keyof MacroControls, val: number) => {
    SynthEngine.getInstance().setMacro(key, val);
    setMacros({ ...SynthEngine.getInstance().macros });
  }, []);

  const handleXYChange = useCallback((x: number, y: number) => {
    SynthEngine.getInstance().setXYMood(x, y);
    setMacros({ ...SynthEngine.getInstance().macros });
  }, []);

  // Master Audio Export
  const handleStartExport = useCallback(async () => {
    await SynthEngine.getInstance().startRecording();
  }, []);

  const handleStopExport = useCallback(async () => {
    const scaleTag = `${currentRoot}-${currentScale.id}`;
    const filename = `aurakeys-${scaleTag}-${bpm}bpm.webm`;
    await SynthEngine.getInstance().stopRecordingAndDownload(filename);
  }, [currentRoot, currentScale.id, bpm]);

  // Multi-Voice Key Mapping Actions
  const handlePaintKey = useCallback((code: string) => {
    SamplerEngine.getInstance().paintKey(code);
    setKeyVoiceMap({ ...SamplerEngine.getInstance().keyVoiceMap });
  }, []);

  const handleStartPaintMode = useCallback((voiceId: string) => {
    SamplerEngine.getInstance().setPaintVoice(voiceId);
    setActivePaintVoiceId(voiceId);
    setIsPaintMode(true);
    handleSelectPreset(5); // Automatically select Multi-Voice Sampler (0)
  }, [handleSelectPreset]);

  const handleExitPaintMode = useCallback(() => {
    setIsPaintMode(false);
  }, []);

  // Hook for PC Keyboard Note & Hotkey bindings
  const {
    activeKeys,
    isShiftHeld,
    isSustainActive,
    toggleSustain,
    handleVirtualKeyDown,
    handleVirtualKeyUp,
  } = usePCKeyboard({
    keyboardMap,
    isChordModeToggled: isChordMode,
    onToggleChordMode: handleToggleChordMode,
    onSelectPreset: handleSelectPreset,
    onTriggerDrumPad: handleTriggerDrumPad,
    onTogglePlay: handleTogglePlay,
    isUnlocked,
  });

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col font-sans select-none antialiased">
      {/* 1. Initial Web Audio Unlock Modal */}
      {!isUnlocked && <AudioUnlockModal onUnlock={handleUnlockAudio} />}

      {/* 2. Multi-Voice Studio & Key Mapper Modal */}
      <SamplerStudioModal
        isOpen={isSamplerModalOpen}
        onClose={() => setIsSamplerModalOpen(false)}
        currentRoot={currentRoot}
        currentScaleName={currentScale.name}
        onSelectSamplerPreset={() => handleSelectPreset(5)}
        onAssignToDrumLane={handleAssignSampleToDrumLane}
        onStartPaintMode={handleStartPaintMode}
      />

      {/* 3. AI Diagnostic & Automated Test Harness Modal */}
      <AIDiagnosticModal
        isOpen={isDiagnosticModalOpen}
        onClose={() => setIsDiagnosticModalOpen(false)}
      />

      {/* 4. Global Top Control Bar */}
      <TopBar
        currentPreset={currentPreset}
        onSelectPreset={handleSelectPreset}
        currentScale={currentScale}
        onSelectScale={handleSelectScale}
        currentRoot={currentRoot}
        onSelectRoot={handleSelectRoot}
        bpm={bpm}
        onChangeBpm={handleChangeBpm}
        bars={bars}
        onChangeBars={handleChangeBars}
        isChordMode={isChordMode}
        onToggleChordMode={handleToggleChordMode}
        isPlaying={isPlaying}
        onTogglePlay={handleTogglePlay}
        onStartExport={handleStartExport}
        onStopExport={handleStopExport}
        currentSample={currentSample}
        onOpenSamplerModal={() => setIsSamplerModalOpen(true)}
        onOpenDiagnosticModal={() => setIsDiagnosticModalOpen(true)}
      />

      {/* 4. Main Workspace Dashboard */}
      <main className="flex-1 px-3 py-2 flex flex-col gap-2 max-w-[1700px] w-full mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 flex-1 items-stretch">
          {/* Middle Left: 4-Track Live Looper Station + Backing Beat Bar + Interactive Drum Sequencer (65% = 8 cols) */}
          <div className="lg:col-span-8 flex flex-col gap-2 justify-between">
            <LooperStation
              tracks={tracks}
              selectedTrackIndex={selectedTrackIndex}
              currentStep={currentStep}
              totalSteps={totalSteps}
              onSelectTrack={handleSelectTrack}
              onToggleRecord={handleToggleRecord}
              onToggleMute={handleToggleTrackMute}
              onClearTrack={handleClearTrack}
              onChangeVolume={handleChangeTrackVolume}
            />

            <BackingBeatBar
              currentStyle={drumStyle}
              isMuted={isDrumMuted}
              volumeDb={drumVolumeDb}
              isSequencerOpen={isSequencerOpen}
              isDrumRecording={isDrumRecording}
              onSelectStyle={handleSelectDrumStyle}
              onToggleMute={handleToggleDrumMute}
              onChangeVolume={handleChangeDrumVolume}
              onToggleSequencer={() => setIsSequencerOpen((prev) => !prev)}
              onToggleDrumRecording={handleToggleDrumRecording}
              onTriggerPad={handleTriggerDrumPad}
            />

            {isSequencerOpen && (
              <DrumSequencerPanel
                lanes={drumLanes}
                currentStepInBar={currentStep % 16}
                isDrumRecording={isDrumRecording}
                onToggleStep={handleToggleDrumStep}
                onToggleLaneMute={handleToggleDrumLaneMute}
                onChangeLaneVolume={handleChangeDrumLaneVolume}
                onTriggerPad={handleTriggerDrumPad}
                onClearCustomSample={handleClearCustomDrumSample}
                onClearAllSteps={handleClearAllDrumSteps}
                onResetPresetPattern={handleResetDrumPattern}
              />
            )}
          </div>

          {/* Middle Right: Visualizer & Sound Shaper (35% = 4 cols) */}
          <div className="lg:col-span-4">
            <VisualizerAndXY
              macros={macros}
              onChangeMacro={handleChangeMacro}
              onXYChange={handleXYChange}
              isUnlocked={isUnlocked}
            />
          </div>
        </div>

        {/* 5. Bottom Section: Interactive 3-Row Keyboard Grid with Voice Badges & Paint Mode */}
        <KeyboardGrid
          keyboardMap={keyboardMap}
          activeKeys={activeKeys}
          isShiftHeld={isShiftHeld}
          isChordModeToggled={isChordMode}
          isSustainActive={isSustainActive}
          onToggleSustain={toggleSustain}
          onVirtualKeyDown={handleVirtualKeyDown}
          onVirtualKeyUp={handleVirtualKeyUp}
          keyVoiceMap={keyVoiceMap}
          voices={voices}
          activePaintVoiceId={activePaintVoiceId}
          isPaintMode={isPaintMode}
          onPaintKey={handlePaintKey}
          onStartPaintMode={handleStartPaintMode}
          onExitPaintMode={handleExitPaintMode}
          isSamplerVoiceActive={currentPreset.isSamplerVoice}
        />
      </main>
    </div>
  );
};
export default App;
