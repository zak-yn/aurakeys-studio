import * as Tone from 'tone';

export interface PitchAnalysisResult {
  isTonal: boolean;
  frequencyHz: number;
  detectedNote: string;    // e.g. "A3"
  detectedMidi: number;    // e.g. 57
  centsCorrection: number; // e.g. +14 cents to lock to 440Hz grid
  confidence: number;      // 0.0 to 1.0
  durationSeconds: number;
  trimmedBuffer: AudioBuffer;
  waveformPeaks: number[]; // Normalized 64-bar preview peaks
}

export class PitchDetector {
  /**
   * Trims leading silence, normalizes peak gain, detects fundamental pitch (f0)
   * via Normalized Square Difference Function (NSDF / McLeod Autocorrelation),
   * and computes the nearest MIDI note + fine cents correction.
   */
  public static analyzeAndPrepareBuffer(rawBuffer: AudioBuffer): PitchAnalysisResult {
    const trimmedBuffer = this.trimAndNormalize(rawBuffer);
    const { frequencyHz, confidence } = this.detectFundamental(trimmedBuffer);
    const waveformPeaks = this.computeWaveformPeaks(trimmedBuffer, 64);
    const durationSeconds = Math.round(trimmedBuffer.duration * 100) / 100;

    // Unpitched / percussive sound (clap, tap, rim, shaker) -> anchor at C4 with 0 detune
    if (confidence < 0.72 || frequencyHz < 55 || frequencyHz > 1200) {
      return {
        isTonal: false,
        frequencyHz: 261.63,
        detectedNote: 'C4',
        detectedMidi: 60,
        centsCorrection: 0,
        confidence: Math.round(confidence * 100) / 100,
        durationSeconds,
        trimmedBuffer,
        waveformPeaks,
      };
    }

    const midiExact = 69 + 12 * Math.log2(frequencyHz / 440);
    const detectedMidi = Math.round(midiExact);
    const centsCorrection = Math.round((detectedMidi - midiExact) * 100);
    const detectedNote = Tone.Frequency(detectedMidi, 'midi').toNote();

    return {
      isTonal: true,
      frequencyHz: Math.round(frequencyHz * 10) / 10,
      detectedNote,
      detectedMidi,
      centsCorrection,
      confidence: Math.round(confidence * 100) / 100,
      durationSeconds,
      trimmedBuffer,
      waveformPeaks,
    };
  }

  /**
   * Removes leading/trailing silence above threshold (-32dB) and normalizes peak to 0.90.
   */
  public static trimAndNormalize(buffer: AudioBuffer, threshold = 0.025): AudioBuffer {
    const ctx = Tone.getContext().rawContext as AudioContext;
    const sampleRate = buffer.sampleRate;
    const rawData = buffer.getChannelData(0);

    // 1. Find onset
    let startIdx = 0;
    for (let i = 0; i < rawData.length; i++) {
      if (Math.abs(rawData[i]) >= threshold) {
        startIdx = Math.max(0, i - Math.floor(sampleRate * 0.005));
        break;
      }
    }

    // 2. Find tail end (above half threshold)
    let endIdx = rawData.length - 1;
    for (let i = rawData.length - 1; i > startIdx + Math.floor(sampleRate * 0.1); i--) {
      if (Math.abs(rawData[i]) >= threshold * 0.4) {
        endIdx = Math.min(rawData.length - 1, i + Math.floor(sampleRate * 0.02));
        break;
      }
    }

    // Cap sample length between 0.1s and 4.0s
    const maxSamples = Math.min(endIdx - startIdx + 1, sampleRate * 4);
    const length = Math.max(Math.floor(sampleRate * 0.1), maxSamples);
    const trimmed = ctx.createBuffer(1, length, sampleRate);
    const out = trimmed.getChannelData(0);

    let peak = 0;
    for (let i = 0; i < length; i++) {
      const val = rawData[startIdx + i] || 0;
      if (Math.abs(val) > peak) peak = Math.abs(val);
    }

    const gain = peak > 0.01 ? 0.9 / peak : 1.0;
    const fadeInSamples = Math.floor(sampleRate * 0.002);
    const fadeOutSamples = Math.floor(sampleRate * 0.015);

    for (let i = 0; i < length; i++) {
      let env = 1.0;
      if (i < fadeInSamples) {
        env = i / fadeInSamples;
      } else if (i > length - fadeOutSamples) {
        env = (length - i) / fadeOutSamples;
      }
      out[i] = (rawData[startIdx + i] || 0) * gain * env;
    }

    return trimmed;
  }

  /**
   * Time-domain Normalized Square Difference Function (NSDF) pitch detector
   * with parabolic peak interpolation for sub-sample frequency precision.
   */
  private static detectFundamental(buffer: AudioBuffer): { frequencyHz: number; confidence: number } {
    const data = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;
    const windowSize = Math.min(2048, data.length);
    // Sample 40ms into the note body to skip noisy attack transient
    const offset = Math.min(Math.floor(sampleRate * 0.04), Math.max(0, data.length - windowSize));

    const minLag = Math.floor(sampleRate / 1100); // ~1100 Hz max
    const maxLag = Math.min(Math.floor(sampleRate / 60), Math.floor(windowSize / 2)); // ~60 Hz min

    if (maxLag <= minLag) {
      return { frequencyHz: 261.63, confidence: 0 };
    }

    const nsdf = new Float32Array(maxLag + 1);
    for (let lag = minLag; lag <= maxLag; lag++) {
      let num = 0;
      let den = 0;
      for (let i = 0; i < windowSize - lag; i++) {
        const s1 = data[offset + i];
        const s2 = data[offset + i + lag];
        num += 2 * s1 * s2;
        den += s1 * s1 + s2 * s2;
      }
      nsdf[lag] = den > 0 ? num / den : 0;
    }

    // Find global maximum peak
    let globalMax = 0;
    for (let lag = minLag; lag <= maxLag; lag++) {
      if (nsdf[lag] > globalMax) globalMax = nsdf[lag];
    }

    if (globalMax <= 0) {
      return { frequencyHz: 261.63, confidence: 0 };
    }

    // Pick first local peak >= 85% of globalMax (avoids octave/subharmonic errors)
    const keyThreshold = globalMax * 0.85;
    let bestLag = -1;
    let bestCorr = 0;

    for (let lag = minLag + 1; lag < maxLag; lag++) {
      if (nsdf[lag] >= keyThreshold && nsdf[lag] >= nsdf[lag - 1] && nsdf[lag] >= nsdf[lag + 1]) {
        bestLag = lag;
        bestCorr = nsdf[lag];
        break;
      }
    }

    if (bestLag === -1) {
      for (let lag = minLag; lag <= maxLag; lag++) {
        if (nsdf[lag] > bestCorr) {
          bestCorr = nsdf[lag];
          bestLag = lag;
        }
      }
    }

    if (bestLag <= 0) return { frequencyHz: 261.63, confidence: 0 };

    // Parabolic interpolation for sub-sample precision
    let refinedLag = bestLag;
    if (bestLag > minLag && bestLag < maxLag) {
      const y1 = nsdf[bestLag - 1];
      const y2 = nsdf[bestLag];
      const y3 = nsdf[bestLag + 1];
      const denom = y1 - 2 * y2 + y3;
      if (Math.abs(denom) > 1e-6) {
        refinedLag = bestLag + (0.5 * (y1 - y3)) / denom;
      }
    }

    return {
      frequencyHz: sampleRate / refinedLag,
      confidence: bestCorr,
    };
  }

  public static computeWaveformPeaks(buffer: AudioBuffer, barsCount = 64): number[] {
    const data = buffer.getChannelData(0);
    const step = Math.max(1, Math.floor(data.length / barsCount));
    const peaks: number[] = [];

    for (let i = 0; i < barsCount; i++) {
      let max = 0;
      const start = i * step;
      const end = Math.min(data.length, start + step);
      for (let j = start; j < end; j++) {
        const v = Math.abs(data[j]);
        if (v > max) max = v;
      }
      peaks.push(Math.min(1, Math.max(0.06, max)));
    }
    return peaks;
  }
}
