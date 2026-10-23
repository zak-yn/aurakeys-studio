/**
 * IndexedDB Persistence for AuraKeys Studio Registered Voices & Key Mappings.
 * Serializes raw AudioBuffer channel data as Float32Array into IndexedDB
 * so custom recorded/uploaded voices survive browser refreshes.
 */

export interface SerializedVoice {
  id: string;
  name: string;
  color: string;
  rootNoteOverride?: string;
  autoPitchEnabled: boolean;
  octaveShift: -2 | -1 | 0 | 1;
  // AudioBuffer serialization
  sampleRate: number;
  durationSeconds: number;
  channelData: Float32Array | number[]; // Float32 samples stored directly for IDB structured cloning
  // Pitch analysis metadata
  frequencyHz: number;
  detectedNote: string;
  detectedMidi: number;
  centsCorrection: number;
  confidence: number;
  waveformPeaks: number[];
}

export interface VoiceStorageData {
  voices: SerializedVoice[];
  keyVoiceMap: Record<string, string>; // QWERTY code -> voiceId
}

const DB_NAME = 'aurakeys_studio_db';
const DB_VERSION = 1;
const STORE_NAME = 'voice_store';
const STORAGE_KEY = 'user_voice_kit';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export class VoiceStorage {
  /**
   * Loads saved voices and key mappings from IndexedDB.
   */
  public static async loadKit(): Promise<VoiceStorageData | null> {
    try {
      const db = await openDatabase();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(STORAGE_KEY);

        req.onsuccess = () => {
          resolve((req.result as VoiceStorageData) || null);
        };
        req.onerror = () => {
          console.warn('[VoiceStorage] Failed to read from IndexedDB', req.error);
          resolve(null);
        };
      });
    } catch (e) {
      console.warn('[VoiceStorage] Error opening database:', e);
      return null;
    }
  }

  /**
   * Persists voices and key mappings to IndexedDB.
   */
  public static async saveKit(data: VoiceStorageData): Promise<boolean> {
    try {
      const db = await openDatabase();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(data, STORAGE_KEY);

        req.onsuccess = () => resolve(true);
        req.onerror = () => {
          console.warn('[VoiceStorage] Failed to save to IndexedDB', req.error);
          resolve(false);
        };
      });
    } catch (e) {
      console.warn('[VoiceStorage] Error saving to IndexedDB:', e);
      return false;
    }
  }

  /**
   * Clears saved voice kit from IndexedDB.
   */
  public static async clearKit(): Promise<void> {
    try {
      const db = await openDatabase();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(STORAGE_KEY);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      });
    } catch {
      // ignore
    }
  }

  /**
   * Converts a Web Audio AudioBuffer into a serializable Float32Array.
   * Compresses by taking the first channel.
   */
  public static audioBufferToData(buffer: AudioBuffer): Float32Array {
    return new Float32Array(buffer.getChannelData(0));
  }

  /**
   * Reconstitutes an AudioBuffer from serialized channel data.
   */
  public static dataToAudioBuffer(
    audioCtx: AudioContext,
    channelData: Float32Array | number[],
    sampleRate: number
  ): AudioBuffer {
    const length = channelData.length;
    const buffer = audioCtx.createBuffer(1, length, sampleRate);
    const floatArr = channelData instanceof Float32Array ? channelData : new Float32Array(channelData);
    buffer.getChannelData(0).set(floatArr);
    return buffer;
  }
}
