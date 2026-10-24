import { useEffect, useRef, useState, useCallback } from 'react';
import { SynthEngine } from '../audio/SynthEngine';
import { LooperEngine } from '../audio/LooperEngine';
import { DrumMachine } from '../audio/DrumMachine';
import { PRESETS } from '../audio/presets';
import { KeyNoteInfo } from '../audio/scales';

interface UsePCKeyboardProps {
  keyboardMap: Map<string, KeyNoteInfo>;
  isChordModeToggled: boolean;
  onToggleChordMode: () => void;
  onSelectPreset: (index: number) => void;
  onTriggerDrumPad?: (laneIndex: number) => void;
  onTogglePlay?: () => void;
  isUnlocked: boolean;
}

const DRUM_PAD_CODES: Record<string, number> = {
  Backquote: 0,    // ` -> Kick
  Minus: 1,        // - -> Snare
  Equal: 2,        // = -> Hi-Hat
  BracketLeft: 3,  // [ -> Perc
};

export function usePCKeyboard({
  keyboardMap,
  isChordModeToggled,
  onToggleChordMode,
  onSelectPreset,
  onTriggerDrumPad,
  onTogglePlay,
  isUnlocked,
}: UsePCKeyboardProps) {
  const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set());
  const [isShiftHeld, setIsShiftHeld] = useState<boolean>(false);
  const [isSustainActive, setIsSustainActive] = useState<boolean>(false);

  // Refs for zero-stale-closure key listener
  const activeKeysRef = useRef<Set<string>>(new Set());
  const sustainedKeysRef = useRef<Set<string>>(new Set());
  const isSustainActiveRef = useRef<boolean>(false);
  const isShiftHeldRef = useRef<boolean>(false);
  const keyboardMapRef = useRef(keyboardMap);
  const isChordModeRef = useRef(isChordModeToggled);
  const lastKeyDownTimeRef = useRef<Map<string, number>>(new Map());

  keyboardMapRef.current = keyboardMap;
  isChordModeRef.current = isChordModeToggled;

  const updateActiveKeysScheduled = useRef(false);
  const scheduleUpdateActiveKeys = useCallback(() => {
    if (updateActiveKeysScheduled.current) return;
    updateActiveKeysScheduled.current = true;
    requestAnimationFrame(() => {
      updateActiveKeysScheduled.current = false;
      setActiveKeys(new Set(activeKeysRef.current));
    });
  }, []);

  const triggerNoteStart = useCallback((code: string, isChord: boolean) => {
    const keyInfo = keyboardMapRef.current.get(code);
    if (!keyInfo) return;

    const notesToPlay = isChord ? keyInfo.chordNotes : [keyInfo.note];

    // 1. Play live synth or auto-pitch sampler
    const synthEngine = SynthEngine.getInstance();
    synthEngine.triggerLiveAttack(code, notesToPlay);

    // 2. Feed into looper (including physical code & chord flag for live scale reharmonization)
    const looperEngine = LooperEngine.getInstance();
    looperEngine.handleNoteOn(code, notesToPlay, isChord);
  }, []);

  const triggerNoteEnd = useCallback((code: string) => {
    // 1. Release live synth / sampler
    const synthEngine = SynthEngine.getInstance();
    synthEngine.triggerLiveRelease(code);

    // 2. Feed into looper
    const looperEngine = LooperEngine.getInstance();
    looperEngine.handleNoteOff(code);
  }, []);

  useEffect(() => {
    if (!isUnlocked) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore key repeat or typing inside an input/select element
      if (event.repeat) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }

      const code = event.code;

      // Debounce hardware switch chatter under 18ms
      const now = performance.now();
      const lastHit = lastKeyDownTimeRef.current.get(code) || 0;
      if (now - lastHit < 18) {
        return;
      }
      lastKeyDownTimeRef.current.set(code, now);

      // Handle Shift tracking
      if (code === 'ShiftLeft' || code === 'ShiftRight') {
        isShiftHeldRef.current = true;
        setIsShiftHeld(true);
      }

      // Handle Space (Master Transport Play / Pause)
      if (code === 'Space') {
        event.preventDefault();
        onTogglePlay?.();
        return;
      }

      // Handle Sustain Pedal Keys: Alt (Thumb) or Quote / BracketRight (Pinky)
      if (code === 'AltLeft' || code === 'AltRight' || code === 'Quote' || code === 'BracketRight') {
        event.preventDefault();
        isSustainActiveRef.current = true;
        setIsSustainActive(true);
        return;
      }

      // Handle Tab (Toggle Drum Beat)
      if (code === 'Tab') {
        event.preventDefault();
        const drumMachine = DrumMachine.getInstance();
        drumMachine.toggleMute();
        return;
      }

      // Handle Live Drum Pad Hotkeys: ` - = [
      if (code in DRUM_PAD_CODES) {
        event.preventDefault();
        const laneIdx = DRUM_PAD_CODES[code];
        if (onTriggerDrumPad) {
          onTriggerDrumPad(laneIdx);
        } else {
          DrumMachine.getInstance().triggerLivePad(laneIdx);
        }
        return;
      }

      // Handle Looper Track Hotkeys: Digit1 - Digit4
      if (['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(code)) {
        event.preventDefault();
        const trackIdx = parseInt(code.replace('Digit', ''), 10) - 1;
        const looper = LooperEngine.getInstance();

        if (event.shiftKey || isShiftHeldRef.current) {
          looper.toggleMuteTrack(trackIdx);
        } else {
          looper.toggleRecordTrack(trackIdx);
        }
        return;
      }

      // Handle Preset Hotkeys: Digit5 - Digit9 (Presets 1-5) & Digit0 (Preset 6: Auto-Pitch Sampler)
      if (['Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0'].includes(code)) {
        event.preventDefault();
        const presetIdx = code === 'Digit0' ? 5 : parseInt(code.replace('Digit', ''), 10) - 5;
        if (presetIdx >= 0 && presetIdx < PRESETS.length) {
          onSelectPreset(presetIdx);
        }
        return;
      }

      // Handle Backspace (Clear current track)
      if (code === 'Backspace') {
        event.preventDefault();
        const looper = LooperEngine.getInstance();
        looper.clearTrack(looper.selectedTrackIndex);
        return;
      }

      // Handle Note Keys
      if (keyboardMapRef.current.has(code)) {
        if (code === 'Slash' || code === 'Semicolon') {
          event.preventDefault();
        }

        activeKeysRef.current.add(code);
        scheduleUpdateActiveKeys();

        const isChord = isChordModeRef.current || isShiftHeldRef.current;
        triggerNoteStart(code, isChord);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }

      const code = event.code;

      if (code === 'ShiftLeft' || code === 'ShiftRight') {
        isShiftHeldRef.current = false;
        setIsShiftHeld(false);
      }

      // Release Sustain on keyup of Alt, Quote, or BracketRight
      if (code === 'AltLeft' || code === 'AltRight' || code === 'Quote' || code === 'BracketRight') {
        event.preventDefault();
        isSustainActiveRef.current = false;
        setIsSustainActive(false);

        sustainedKeysRef.current.forEach((sustainedCode) => {
          if (!activeKeysRef.current.has(sustainedCode)) {
            triggerNoteEnd(sustainedCode);
          }
        });
        sustainedKeysRef.current.clear();
        return;
      }

      // Prevent default on Space keyup to avoid scrolling or button triggering
      if (code === 'Space') {
        event.preventDefault();
        return;
      }

      if (keyboardMapRef.current.has(code)) {
        activeKeysRef.current.delete(code);
        scheduleUpdateActiveKeys();

        if (isSustainActiveRef.current) {
          sustainedKeysRef.current.add(code);
        } else {
          triggerNoteEnd(code);
        }
      }
    };

    const handleWindowBlur = () => {
      activeKeysRef.current.clear();
      sustainedKeysRef.current.clear();
      setActiveKeys(new Set());
      isShiftHeldRef.current = false;
      setIsShiftHeld(false);
      isSustainActiveRef.current = false;
      setIsSustainActive(false);

      SynthEngine.getInstance().releaseAllLiveNotes();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [isUnlocked, onSelectPreset, onTriggerDrumPad, onTogglePlay, triggerNoteStart, triggerNoteEnd]);

  const toggleSustain = useCallback(() => {
    const nextState = !isSustainActiveRef.current;
    isSustainActiveRef.current = nextState;
    setIsSustainActive(nextState);

    if (!nextState) {
      sustainedKeysRef.current.forEach((sustainedCode) => {
        if (!activeKeysRef.current.has(sustainedCode)) {
          triggerNoteEnd(sustainedCode);
        }
      });
      sustainedKeysRef.current.clear();
    }
  }, [triggerNoteEnd]);

  const handleVirtualKeyDown = useCallback(
    (code: string) => {
      if (!isUnlocked) return;
      activeKeysRef.current.add(code);
      scheduleUpdateActiveKeys();
      const isChord = isChordModeRef.current || isShiftHeldRef.current;
      triggerNoteStart(code, isChord);
    },
    [isUnlocked, triggerNoteStart]
  );

  const handleVirtualKeyUp = useCallback(
    (code: string) => {
      if (!isUnlocked) return;
      activeKeysRef.current.delete(code);
      scheduleUpdateActiveKeys();

      if (isSustainActiveRef.current) {
        sustainedKeysRef.current.add(code);
      } else {
        triggerNoteEnd(code);
      }
    },
    [isUnlocked, triggerNoteEnd]
  );

  return {
    activeKeys,
    isShiftHeld,
    isSustainActive,
    toggleSustain,
    handleVirtualKeyDown,
    handleVirtualKeyUp,
  };
}
