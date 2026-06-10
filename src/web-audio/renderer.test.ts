/**
 * Tests for the web-audio renderer.
 *
 * Uses explicitly-typed fake AudioContext mocks (typed as *Like interfaces)
 * to assert scheduling math (start/stop times) and frequency values, without
 * requiring a real browser environment.
 */

import { describe, it, expect } from 'bun:test';
import { Note, noteToFrequency } from '../note.js';
import { Chord } from '../chord.js';
import { createFrequency } from '../branded-types.js';
import { createWebAudioRenderer } from './renderer.js';
import { createWebAudioRenderer as createFromBarrel } from './index.js';
import type {
  AudioContextLike,
  AudioNodeLike,
  AudioParamLike,
  GainNodeLike,
  OscillatorNodeLike,
} from './types.js';

// ---------------------------------------------------------------------------
// Fake builders
// ---------------------------------------------------------------------------

type RecordedVoice = {
  frequency: number;
  startTime: number;
  stopTime: number;
  gainSchedule: Array<{ method: string; value: number; time: number }>;
};

// Extracted to outer scope to avoid recreating on every buildFakeAudioContext call.
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

// ---------------------------------------------------------------------------
// scheduleNote
// ---------------------------------------------------------------------------

describe('scheduleNote — basic scheduling', () => {
  it('schedules start/stop times correctly', () => {
    const { ctx, voices } = buildFakeAudioContext(10);
    createWebAudioRenderer({ audioContext: ctx }).scheduleNote('C4', {
      startTime: 10,
      duration: 2,
    });
    const voice = voices[0];
    expect(voice).toBeDefined();
    if (voice === undefined) return;
    expect(voice.startTime).toBe(10);
    expect(voice.stopTime).toBe(12);
  });

  it('sets the correct frequency — standard tuning', () => {
    const { ctx, voices } = buildFakeAudioContext(0);
    createWebAudioRenderer({ audioContext: ctx }).scheduleNote('A4', { startTime: 0, duration: 1 });
    const voice = voices[0];
    expect(voice).toBeDefined();
    if (voice === undefined) return;
    expect(voice.frequency).toBeCloseTo(440, 2);
  });

  it('uses tuning option — different A4 reference shifts frequency', () => {
    const stdNote = Note.create('A4').frequency;
    const altTuning = { reference: 'A4' as const, frequency: createFrequency(442) };
    const { ctx, voices } = buildFakeAudioContext(0);
    createWebAudioRenderer({ audioContext: ctx, tuning: altTuning }).scheduleNote('A4', {
      startTime: 0,
      duration: 1,
    });
    const voice = voices[0];
    expect(voice).toBeDefined();
    if (voice === undefined) return;
    expect(voice.frequency).toBeCloseTo(442, 2);
    expect(voice.frequency).not.toBeCloseTo(stdNote, 2);
  });

  it('envelope: gain ramps from 0 at start and back to 0 at end', () => {
    const { ctx, voices } = buildFakeAudioContext(0);
    createWebAudioRenderer({ audioContext: ctx }).scheduleNote('C4', { startTime: 0, duration: 1 });
    const voice = voices[0];
    expect(voice).toBeDefined();
    if (voice === undefined) return;
    expect(voice.gainSchedule[0]).toMatchObject({ method: 'set', value: 0 });
    expect(voice.gainSchedule[voice.gainSchedule.length - 1]).toMatchObject({
      method: 'ramp',
      value: 0,
      time: 1,
    });
  });

  it('absent velocity uses default — no throw, one voice created', () => {
    const { ctx, voices } = buildFakeAudioContext(0);
    expect(() =>
      createWebAudioRenderer({ audioContext: ctx }).scheduleNote('C4', {
        startTime: 0,
        duration: 1,
      }),
    ).not.toThrow();
    expect(voices).toHaveLength(1);
  });

  it('high velocity produces larger gain peak than low velocity', () => {
    const { ctx: ctxLow, voices: voicesLow } = buildFakeAudioContext(0);
    createWebAudioRenderer({ audioContext: ctxLow }).scheduleNote('C4', {
      startTime: 0,
      duration: 1,
      velocity: 1,
    });
    const { ctx: ctxHigh, voices: voicesHigh } = buildFakeAudioContext(0);
    createWebAudioRenderer({ audioContext: ctxHigh }).scheduleNote('C4', {
      startTime: 0,
      duration: 1,
      velocity: 127,
    });
    const lowPeak = voicesLow[0]?.gainSchedule.find((e) => e.method === 'ramp' && e.value > 0);
    const highPeak = voicesHigh[0]?.gainSchedule.find((e) => e.method === 'ramp' && e.value > 0);
    expect(lowPeak).toBeDefined();
    expect(highPeak).toBeDefined();
    if (lowPeak === undefined || highPeak === undefined) return;
    expect(highPeak.value).toBeGreaterThan(lowPeak.value);
  });

  it('custom envelope overrides default attack', () => {
    const { ctx, voices } = buildFakeAudioContext(0);
    createWebAudioRenderer({ audioContext: ctx }).scheduleNote('C4', {
      startTime: 0,
      duration: 2,
      envelope: { attack: 0.5 },
    });
    const peakRamp = voices[0]?.gainSchedule.find((e) => e.method === 'ramp' && e.value > 0);
    expect(peakRamp).toBeDefined();
    if (peakRamp === undefined) return;
    expect(peakRamp.time).toBeCloseTo(0.5, 5);
  });

  it('clamps attack to the note end when attack >= duration (degenerate envelope)', () => {
    const { ctx, voices } = buildFakeAudioContext(0);
    // attack (3s) exceeds duration (1s): the peak ramp must not be scheduled
    // past the release ramp, or Web Audio's time-ordered automation breaks.
    createWebAudioRenderer({ audioContext: ctx }).scheduleNote('C4', {
      startTime: 10,
      duration: 1,
      envelope: { attack: 3 },
    });
    const voice = voices[0];
    expect(voice).toBeDefined();
    if (voice === undefined) return;
    const endTime = 11;
    // Every gain automation time is at or before the note end — nothing past it.
    for (const entry of voice.gainSchedule) {
      expect(entry.time).toBeLessThanOrEqual(endTime);
    }
    // The peak ramp lands exactly on the end (clamped), not at start + attack (13).
    const peakRamp = voice.gainSchedule.find((e) => e.method === 'ramp' && e.value > 0);
    expect(peakRamp).toBeDefined();
    if (peakRamp === undefined) return;
    expect(peakRamp.time).toBeCloseTo(endTime, 5);
  });
});

describe('scheduleNote — input validation', () => {
  const render = (options: { startTime: number; duration: number; velocity?: number }) => {
    const { ctx } = buildFakeAudioContext(0);
    return () => createWebAudioRenderer({ audioContext: ctx }).scheduleNote('C4', options);
  };

  it('throws RangeError for velocity=0 (note-off)', () => {
    expect(render({ startTime: 0, duration: 1, velocity: 0 })).toThrow(RangeError);
    expect(render({ startTime: 0, duration: 1, velocity: 0 })).toThrow('received 0');
  });

  it('throws RangeError for velocity below 1', () => {
    expect(render({ startTime: 0, duration: 1, velocity: -1 })).toThrow(RangeError);
  });

  it('throws RangeError for velocity above 127', () => {
    expect(render({ startTime: 0, duration: 1, velocity: 128 })).toThrow(RangeError);
  });

  it('throws TypeError for a non-integer velocity', () => {
    expect(render({ startTime: 0, duration: 1, velocity: 63.5 })).toThrow(TypeError);
  });

  it('throws RangeError for a non-positive duration', () => {
    expect(render({ startTime: 0, duration: 0 })).toThrow(RangeError);
    expect(render({ startTime: 0, duration: -1 })).toThrow(RangeError);
  });

  it('throws RangeError for a non-finite duration', () => {
    expect(render({ startTime: 0, duration: Number.POSITIVE_INFINITY })).toThrow(RangeError);
  });

  it('throws RangeError for a non-finite startTime', () => {
    expect(render({ startTime: Number.NaN, duration: 1 })).toThrow(RangeError);
  });

  it('throws RangeError for a negative envelope attack', () => {
    const { ctx } = buildFakeAudioContext(0);
    expect(() =>
      createWebAudioRenderer({ audioContext: ctx }).scheduleNote('C4', {
        startTime: 0,
        duration: 1,
        envelope: { attack: -0.1 },
      }),
    ).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// scheduleChord
// ---------------------------------------------------------------------------

describe('scheduleChord', () => {
  it('schedules one voice per chord note', () => {
    const { ctx, voices } = buildFakeAudioContext(0);
    const chord = Chord.create('C4', 'major');
    createWebAudioRenderer({ audioContext: ctx }).scheduleChord(chord, {
      startTime: 5,
      duration: 2,
    });
    expect(voices).toHaveLength(chord.notes.length);
    for (const voice of voices) {
      expect(voice.startTime).toBe(5);
      expect(voice.stopTime).toBe(7);
    }
  });

  it('frequencies match chord.notes', () => {
    const { ctx, voices } = buildFakeAudioContext(0);
    const chord = Chord.create('C4', 'major');
    createWebAudioRenderer({ audioContext: ctx }).scheduleChord(chord, {
      startTime: 0,
      duration: 1,
    });
    for (let i = 0; i < voices.length; i++) {
      const voice = voices[i];
      const expected = chord.notes[i]?.frequency;
      expect(voice).toBeDefined();
      expect(expected).toBeDefined();
      if (voice === undefined || expected === undefined) continue;
      expect(voice.frequency).toBeCloseTo(expected, 2);
    }
  });

  it('uses tuning option for chord note frequencies', () => {
    const altTuning = { reference: 'A4' as const, frequency: createFrequency(442) };
    const { ctx, voices } = buildFakeAudioContext(0);
    const chord = Chord.create('A4', 'major');
    createWebAudioRenderer({ audioContext: ctx, tuning: altTuning }).scheduleChord(chord, {
      startTime: 0,
      duration: 1,
    });
    for (let i = 0; i < voices.length; i++) {
      const voice = voices[i];
      const note = chord.notes[i];
      if (voice === undefined || note === undefined) continue;
      expect(voice.frequency).toBeCloseTo(noteToFrequency(note, altTuning), 2);
    }
  });

  it('throws RangeError for velocity=0', () => {
    const { ctx } = buildFakeAudioContext(0);
    expect(() =>
      createWebAudioRenderer({ audioContext: ctx }).scheduleChord(Chord.create('C4', 'major'), {
        startTime: 0,
        duration: 1,
        velocity: 0,
      }),
    ).toThrow(RangeError);
  });

  it('absent velocity uses default — no throw', () => {
    const { ctx, voices } = buildFakeAudioContext(0);
    expect(() =>
      createWebAudioRenderer({ audioContext: ctx }).scheduleChord(Chord.create('C4', 'major'), {
        startTime: 0,
        duration: 1,
      }),
    ).not.toThrow();
    expect(voices.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// shape check
// ---------------------------------------------------------------------------

describe('createWebAudioRenderer — shape', () => {
  it('returns object with all four renderer methods', () => {
    const { ctx } = buildFakeAudioContext(0);
    const renderer = createWebAudioRenderer({ audioContext: ctx });
    expect(typeof renderer.scheduleNote).toBe('function');
    expect(typeof renderer.scheduleChord).toBe('function');
    expect(typeof renderer.scheduleSequence).toBe('function');
    expect(typeof renderer.renderOffline).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// barrel re-export
// ---------------------------------------------------------------------------

describe('index.ts barrel', () => {
  it('re-exports createWebAudioRenderer', () => {
    expect(typeof createFromBarrel).toBe('function');
  });
});
