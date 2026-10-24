import * as Tone from 'tone';
import { PitchDetector, PitchAnalysisResult } from './PitchDetector';
import { SynthEngine } from './SynthEngine';
import { DrumMachine, DrumLaneId } from './DrumMachine';
import { VoiceStorage, SerializedVoice } from './VoiceStorage';

export interface RegisteredVoice {
  id: string;
  name: string;
  color: string;
  analysis: PitchAnalysisResult;
  rootNoteOverride?: string;
  autoPitchEnabled: boolean;
  octaveShift: -2 | -1 | 0 | 1;
}

export type CustomSampleData = RegisteredVoice;

export const VOICE_PALETTE = [
  '#06b6d4', // Cyan
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#a855f7', // Violet
  '#f43f5e', // Rose
  '#3b82f6', // Sky Blue
];

export interface FactoryVoiceSpec {
  id: string;
  word: string;
  name: string;
  keyCode: string;
  colorIndex: number;
}

export const FACTORY_VOICE_SPECS: FactoryVoiceSpec[] = [
  // High Octave (Lead / Hype) [Q - P]
  { id: 'voice_hey', word: 'hey', name: 'Hey', keyCode: 'KeyQ', colorIndex: 0 },
  { id: 'voice_yeah', word: 'yeah', name: 'Yeah', keyCode: 'KeyW', colorIndex: 1 },
  { id: 'voice_go', word: 'go', name: 'Go', keyCode: 'KeyE', colorIndex: 2 },
  { id: 'voice_fire', word: 'fire', name: 'Fire', keyCode: 'KeyR', colorIndex: 4 },
  { id: 'voice_drop', word: 'drop', name: 'Drop', keyCode: 'KeyT', colorIndex: 3 },
  { id: 'voice_power', word: 'power', name: 'Power', keyCode: 'KeyY', colorIndex: 5 },
  { id: 'voice_dance', word: 'dance', name: 'Dance', keyCode: 'KeyU', colorIndex: 0 },
  { id: 'voice_play', word: 'play', name: 'Play', keyCode: 'KeyI', colorIndex: 1 },
  { id: 'voice_alright', word: 'alright', name: 'Alright', keyCode: 'KeyO', colorIndex: 2 },
  { id: 'voice_yes', word: 'yes', name: 'Yes', keyCode: 'KeyP', colorIndex: 4 },

  // Mid Octave (Main / Soul / Melody) [A - ;]
  { id: 'voice_hello', word: 'hello', name: 'Hello', keyCode: 'KeyA', colorIndex: 0 },
  { id: 'voice_listen', word: 'listen', name: 'Listen', keyCode: 'KeyS', colorIndex: 1 },
  { id: 'voice_music', word: 'music', name: 'Music', keyCode: 'KeyD', colorIndex: 2 },
  { id: 'voice_love', word: 'love', name: 'Love', keyCode: 'KeyF', colorIndex: 4 },
  { id: 'voice_heart', word: 'heart', name: 'Heart', keyCode: 'KeyG', colorIndex: 3 },
  { id: 'voice_soul', word: 'soul', name: 'Soul', keyCode: 'KeyH', colorIndex: 5 },
  { id: 'voice_sing', word: 'sing', name: 'Sing', keyCode: 'KeyJ', colorIndex: 0 },
  { id: 'voice_dream', word: 'dream', name: 'Dream', keyCode: 'KeyK', colorIndex: 1 },
  { id: 'voice_sound', word: 'sound', name: 'Sound', keyCode: 'KeyL', colorIndex: 2 },
  { id: 'voice_voice', word: 'voice', name: 'Voice', keyCode: 'Semicolon', colorIndex: 4 },

  // Bass Octave (Rhythm / Groove / Count) [Z - /]
  { id: 'voice_one', word: 'one', name: 'One', keyCode: 'KeyZ', colorIndex: 0 },
  { id: 'voice_two', word: 'two', name: 'Two', keyCode: 'KeyX', colorIndex: 1 },
  { id: 'voice_three', word: 'three', name: 'Three', keyCode: 'KeyC', colorIndex: 2 },
  { id: 'voice_four', word: 'four', name: 'Four', keyCode: 'KeyV', colorIndex: 4 },
  { id: 'voice_bass', word: 'bass', name: 'Bass', keyCode: 'KeyB', colorIndex: 3 },
  { id: 'voice_beat', word: 'beat', name: 'Beat', keyCode: 'KeyN', colorIndex: 5 },
  { id: 'voice_drum', word: 'drum', name: 'Drum', keyCode: 'KeyM', colorIndex: 0 },
  { id: 'voice_touch', word: 'touch', name: 'Touch', keyCode: 'Comma', colorIndex: 1 },
  { id: 'voice_night', word: 'night', name: 'Night', keyCode: 'Period', colorIndex: 2 },
  { id: 'voice_baby', word: 'baby', name: 'Baby', keyCode: 'Slash', colorIndex: 4 },
];

export class SamplerEngine {
  private static instance: SamplerEngine | null = null;

  public voices: RegisteredVoice[] = [];
  private voiceByIdMap: Map<string, RegisteredVoice> = new Map();
  public keyVoiceMap: Record<string, string> = {}; // QWERTY code -> voiceId
  public activePaintVoiceId: string | null = null;
  public activeVoiceIndex: number = 0;

  public isRecordingMic: boolean = false;
  public micLevel: number = 0;

  private initPromise: Promise<void> | null = null;
  private persistTimer: any = null;
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private meterAnimId: number | null = null;
  private audioCtxForMeter: AudioContext | null = null;

  // Multi-Subscriber Listener Sets
  private voicesListeners: Set<(voices: RegisteredVoice[], keyVoiceMap: Record<string, string>) => void> = new Set();
  private paintVoiceListeners: Set<(voiceId: string | null) => void> = new Set();
  private sampleListeners: Set<(sample: RegisteredVoice | null) => void> = new Set();
  private micLevelListeners: Set<(level: number) => void> = new Set();

  private _legacyOnVoicesUpdated?: (voices: RegisteredVoice[], keyVoiceMap: Record<string, string>) => void;
  private _legacyOnActivePaintVoiceChange?: (voiceId: string | null) => void;
  private _legacyOnSampleUpdated?: (sample: RegisteredVoice | null) => void;
  private _legacyOnMicLevelChange?: (level: number) => void;

  public subscribeVoices(fn: (voices: RegisteredVoice[], keyVoiceMap: Record<string, string>) => void): () => void {
    this.voicesListeners.add(fn);
    fn([...this.voices], { ...this.keyVoiceMap });
    return () => {
      this.voicesListeners.delete(fn);
    };
  }

  public subscribePaintVoice(fn: (voiceId: string | null) => void): () => void {
    this.paintVoiceListeners.add(fn);
    fn(this.activePaintVoiceId);
    return () => {
      this.paintVoiceListeners.delete(fn);
    };
  }

  public subscribeSample(fn: (sample: RegisteredVoice | null) => void): () => void {
    this.sampleListeners.add(fn);
    fn(this.currentSample);
    return () => {
      this.sampleListeners.delete(fn);
    };
  }

  public subscribeMicLevel(fn: (level: number) => void): () => void {
    this.micLevelListeners.add(fn);
    return () => {
      this.micLevelListeners.delete(fn);
    };
  }

  // Legacy single-property compatibility accessors
  public get onVoicesUpdated() {
    return this._legacyOnVoicesUpdated;
  }
  public set onVoicesUpdated(fn: ((voices: RegisteredVoice[], keyVoiceMap: Record<string, string>) => void) | undefined) {
    if (this._legacyOnVoicesUpdated) {
      this.voicesListeners.delete(this._legacyOnVoicesUpdated);
    }
    this._legacyOnVoicesUpdated = fn;
    if (fn) {
      this.voicesListeners.add(fn);
    }
  }

  public get onActivePaintVoiceChange() {
    return this._legacyOnActivePaintVoiceChange;
  }
  public set onActivePaintVoiceChange(fn: ((voiceId: string | null) => void) | undefined) {
    if (this._legacyOnActivePaintVoiceChange) {
      this.paintVoiceListeners.delete(this._legacyOnActivePaintVoiceChange);
    }
    this._legacyOnActivePaintVoiceChange = fn;
    if (fn) {
      this.paintVoiceListeners.add(fn);
    }
  }

  public get onSampleUpdated() {
    return this._legacyOnSampleUpdated;
  }
  public set onSampleUpdated(fn: ((sample: RegisteredVoice | null) => void) | undefined) {
    if (this._legacyOnSampleUpdated) {
      this.sampleListeners.delete(this._legacyOnSampleUpdated);
    }
    this._legacyOnSampleUpdated = fn;
    if (fn) {
      this.sampleListeners.add(fn);
    }
  }

  public get onMicLevelChange() {
    return this._legacyOnMicLevelChange;
  }
  public set onMicLevelChange(fn: ((level: number) => void) | undefined) {
    if (this._legacyOnMicLevelChange) {
      this.micLevelListeners.delete(this._legacyOnMicLevelChange);
    }
    this._legacyOnMicLevelChange = fn;
    if (fn) {
      this.micLevelListeners.add(fn);
    }
  }

  private constructor() {}

  public static getInstance(): SamplerEngine {
    if (!SamplerEngine.instance) {
      SamplerEngine.instance = new SamplerEngine();
    }
    return SamplerEngine.instance;
  }

  public get currentSample(): RegisteredVoice | null {
    if (this.voices.length === 0) return null;
    return this.voices[this.activeVoiceIndex] || this.voices[0] || null;
  }

  /**
   * Initializes default human vocal kit or loads from IndexedDB persistence.
   * Deduplicated via initPromise so concurrent calls never double-fetch/decode.
   */
  public async initDefaultSample(): Promise<void> {
    if (this.voices.length > 0) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._doInitDefaultSample().finally(() => {
      this.initPromise = null;
    });
    return this.initPromise;
  }

  private async _doInitDefaultSample(): Promise<void> {
    if (this.voices.length > 0) return;

    // 1. Try loading from IndexedDB
    try {
      const savedKit = await VoiceStorage.loadKit();
      const isLegacyKit =
        !savedKit ||
        savedKit.voices.length <= 2 ||
        savedKit.voices.some((v) => v.id === 'voice_thanks');

      if (savedKit && savedKit.voices.length > 2 && !isLegacyKit) {
        const rawCtx = Tone.getContext().rawContext as AudioContext;
        const restoredVoices: RegisteredVoice[] = [];

        for (const sv of savedKit.voices) {
          const buffer = VoiceStorage.dataToAudioBuffer(rawCtx, sv.channelData, sv.sampleRate);
          restoredVoices.push({
            id: sv.id,
            name: sv.name,
            color: sv.color,
            rootNoteOverride: sv.rootNoteOverride,
            autoPitchEnabled: sv.autoPitchEnabled,
            octaveShift: sv.octaveShift,
            analysis: {
              isTonal: sv.confidence >= 0.72,
              frequencyHz: sv.frequencyHz,
              detectedNote: sv.detectedNote,
              detectedMidi: sv.detectedMidi,
              centsCorrection: sv.centsCorrection,
              confidence: sv.confidence,
              durationSeconds: sv.durationSeconds,
              trimmedBuffer: buffer,
              waveformPeaks: sv.waveformPeaks,
            },
          });
        }

        this.voices = restoredVoices;
        this.rebuildVoiceIndex();
        this.keyVoiceMap = savedKit.keyVoiceMap || {};
        this.activePaintVoiceId = this.voices[0]?.id || null;
        this.syncToSynthAndNotify();
        return;
      }
    } catch (e) {
      console.warn('[SamplerEngine] Could not restore from IndexedDB:', e);
    }

    // 2. Load 30 real human vocal samples from /voices/*.ogg
    await this.loadFactoryVoices();
  }

  private rebuildVoiceIndex() {
    this.voiceByIdMap.clear();
    for (let i = 0; i < this.voices.length; i++) {
      this.voiceByIdMap.set(this.voices[i].id, this.voices[i]);
    }
  }

  /**
   * Loads 30 real human voice audio clips from /voices/*.ogg and maps all 30 keys.
   */
  public async loadFactoryVoices(): Promise<void> {
    const rawCtx = Tone.getContext().rawContext as AudioContext;
    const loadedVoices: RegisteredVoice[] = [];
    const keyMap: Record<string, string> = {};

    const loadTasks = FACTORY_VOICE_SPECS.map(async (spec) => {
      try {
        const resp = await fetch(`/voices/${spec.word}.ogg`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const arrayBuf = await resp.arrayBuffer();
        const audioBuf = await rawCtx.decodeAudioData(arrayBuf);
        const analysis = PitchDetector.analyzeAndPrepareBuffer(audioBuf);

        const voice: RegisteredVoice = {
          id: spec.id,
          name: spec.name,
          color: VOICE_PALETTE[spec.colorIndex % VOICE_PALETTE.length],
          analysis,
          rootNoteOverride: analysis.detectedNote,
          autoPitchEnabled: true,
          octaveShift: 0,
        };
        return { voice, keyCode: spec.keyCode };
      } catch (err) {
        console.warn(`[SamplerEngine] Could not load voice "${spec.word}":`, err);
        // Fallback procedural voice
        const sampleRate = rawCtx.sampleRate || 44100;
        const buf = rawCtx.createBuffer(1, Math.floor(sampleRate * 0.7), sampleRate);
        const d = buf.getChannelData(0);
        const f0 = 220 + spec.colorIndex * 25;
        for (let i = 0; i < d.length; i++) {
          const t = i / sampleRate;
          d[i] =
            (0.6 * Math.sin(2 * Math.PI * f0 * t) + 0.3 * Math.sin(2 * Math.PI * f0 * 2 * t)) *
            Math.exp(-t * 3.5);
        }
        const analysis = PitchDetector.analyzeAndPrepareBuffer(buf);
        const voice: RegisteredVoice = {
          id: spec.id,
          name: spec.name,
          color: VOICE_PALETTE[spec.colorIndex % VOICE_PALETTE.length],
          analysis,
          rootNoteOverride: analysis.detectedNote,
          autoPitchEnabled: true,
          octaveShift: 0,
        };
        return { voice, keyCode: spec.keyCode };
      }
    });

    const results = await Promise.all(loadTasks);
    for (const res of results) {
      if (res) {
        loadedVoices.push(res.voice);
        keyMap[res.keyCode] = res.voice.id;
      }
    }

    if (loadedVoices.length > 0) {
      this.voices = loadedVoices;
      this.keyVoiceMap = keyMap;
      this.activeVoiceIndex = 0;
      this.activePaintVoiceId = loadedVoices[0].id;
      this.syncToSynthAndNotify();
      this.persistKit();
    }
  }

  public createFactoryVoices() {
    this.loadFactoryVoices();
  }

  /**
   * Toggles mapping of a key to the active paint voice.
   * If the key already has this voice, it unmaps it (toggles off).
   */
  public paintKey(code: string, targetVoiceId?: string): boolean {
    const voiceId = targetVoiceId || this.activePaintVoiceId;
    if (!voiceId) return false;

    if (this.keyVoiceMap[code] === voiceId) {
      // Toggle off / unmap
      delete this.keyVoiceMap[code];
    } else {
      // Assign voice
      this.keyVoiceMap[code] = voiceId;
    }

    this.notifyUpdate();
    this.persistKit();
    return true;
  }

  /**
   * Explicitly assigns or unmaps a key (used for drag-swipe painting so swiping over keys never toggles unexpectedly).
   */
  public setKeyVoiceExplicit(code: string, voiceId: string | null): boolean {
    if (voiceId === null) {
      if (!(code in this.keyVoiceMap)) return false;
      delete this.keyVoiceMap[code];
    } else {
      if (this.keyVoiceMap[code] === voiceId) return false;
      this.keyVoiceMap[code] = voiceId;
    }
    this.notifyUpdate();
    this.persistKit();
    return true;
  }

  /**
   * Bulk-assigns an array of QWERTY key codes (e.g. a full row or all 30 keys) to a voice in 1 operation.
   */
  public assignKeysToVoice(codes: string[], targetVoiceId?: string): boolean {
    const voiceId = targetVoiceId || this.activePaintVoiceId;
    if (!voiceId) return false;

    for (let i = 0; i < codes.length; i++) {
      this.keyVoiceMap[codes[i]] = voiceId;
    }

    this.notifyUpdate();
    this.persistKit();
    return true;
  }

  /**
   * Restores the default 30-key factory voice mapping without deleting any custom recorded voices.
   */
  public restoreDefaultKeyMap() {
    const newMap: Record<string, string> = {};
    for (let i = 0; i < FACTORY_VOICE_SPECS.length; i++) {
      const spec = FACTORY_VOICE_SPECS[i];
      if (this.voiceByIdMap.has(spec.id)) {
        newMap[spec.keyCode] = spec.id;
      }
    }
    this.keyVoiceMap = newMap;
    this.notifyUpdate();
    this.persistKit();
  }

  public setPaintVoice(voiceId: string | null) {
    this.activePaintVoiceId = voiceId;
    this.notifyPaintVoice();
  }

  public getVoiceForKey(code: string): RegisteredVoice | null {
    const voiceId = this.keyVoiceMap[code];
    if (!voiceId) return null;
    return this.voiceByIdMap.get(voiceId) || null;
  }

  public getVoiceById(id: string): RegisteredVoice | null {
    return this.voiceByIdMap.get(id) || null;
  }

  public selectActiveVoice(index: number) {
    if (index >= 0 && index < this.voices.length) {
      this.activeVoiceIndex = index;
      this.activePaintVoiceId = this.voices[index].id;
      this.notifyPaintVoice();
      this.notifyUpdate();
    }
  }

  public updateVoice(voiceId: string, updates: Partial<RegisteredVoice>) {
    const idx = this.voices.findIndex((v) => v.id === voiceId);
    if (idx === -1) return;

    this.voices[idx] = {
      ...this.voices[idx],
      ...updates,
    };

    this.syncToSynthAndNotify();
    this.persistKit();
  }

  public renameVoice(voiceId: string, newName: string): boolean {
    const trimmed = newName.trim().slice(0, 28);
    if (!trimmed) return false;

    const idx = this.voices.findIndex((v) => v.id === voiceId);
    if (idx === -1) return false;

    this.voices[idx] = {
      ...this.voices[idx],
      name: trimmed,
    };

    this.rebuildVoiceIndex();
    this.notifyUpdate();
    this.persistKit();
    return true;
  }

  public deleteVoice(voiceId: string) {
    if (this.voices.length <= 1) return; // Keep at least 1 voice

    this.voices = this.voices.filter((v) => v.id !== voiceId);

    // Unmap any keys that used this voice
    Object.keys(this.keyVoiceMap).forEach((k) => {
      if (this.keyVoiceMap[k] === voiceId) {
        delete this.keyVoiceMap[k];
      }
    });

    if (this.activeVoiceIndex >= this.voices.length) {
      this.activeVoiceIndex = 0;
    }
    this.activePaintVoiceId = this.voices[0]?.id || null;
    this.notifyPaintVoice();

    this.syncToSynthAndNotify();
    this.persistKit();
  }

  public clearAllKeyMappings() {
    this.keyVoiceMap = {};
    this.notifyUpdate();
    this.persistKit();
  }

  public async resetToDefaults() {
    await VoiceStorage.clearKit();
    this.voices = [];
    this.keyVoiceMap = {};
    await this.loadFactoryVoices();
  }

  /**
   * Persists the current voice library and key map to IndexedDB (debounced 250ms to prevent main-thread spikes).
   */
  private persistKit() {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
    }
    this.persistTimer = setTimeout(async () => {
      this.persistTimer = null;
      try {
        const serialized: SerializedVoice[] = this.voices.map((v) => ({
          id: v.id,
          name: v.name,
          color: v.color,
          rootNoteOverride: v.rootNoteOverride,
          autoPitchEnabled: v.autoPitchEnabled,
          octaveShift: v.octaveShift,
          sampleRate: v.analysis.trimmedBuffer.sampleRate,
          durationSeconds: v.analysis.durationSeconds,
          channelData: VoiceStorage.audioBufferToData(v.analysis.trimmedBuffer),
          frequencyHz: v.analysis.frequencyHz,
          detectedNote: v.analysis.detectedNote,
          detectedMidi: v.analysis.detectedMidi,
          centsCorrection: v.analysis.centsCorrection,
          confidence: v.analysis.confidence,
          waveformPeaks: v.analysis.waveformPeaks,
        }));

        await VoiceStorage.saveKit({
          voices: serialized,
          keyVoiceMap: this.keyVoiceMap,
        });
      } catch (e) {
        console.warn('[SamplerEngine] Error saving kit to storage:', e);
      }
    }, 250);
  }

  private syncToSynthAndNotify() {
    this.rebuildVoiceIndex();
    SynthEngine.getInstance().syncVoices(this.voices);
    this.notifyUpdate();
  }

  private notifyUpdate() {
    const voicesCopy = [...this.voices];
    const keyVoiceMapCopy = { ...this.keyVoiceMap };

    this.voicesListeners.forEach((listener) => {
      try {
        listener(voicesCopy, keyVoiceMapCopy);
      } catch (err) {
        console.error('[SamplerEngine] Error in voices listener:', err);
      }
    });

    const sample = this.currentSample;
    this.sampleListeners.forEach((listener) => {
      try {
        listener(sample);
      } catch (err) {
        console.error('[SamplerEngine] Error in sample listener:', err);
      }
    });
  }

  public notifyPaintVoice() {
    const activeId = this.activePaintVoiceId;
    this.paintVoiceListeners.forEach((listener) => {
      try {
        listener(activeId);
      } catch (err) {
        console.error('[SamplerEngine] Error in paint voice listener:', err);
      }
    });
  }

  // --- Microphone & Audio File Handlers ---

  public async startMicRecording(): Promise<void> {
    if (this.isRecordingMic) return;

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
    } catch {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    }

    this.recordedChunks = [];
    this.mediaRecorder = new MediaRecorder(this.mediaStream);

    this.mediaRecorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) {
        this.recordedChunks.push(ev.data);
      }
    };

    this.startInputMeter(this.mediaStream);
    this.mediaRecorder.start(100);
    this.isRecordingMic = true;
  }

  public async stopMicRecording(sampleName = 'New Voice'): Promise<RegisteredVoice | null> {
    if (!this.isRecordingMic || !this.mediaRecorder) return null;

    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = async () => {
        this.stopInputMeter();
        this.cleanupStream();
        this.isRecordingMic = false;

        try {
          if (this.recordedChunks.length === 0) {
            resolve(null);
            return;
          }
          const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
          const blob = new Blob(this.recordedChunks, { type: mimeType });
          const arrayBuf = await blob.arrayBuffer();
          const rawCtx = Tone.getContext().rawContext as AudioContext;
          const decodedBuffer = await rawCtx.decodeAudioData(arrayBuf);

          const newVoice = this.processNewAudioBuffer(decodedBuffer, sampleName);
          resolve(newVoice);
        } catch (err) {
          console.error('Failed to decode recorded mic sample:', err);
          resolve(null);
        }
      };

      this.mediaRecorder.stop();
    });
  }

  public async loadAudioFile(file: File): Promise<RegisteredVoice | null> {
    try {
      const arrayBuf = await file.arrayBuffer();
      const rawCtx = Tone.getContext().rawContext as AudioContext;
      const decodedBuffer = await rawCtx.decodeAudioData(arrayBuf);
      const cleanName = file.name.replace(/\.[^/.]+$/, '').slice(0, 24);
      return this.processNewAudioBuffer(decodedBuffer, cleanName);
    } catch (err) {
      console.error('Failed to decode audio file:', err);
      return null;
    }
  }

  public processNewAudioBuffer(rawBuffer: AudioBuffer, name: string): RegisteredVoice {
    const analysis = PitchDetector.analyzeAndPrepareBuffer(rawBuffer);
    const color = VOICE_PALETTE[this.voices.length % VOICE_PALETTE.length];
    const newVoice: RegisteredVoice = {
      id: `voice_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name,
      color,
      analysis,
      rootNoteOverride: analysis.detectedNote,
      autoPitchEnabled: true,
      octaveShift: 0,
    };

    this.voices.unshift(newVoice);
    this.activeVoiceIndex = 0;
    this.activePaintVoiceId = newVoice.id;

    this.syncToSynthAndNotify();
    this.notifyPaintVoice();
    this.persistKit();
    return newVoice;
  }

  public setAutoPitchEnabled(enabled: boolean) {
    if (!this.currentSample) return;
    this.updateVoice(this.currentSample.id, { autoPitchEnabled: enabled });
  }

  public setOctaveShift(octaveShift: -2 | -1 | 0 | 1) {
    if (!this.currentSample) return;
    this.updateVoice(this.currentSample.id, { octaveShift });
  }

  public assignCurrentSampleToDrumLane(laneId: DrumLaneId) {
    const sample = this.currentSample;
    if (!sample) return;
    DrumMachine.getInstance().setCustomLaneSample(
      laneId,
      sample.analysis.trimmedBuffer,
      sample.name
    );
  }

  public previewVoice(voiceId?: string) {
    const voice = voiceId ? this.getVoiceById(voiceId) : this.currentSample;
    if (!voice) return;
    SynthEngine.getInstance().previewVoice(voice);
  }

  public previewSample() {
    this.previewVoice();
  }

  private startInputMeter(stream: MediaStream) {
    try {
      const ctx = new AudioContext();
      this.audioCtxForMeter = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const dataArray = new Float32Array(analyser.fftSize);
      const updateMeter = () => {
        if (!this.isRecordingMic) return;
        analyser.getFloatTimeDomainData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sum / dataArray.length);
        this.micLevel = Math.min(100, Math.round(rms * 350));
        this.micLevelListeners.forEach((listener) => {
          try {
            listener(this.micLevel);
          } catch (err) {
            console.error('[SamplerEngine] Error in mic listener:', err);
          }
        });
        this.meterAnimId = requestAnimationFrame(updateMeter);
      };
      updateMeter();
    } catch {
      // ignore
    }
  }

  private stopInputMeter() {
    if (this.meterAnimId) {
      cancelAnimationFrame(this.meterAnimId);
      this.meterAnimId = null;
    }
    if (this.audioCtxForMeter) {
      this.audioCtxForMeter.close().catch(() => {});
      this.audioCtxForMeter = null;
    }
    this.micLevel = 0;
    if (this.onMicLevelChange) {
      this.onMicLevelChange(0);
    }
  }

  private cleanupStream() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((tr) => tr.stop());
      this.mediaStream = null;
    }
  }
}
