/**
 * Tests for the web-audio renderer's sequence-level scheduling
 * (scheduleSequence and renderOffline).
 *
 * Split from renderer.test.ts to keep each file under the max-lines cap.
 * Uses the same explicitly-typed fake AudioContext mocks (typed as *Like
 * interfaces) to assert scheduling math without a real browser environment.
 */

import { describe, it, expect } from 'bun:test';
import { Note } from '../note.js';
import { Chord } from '../chord.js';
import { Sequence, musicalTime } from '../sequences/sequence.js';
import { createWebAudioRenderer } from './renderer.js';
import type {
  AudioContextLike,
  AudioNodeLike,
  AudioParamLike,
  GainNodeLike,
  OscillatorNodeLike,
  OfflineAudioContextLike,
} from './types.js';

// ---------------------------------------------------------------------------
// Fake builders (duplicated from renderer.test.ts — the repo splits large test
// suites into sibling files that each carry their own setup, rather than
// extracting a shared helper module).
// ---------------------------------------------------------------------------

type RecordedVoice = {
  frequency: number;
  startTime: number;
  stopTime: number;
  gainSchedule: Array<{ method: string; value: number; time: number }>;
};

function buildFakeParam(): AudioParamLike {
  let val = 0;
  return {
    get value(): number {
      return val;
    },
    set value(v: number) {
      val = v;
    },
    setValueAtTime(v: number, _t: number): unknown {
      val = v;
      return undefined;
    },
    linearRampToValueAtTime(v: number, _t: number): unknown {
      val = v;
      return undefined;
    },
  };
}

function buildFakeAudioContext(currentTime = 0): {
  ctx: AudioContextLike;
  voices: RecordedVoice[];
} {
  const voices: RecordedVoice[] = [];

  const destination: AudioNodeLike = {
    connect(_node: AudioNodeLike): unknown {
      return undefined;
    },
  };

  const ctx: AudioContextLike = {
    get currentTime(): number {
      return currentTime;
    },
    createOscillator(): OscillatorNodeLike {
      const freqParam = buildFakeParam();
      const voice: RecordedVoice = { frequency: 0, startTime: 0, stopTime: 0, gainSchedule: [] };
      voices.push(voice);
      const osc: OscillatorNodeLike = {
        type: 'sine',
        frequency: {
          get value(): number {
            return freqParam.value;
          },
          set value(v: number) {
            freqParam.value = v;
          },
          setValueAtTime(v: number, t: number): unknown {
            voice.frequency = v;
            return freqParam.setValueAtTime(v, t);
          },
          linearRampToValueAtTime(v: number, t: number): unknown {
            return freqParam.linearRampToValueAtTime(v, t);
          },
        },
        connect(_node: AudioNodeLike): unknown {
          return undefined;
        },
        start(when: number): void {
          voice.startTime = when;
        },
        stop(when: number): void {
          voice.stopTime = when;
        },
      };
      return osc;
    },
    createGain(): GainNodeLike {
      const gain: GainNodeLike = {
        gain: {
          value: 1,
          setValueAtTime(v: number, t: number): unknown {
            voices[voices.length - 1]?.gainSchedule.push({ method: 'set', value: v, time: t });
            return undefined;
          },
          linearRampToValueAtTime(v: number, t: number): unknown {
            voices[voices.length - 1]?.gainSchedule.push({ method: 'ramp', value: v, time: t });
            return undefined;
          },
        },
        connect(_node: AudioNodeLike): unknown {
          return undefined;
        },
      };
      return gain;
    },
    destination,
  };

  return { ctx, voices };
}

function buildFakeOfflineContext(currentTime = 0): {
  ctx: OfflineAudioContextLike;
  voices: RecordedVoice[];
  renderingPromise: Promise<unknown>;
} {
  const { ctx: baseCtx, voices } = buildFakeAudioContext(currentTime);
  const renderingPromise = Promise.resolve({ sampleRate: 44100 });
  const ctx: OfflineAudioContextLike = {
    get currentTime(): number {
      return baseCtx.currentTime;
    },
    createOscillator(): OscillatorNodeLike {
      return baseCtx.createOscillator();
    },
    createGain(): GainNodeLike {
      return baseCtx.createGain();
    },
    get destination(): AudioNodeLike {
      return baseCtx.destination;
    },
    startRendering(): Promise<unknown> {
      return renderingPromise;
    },
  };
  return { ctx, voices, renderingPromise };
}

// ---------------------------------------------------------------------------
// scheduleSequence
// ---------------------------------------------------------------------------

describe('scheduleSequence', () => {
  it('schedules note and chord events; skips rests', () => {
    const chord = Chord.create('G4', 'major');
    const seq = Sequence.create(
      [
        {
          type: 'note',
          note: Note.create('C4'),
          start: musicalTime(0, 1),
          duration: musicalTime(1, 4),
        },
        { type: 'chord', chord, start: musicalTime(1, 4), duration: musicalTime(1, 4) },
        { type: 'rest', start: musicalTime(1, 2), duration: musicalTime(1, 4) },
      ],
      { tempo: 60 },
    );
    const { ctx, voices } = buildFakeAudioContext(0);
    createWebAudioRenderer({ audioContext: ctx }).scheduleSequence(seq);
    expect(voices).toHaveLength(1 + chord.notes.length);
  });

  it('anchors at currentTime + startTime', () => {
    const seq = Sequence.create(
      [
        {
          type: 'note',
          note: Note.create('C4'),
          start: musicalTime(0, 1),
          duration: musicalTime(1, 4),
        },
      ],
      { tempo: 60 },
    );
    const { ctx, voices } = buildFakeAudioContext(5);
    createWebAudioRenderer({ audioContext: ctx }).scheduleSequence(seq, { startTime: 2 });
    const ev = seq.toAbsoluteSeconds()[0];
    const voice = voices[0];
    expect(ev).toBeDefined();
    expect(voice).toBeDefined();
    if (ev === undefined || voice === undefined) return;
    expect(voice.startTime).toBeCloseTo(5 + 2 + ev.startSeconds, 5);
    expect(voice.stopTime).toBeCloseTo(5 + 2 + ev.startSeconds + ev.durationSeconds, 5);
  });

  it('defaults startTime to 0 when absent', () => {
    const seq = Sequence.create(
      [
        {
          type: 'note',
          note: Note.create('C4'),
          start: musicalTime(0, 1),
          duration: musicalTime(1, 4),
        },
      ],
      { tempo: 60 },
    );
    const { ctx, voices } = buildFakeAudioContext(3);
    createWebAudioRenderer({ audioContext: ctx }).scheduleSequence(seq);
    const ev = seq.toAbsoluteSeconds()[0];
    const voice = voices[0];
    if (ev === undefined || voice === undefined) return;
    expect(voice.startTime).toBeCloseTo(3 + ev.startSeconds, 5);
  });

  it('throws RangeError when note event has velocity=0', () => {
    const seq = Sequence.create(
      [
        {
          type: 'note',
          note: Note.create('C4'),
          start: musicalTime(0, 1),
          duration: musicalTime(1, 4),
          velocity: 0,
        },
      ],
      { tempo: 60 },
    );
    const { ctx } = buildFakeAudioContext(0);
    expect(() => createWebAudioRenderer({ audioContext: ctx }).scheduleSequence(seq)).toThrow(
      RangeError,
    );
  });

  it('throws RangeError when chord event has velocity=0', () => {
    const seq = Sequence.create(
      [
        {
          type: 'chord',
          chord: Chord.create('C4', 'major'),
          start: musicalTime(0, 1),
          duration: musicalTime(1, 4),
          velocity: 0,
        },
      ],
      { tempo: 60 },
    );
    const { ctx } = buildFakeAudioContext(0);
    expect(() => createWebAudioRenderer({ audioContext: ctx }).scheduleSequence(seq)).toThrow(
      RangeError,
    );
  });

  it('explicit velocity=127 produces gain peak ≈ 1', () => {
    const seq = Sequence.create(
      [
        {
          type: 'note',
          note: Note.create('C4'),
          start: musicalTime(0, 1),
          duration: musicalTime(1, 4),
          velocity: 127,
        },
      ],
      { tempo: 60 },
    );
    const { ctx, voices } = buildFakeAudioContext(0);
    createWebAudioRenderer({ audioContext: ctx }).scheduleSequence(seq);
    const peak = voices[0]?.gainSchedule.find((e) => e.method === 'ramp' && e.value > 0);
    expect(peak).toBeDefined();
    if (peak === undefined) return;
    expect(peak.value).toBeCloseTo(1, 5);
  });
});

// ---------------------------------------------------------------------------
// renderOffline
// ---------------------------------------------------------------------------

describe('renderOffline', () => {
  it('schedules on offline context and returns startRendering promise', async () => {
    const seq = Sequence.create(
      [
        {
          type: 'note',
          note: Note.create('C4'),
          start: musicalTime(0, 1),
          duration: musicalTime(1, 4),
        },
      ],
      { tempo: 60 },
    );
    const { ctx: offlineCtx, voices, renderingPromise } = buildFakeOfflineContext(0);
    const { ctx: liveCtx } = buildFakeAudioContext(0);
    const result = createWebAudioRenderer({ audioContext: liveCtx }).renderOffline(seq, {
      offlineContext: offlineCtx,
    });
    expect(voices).toHaveLength(1);
    expect(result).toBe(renderingPromise);
    await expect(result).resolves.toBeDefined();
  });

  it('anchors at offlineContext.currentTime', () => {
    const seq = Sequence.create(
      [
        {
          type: 'note',
          note: Note.create('C4'),
          start: musicalTime(0, 1),
          duration: musicalTime(1, 4),
        },
      ],
      { tempo: 60 },
    );
    const { ctx: offlineCtx, voices } = buildFakeOfflineContext(0);
    const { ctx: liveCtx } = buildFakeAudioContext(0);
    createWebAudioRenderer({ audioContext: liveCtx }).renderOffline(seq, {
      offlineContext: offlineCtx,
    });
    const ev = seq.toAbsoluteSeconds()[0];
    const voice = voices[0];
    if (ev === undefined || voice === undefined) return;
    expect(voice.startTime).toBeCloseTo(ev.startSeconds, 5);
  });

  it('skips rests in offline rendering', () => {
    const seq = Sequence.create(
      [
        { type: 'rest', start: musicalTime(0, 1), duration: musicalTime(1, 4) },
        {
          type: 'note',
          note: Note.create('D4'),
          start: musicalTime(1, 4),
          duration: musicalTime(1, 4),
        },
      ],
      { tempo: 60 },
    );
    const { ctx: offlineCtx, voices } = buildFakeOfflineContext(0);
    const { ctx: liveCtx } = buildFakeAudioContext(0);
    createWebAudioRenderer({ audioContext: liveCtx }).renderOffline(seq, {
      offlineContext: offlineCtx,
    });
    expect(voices).toHaveLength(1);
  });
});
