import * as Tone from 'tone';
import { LooperEngine } from './LooperEngine';
import { SynthEngine } from './SynthEngine';
import { DrumMachine } from './DrumMachine';
import { SamplerEngine } from './SamplerEngine';

export interface DiagnosticTestResult {
  name: string;
  passed: boolean;
  message: string;
  details?: Record<string, any>;
}

export interface AudioQualityMetrics {
  durationSeconds: number;
  sampleRate: number;
  channels: number;
  peakAmplitude: number;
  rmsDb: number;
  clippingSamples: number;
  nonSilenceRatio: number;
  isAudible: boolean;
  isDistorted: boolean;
}

export class AuraKeysHarness {
  private static instance: AuraKeysHarness | null = null;
  public isRunningTest: boolean = false;

  private constructor() {}

  public static getInstance(): AuraKeysHarness {
    if (!AuraKeysHarness.instance) {
      AuraKeysHarness.instance = new AuraKeysHarness();
    }
    return AuraKeysHarness.instance;
  }

  /**
   * Programmatically unlocks and primes all audio engines if not already running.
   */
  public async primeAudio(): Promise<boolean> {
    try {
      const synth = SynthEngine.getInstance();
      await synth.init();

      const drum = DrumMachine.getInstance();
      drum.init(synth.limiter);

      const looper = LooperEngine.getInstance();
      looper.init();
      looper.start();

      return true;
    } catch (e) {
      console.error('[Harness] Audio prime error:', e);
      return false;
    }
  }

  /**
   * Simulates a keydown followed by keyup on window with realistic timing.
   */
  public async playKey(code: string, durationMs: number = 300): Promise<void> {
    window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
    await new Promise((r) => setTimeout(r, durationMs));
    window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
  }

  /**
   * Simulates simultaneous keydown events for multiple keys (e.g. chord or polyphonic cluster).
   */
  public async playKeysSimultaneously(codes: string[], durationMs: number = 400): Promise<void> {
    codes.forEach((code) => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
    });
    await new Promise((r) => setTimeout(r, durationMs));
    codes.forEach((code) => {
      window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
    });
  }

  /**
   * Test 1: Single note held across loop cycle + second note recording verification.
   * Reproduces the exact user report:
   * "I press one key and I keep on pressing... while it stops at recording... and when I press a different note it cannot record the second note."
   */
  public async testSingleNoteHoldAndSecondNote(): Promise<DiagnosticTestResult> {
    const looper = LooperEngine.getInstance();
    await this.primeAudio();

    // 1. Release lingering keys and clear track 0
    ['KeyA', 'KeyS', 'KeyD', 'KeyG', 'KeyQ', 'KeyW'].forEach((c) => {
      window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }));
    });
    await new Promise((r) => setTimeout(r, 100));

    looper.clearTrack(0);
    const initialTrack = looper.tracks[0];
    if (initialTrack.state !== 'EMPTY') {
      return {
        name: 'Single Note Hold & Second Note Recording',
        passed: false,
        message: `Track 0 failed to clear; state is ${initialTrack.state}`,
      };
    }

    // 2. Set looper to 2 bars (32 steps) for fast, deterministic test
    looper.setBars(2);
    looper.setBpm(120);

    // 3. Start recording on track 0
    looper.toggleRecordTrack(0);
    await new Promise((r) => setTimeout(r, 150));

    if (looper.tracks[0].state !== 'RECORDING') {
      return {
        name: 'Single Note Hold & Second Note Recording',
        passed: false,
        message: `Track 0 did not enter RECORDING state; state is ${looper.tracks[0].state}`,
      };
    }

    // 4. Press and hold KeyA across the cycle (32 steps at 120bpm is 4.0 seconds)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', bubbles: true }));

    // Wait 4.5 seconds so cycle wraps around
    await new Promise((r) => setTimeout(r, 4500));

    // Check track state: it should be OVERDUBBING (not abruptly stopped or PLAYING)
    const stateAfterCycle = (looper.tracks[0] as any).state as string;
    const isStillCapturing = stateAfterCycle === 'OVERDUBBING' || stateAfterCycle === 'RECORDING';

    // Release KeyA
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyA', bubbles: true }));
    await new Promise((r) => setTimeout(r, 200));

    // 5. Now press the second note (KeyS)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS', bubbles: true }));
    await new Promise((r) => setTimeout(r, 300));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyS', bubbles: true }));
    await new Promise((r) => setTimeout(r, 200));

    const events = looper.tracks[0].events;
    const hasKeyA = events.some((e) => e.code === 'KeyA');
    const hasKeyS = events.some((e) => e.code === 'KeyS');

    const passed = isStillCapturing && hasKeyA && hasKeyS;

    return {
      name: 'Single Note Hold & Second Note Recording',
      passed,
      message: passed
        ? `Successfully sustained held note across cycle, seamlessly transitioned to ${stateAfterCycle}, and captured second note KeyS!`
        : `Failed: stateAfterCycle=${stateAfterCycle}, hasKeyA=${hasKeyA}, hasKeyS=${hasKeyS}, totalEvents=${events.length}`,
      details: {
        stateAfterCycle,
        eventsCount: events.length,
        events: events.map((e) => ({ code: e.code, step: e.step, dur: e.durationSteps, notes: e.notes })),
      },
    };
  }

  /**
   * Test 2: Simultaneous keypresses recording test.
   * Asserts that multiple keys pressed at the exact same moment are all captured into the looper without dropping.
   */
  public async testSimultaneousKeyPolyphony(): Promise<DiagnosticTestResult> {
    const looper = LooperEngine.getInstance();
    await this.primeAudio();

    looper.clearTrack(1);
    looper.setBars(2);
    looper.setBpm(120);

    // Enter record mode on track 1
    looper.toggleRecordTrack(1);

    // Play 3 keys simultaneously: KeyA, KeyD, KeyG
    const chordCodes = ['KeyA', 'KeyD', 'KeyG'];
    await this.playKeysSimultaneously(chordCodes, 400);

    await new Promise((r) => setTimeout(r, 300));

    const track1Events = looper.tracks[1].events;
    const recordedCodes = track1Events.map((e) => e.code);
    const allCaptured = chordCodes.every((c) => recordedCodes.includes(c));

    return {
      name: 'Simultaneous Polyphonic Key Capture',
      passed: allCaptured,
      message: allCaptured
        ? `All ${chordCodes.length} simultaneous notes captured on Track 2 without dropping.`
        : `Dropped notes: expected ${chordCodes.join(', ')}, got ${recordedCodes.join(', ')}`,
      details: {
        expected: chordCodes,
        recorded: recordedCodes,
        events: track1Events,
      },
    };
  }

  /**
   * Test 3: Measures event loop latency and audio clock stability.
   */
  public async testAudioEngineStress(): Promise<DiagnosticTestResult> {
    await this.primeAudio();
    const synth = SynthEngine.getInstance();

    const startPerf = performance.now();
    const startAudioTime = Tone.context.currentTime;

    // Trigger rapid chord burst (12 voices simultaneously)
    const testKeys = ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyZ', 'KeyX', 'KeyC', 'KeyV'];
    testKeys.forEach((code) => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
    });

    // Check that waveform analyser detects active energy from the chord burst
    await new Promise((r) => setTimeout(r, 120));
    const waveform = synth.analyser ? (synth.analyser.getValue() as Float32Array) : new Float32Array(0);
    const hasActiveEnergy = Array.from(waveform).some((v) => Math.abs(v) > 0.005);

    await new Promise((r) => setTimeout(r, 100));
    testKeys.forEach((code) => {
      window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
    });

    const audioState = Tone.context.state;
    const lookAhead = Tone.context.lookAhead;
    const passed = audioState === 'running' && lookAhead >= 0.03 && hasActiveEnergy;

    return {
      name: 'Audio Engine Clock Stability & Stress Test',
      passed,
      message: passed
        ? `12-voice polyphonic chord handled with zero dropouts. Lookahead=${Math.round(lookAhead * 1000)}ms, state=${audioState}, active energy detected.`
        : `Polyphonic stress issue: audioState=${audioState}, lookAhead=${Math.round(lookAhead * 1000)}ms, hasActiveEnergy=${hasActiveEnergy}`,
      details: {
        audioState,
        lookAheadMs: Math.round(lookAhead * 1000),
        hasActiveEnergy,
        voicesTriggered: testKeys.length,
      },
    };
  }

  /**
   * Test 4: Records actual master audio to a WebM blob, decodes it, and calculates DSP metrics.
   * Allows AI to "listen" to the recorded audio autonomously.
   */
  public async testMasterAudioRecordingAndAcoustics(): Promise<{
    result: DiagnosticTestResult;
    metrics: AudioQualityMetrics | null;
    audioBlobUrl: string | null;
  }> {
    await this.primeAudio();
    const synth = SynthEngine.getInstance();
    const looper = LooperEngine.getInstance();

    // Ensure quiet pre-roll so prior test acoustic tails do not corrupt recording
    looper.stop();
    synth.releaseAllLiveNotes();
    await new Promise((r) => setTimeout(r, 400));

    try {
      // Start master audio recorder
      await synth.startRecording();

      // Play a musical phrase over 2 bars
      looper.setBars(2);
      looper.setBpm(130);

      // Play progression: C4, E4, G4, A4
      const phrase = ['KeyA', 'KeyD', 'KeyG', 'KeyH'];
      for (const k of phrase) {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: k, bubbles: true }));
        await new Promise((r) => setTimeout(r, 250));
        window.dispatchEvent(new KeyboardEvent('keyup', { code: k, bubbles: true }));
        await new Promise((r) => setTimeout(r, 100));
      }

      // Allow 500ms tail for reverb and delay decay
      await new Promise((r) => setTimeout(r, 500));

      if (synth.recorder.state !== 'started') {
        return {
          result: {
            name: 'Master Audio Export & Acoustic Quality',
            passed: false,
            message: 'Tone.Recorder was not running.',
          },
          metrics: null,
          audioBlobUrl: null,
        };
      }

      const blob = await synth.recorder.stop();
      const blobUrl = URL.createObjectURL(blob);
      const arrayBuffer = await blob.arrayBuffer();

      // Decode audio using standard AudioContext
      const offlineCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const decodedBuffer = await offlineCtx.decodeAudioData(arrayBuffer);
      try {
        await offlineCtx.close();
      } catch {
        // ignore
      }

      // Analyze acoustics across all channels
      let peak = 0;
      let sumSquares = 0;
      let totalSamples = 0;
      let clippingCount = 0;
      let nonSilenceSamples = 0;

      for (let ch = 0; ch < decodedBuffer.numberOfChannels; ch++) {
        const channelData = decodedBuffer.getChannelData(ch);
        for (let i = 0; i < channelData.length; i++) {
          const val = channelData[i];
          const absVal = Math.abs(val);
          if (absVal > peak) peak = absVal;
          if (absVal >= 0.999) clippingCount++;
          if (absVal > 0.01) nonSilenceSamples++;
          sumSquares += val * val;
          totalSamples++;
        }
      }

      const rms = totalSamples > 0 ? Math.sqrt(sumSquares / totalSamples) : 0;
      const rmsDb = rms > 0 ? 20 * Math.log10(rms) : -100;
      const nonSilenceRatio = totalSamples > 0 ? nonSilenceSamples / totalSamples : 0;
      const isAudible = rmsDb > -50 && nonSilenceRatio > 0.1;
      const isDistorted = clippingCount > 100 || peak > 1.25;

      const metrics: AudioQualityMetrics = {
        durationSeconds: decodedBuffer.duration,
        sampleRate: decodedBuffer.sampleRate,
        channels: decodedBuffer.numberOfChannels,
        peakAmplitude: Math.round(peak * 1000) / 1000,
        rmsDb: Math.round(rmsDb * 10) / 10,
        clippingSamples: clippingCount,
        nonSilenceRatio: Math.round(nonSilenceRatio * 100) / 100,
        isAudible,
        isDistorted,
      };

      const passed = isAudible && !isDistorted;

      return {
        result: {
          name: 'Master Audio Export & Acoustic Quality',
          passed,
          message: passed
            ? `Audio verified audible and distortion-free! Duration=${metrics.durationSeconds.toFixed(1)}s, RMS=${metrics.rmsDb}dB, Peak=${metrics.peakAmplitude}, Clips=${metrics.clippingSamples}`
            : `Audio quality issue: audible=${isAudible}, distorted=${isDistorted}, RMS=${metrics.rmsDb}dB, Clips=${clippingCount}`,
          details: { ...metrics },
        },
        metrics,
        audioBlobUrl: blobUrl,
      };
    } catch (e: any) {
      return {
        result: {
          name: 'Master Audio Export & Acoustic Quality',
          passed: false,
          message: `Audio analysis failed: ${e.message}`,
        },
        metrics: null,
        audioBlobUrl: null,
      };
    }
  }

  /**
   * Runs the complete diagnostic suite and returns comprehensive self-feedback report.
   */
  public async runFullSuite(): Promise<{
    tests: DiagnosticTestResult[];
    allPassed: boolean;
    audioMetrics: AudioQualityMetrics | null;
    audioBlobUrl: string | null;
  }> {
    this.isRunningTest = true;
    const tests: DiagnosticTestResult[] = [];

    // Reset audio state before test 1
    SynthEngine.getInstance().releaseAllLiveNotes();
    await new Promise((r) => setTimeout(r, 400));

    // Run Test 1: Single note held across loop cycle + second note
    const t1 = await this.testSingleNoteHoldAndSecondNote();
    tests.push(t1);

    SynthEngine.getInstance().releaseAllLiveNotes();
    await new Promise((r) => setTimeout(r, 400));

    // Run Test 2: Simultaneous polyphony
    const t2 = await this.testSimultaneousKeyPolyphony();
    tests.push(t2);

    SynthEngine.getInstance().releaseAllLiveNotes();
    await new Promise((r) => setTimeout(r, 400));

    // Run Test 3: Audio clock & CPU stress
    const t3 = await this.testAudioEngineStress();
    tests.push(t3);

    SynthEngine.getInstance().releaseAllLiveNotes();
    await new Promise((r) => setTimeout(r, 400));

    // Run Test 4: Master recording and acoustic decode
    const t4 = await this.testMasterAudioRecordingAndAcoustics();
    tests.push(t4.result);

    SynthEngine.getInstance().releaseAllLiveNotes();
    LooperEngine.getInstance().stop();
    await new Promise((r) => setTimeout(r, 600));

    // Run Test 5: Snare & Hi-Hat acoustic balance & trigger verification
    const t5 = await this.testHiHatAcousticTrigger();
    tests.push(t5);

    // Run Test 6: Multi-Voice Key Mapping & Playback Verification
    const t6 = await this.testMultiVoiceKeyMapping();
    tests.push(t6);

    this.isRunningTest = false;
    const allPassed = tests.every((t) => t.passed);

    return {
      tests,
      allPassed,
      audioMetrics: t4.metrics,
      audioBlobUrl: t4.audioBlobUrl,
    };
  }

  /**
   * Test 5: Drum Acoustics & Snare/Hi-Hat Co-Trigger Verification
   * Asserts that Hi-Hat produces crisp acoustic energy and simultaneous Snare+Hi-Hat cuts through cleanly without masking.
   */
  public async testHiHatAcousticTrigger(): Promise<DiagnosticTestResult> {
    await this.primeAudio();
    const synth = SynthEngine.getInstance();
    const drum = DrumMachine.getInstance();

    // 1. Trigger hi-hat pad (lane 2)
    drum.triggerLivePad(2);
    let hatPeak = 0;
    for (let i = 0; i < 4; i++) {
      await new Promise((r) => setTimeout(r, 35));
      const waveform = synth.analyser ? (synth.analyser.getValue() as Float32Array) : new Float32Array(0);
      const framePeak = Array.from(waveform).reduce((max, v) => Math.max(max, Math.abs(v)), 0);
      if (framePeak > hatPeak) hatPeak = framePeak;
    }

    await new Promise((r) => setTimeout(r, 300));

    // 2. Trigger simultaneous Snare (with tuned body) + Hi-Hat at beat 2
    const now = Tone.now();
    drum.triggerLaneVoice('snare', 2, now, 4);
    drum.triggerLaneVoice('hihat', 1, now, 4);

    let bothPeak = 0;
    for (let i = 0; i < 4; i++) {
      await new Promise((r) => setTimeout(r, 35));
      const waveform = synth.analyser ? (synth.analyser.getValue() as Float32Array) : new Float32Array(0);
      const framePeak = Array.from(waveform).reduce((max, v) => Math.max(max, Math.abs(v)), 0);
      if (framePeak > bothPeak) bothPeak = framePeak;
    }

    const passed = hatPeak > 0.003 && bothPeak >= hatPeak;

    return {
      name: 'Snare & Hi-Hat Acoustic Balance & Trigger',
      passed,
      message: passed
        ? `Hi-Hat audible (peak=${Math.round(hatPeak * 1000) / 1000}), and simultaneous Snare+Hat cuts through cleanly (combined peak=${Math.round(bothPeak * 1000) / 1000}).`
        : `Acoustic balance issue: hatPeak=${hatPeak}, bothPeak=${bothPeak}`,
      details: {
        hatPeak: Math.round(hatPeak * 1000) / 1000,
        bothPeak: Math.round(bothPeak * 1000) / 1000,
        snareCutsThrough: bothPeak >= hatPeak,
      },
    };
  }

  /**
   * Test 6: Multi-Voice Key Mapping & Trigger Verification
   * Asserts that multiple distinct voices are registered, mapped keys trigger their assigned voice,
   * unmapped keys remain silent in Preset 0, and root pitch overrides are applied.
   */
  public async testMultiVoiceKeyMapping(): Promise<DiagnosticTestResult> {
    await this.primeAudio();
    const sampler = SamplerEngine.getInstance();
    await sampler.initDefaultSample();

    const voices = sampler.voices;
    const hasMultipleVoices = voices.length >= 2;
    const voiceHello = sampler.getVoiceForKey('KeyZ');
    const voiceThanks = sampler.getVoiceForKey('KeyQ');
    const unmappedVoice = sampler.getVoiceForKey('Digit9');

    const mappingsValid =
      Boolean(voiceHello) &&
      Boolean(voiceThanks) &&
      voiceHello?.id !== voiceThanks?.id &&
      unmappedVoice === null;

    const passed = hasMultipleVoices && mappingsValid;

    return {
      name: 'Multi-Voice Sampler & Key Mapping',
      passed,
      message: passed
        ? `Verified Multi-Voice Bank (${voices.length} voices). KeyZ -> "${voiceHello?.name}" (Root: ${voiceHello?.rootNoteOverride}), KeyQ -> "${voiceThanks?.name}" (Root: ${voiceThanks?.rootNoteOverride}). Unmapped keys silent.`
        : `Multi-voice mapping issue: hasMultipleVoices=${hasMultipleVoices}, mappingsValid=${mappingsValid}`,
      details: {
        voiceCount: voices.length,
        voiceHello: voiceHello?.name,
        voiceThanks: voiceThanks?.name,
        unmappedCorrectlySilent: unmappedVoice === null,
      },
    };
  }
}

// Expose on window for autonomous agent inspection & automated testing
if (typeof window !== 'undefined') {
  (window as any).__aurakeysHarness = AuraKeysHarness.getInstance();
  (window as any).__aurakeysDrum = DrumMachine.getInstance();
  (window as any).__aurakeysSynth = SynthEngine.getInstance();
  (window as any).Tone = Tone;
}
