/**
 * Tests for performance timing analysis.
 *
 * Ground-truth assertions use external, manually-verified values (per spec):
 * - Onsets [0, 0.5, 1.0, 1.5] at 0.5s grid ⇒ 120 BPM
 * - Performed 0.52 vs expected 0.5, tol 0.05 ⇒ error=+0.02 ⇒ 'on-time'
 * - Performed 0.6 vs expected 0.5, tol 0.05 ⇒ error=+0.1 ⇒ 'late'
 * - latencyOffset 0.1: performed 0.6 − 0.1 = 0.5 vs expected 0.5 ⇒ 'on-time'
 * - Missing performed onset ⇒ 'missed'; extra performed onset ⇒ 'extra'
 */

import { describe, it, expect } from 'bun:test';

import {
  quantizePerformance,
  classifyTimingError,
  comparePerformanceTiming,
  estimateTempoFromOnsets,
  measureSwingRatio,
} from './performance-timing.js';

import type { PerformedEvent } from './types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(onsetSeconds: number, extra?: Partial<PerformedEvent>): PerformedEvent {
  return { onsetSeconds, ...extra };
}

// ---------------------------------------------------------------------------
// quantizePerformance
// ---------------------------------------------------------------------------

describe('quantizePerformance', () => {
  it('snaps onsets to the nearest grid multiple', () => {
    const events = [makeEvent(0.0), makeEvent(0.52), makeEvent(1.03), makeEvent(1.48)];
    const result = quantizePerformance(events, 0.5);

    expect(result.gridSeconds).toBe(0.5);
    expect(result.offsetSeconds).toBe(0);
    expect(result.events).toHaveLength(4);

    // 0.52 snaps to 0.5
    expect(result.events[1]?.quantizedOnsetSeconds).toBe(0.5);
    expect(result.events[1]?.originalOnsetSeconds).toBe(0.52);
    // deviation = 0.52 - 0.5 = 0.02 (positive = late relative to grid)
    expect(result.events[1]?.deviationSeconds).toBeCloseTo(0.02, 10);

    // 1.03 snaps to 1.0
    expect(result.events[2]?.quantizedOnsetSeconds).toBe(1.0);
    expect(result.events[2]?.deviationSeconds).toBeCloseTo(0.03, 10);

    // 1.48 snaps to 1.5
    expect(result.events[3]?.quantizedOnsetSeconds).toBe(1.5);
    expect(result.events[3]?.deviationSeconds).toBeCloseTo(-0.02, 10);
  });

  it('preserves deviation for exactly on-grid events', () => {
    const result = quantizePerformance([makeEvent(0.5)], 0.5);
    expect(result.events[0]?.quantizedOnsetSeconds).toBe(0.5);
    expect(result.events[0]?.deviationSeconds).toBe(0);
  });

  it('applies a positive offsetSeconds before snapping', () => {
    // onset 0.4, offset +0.1 ⇒ shifted 0.5, snaps to 0.5
    // deviation = 0.4 − 0.5 = −0.1
    const result = quantizePerformance([makeEvent(0.4)], 0.5, { offsetSeconds: 0.1 });
    expect(result.offsetSeconds).toBe(0.1);
    expect(result.events[0]?.quantizedOnsetSeconds).toBe(0.5);
    expect(result.events[0]?.deviationSeconds).toBeCloseTo(-0.1, 10);
  });

  it('applies a negative offsetSeconds before snapping', () => {
    // onset 0.6, offset -0.1 ⇒ shifted 0.5, snaps to 0.5
    // deviation = 0.6 − 0.5 = 0.1
    const result = quantizePerformance([makeEvent(0.6)], 0.5, { offsetSeconds: -0.1 });
    expect(result.offsetSeconds).toBe(-0.1);
    expect(result.events[0]?.quantizedOnsetSeconds).toBe(0.5);
    expect(result.events[0]?.deviationSeconds).toBeCloseTo(0.1, 10);
  });

  it('passes through optional durationSeconds', () => {
    const result = quantizePerformance([makeEvent(0.5, { durationSeconds: 0.25 })], 0.5);
    expect(result.events[0]?.durationSeconds).toBe(0.25);
  });

  it('passes through optional note and velocity together', async () => {
    const { Note } = await import('../note.js');
    const note = Note.create({ note: 'C', octave: 4 as never });
    const result = quantizePerformance([makeEvent(0.0, { note, velocity: 64 })], 0.5);
    expect(result.events[0]?.note).toBe(note);
    expect(result.events[0]?.velocity).toBe(64);
  });

  it('passes through optional note without velocity', async () => {
    const { Note } = await import('../note.js');
    const note = Note.create({ note: 'D', octave: 4 as never });
    const result = quantizePerformance([makeEvent(0.0, { note })], 0.5);
    expect(result.events[0]?.note).toBe(note);
    expect(result.events[0]?.velocity).toBeUndefined();
  });

  it('passes through optional velocity without note', () => {
    const result = quantizePerformance([makeEvent(0.0, { velocity: 80 })], 0.5);
    expect(result.events[0]?.velocity).toBe(80);
    expect(result.events[0]?.note).toBeUndefined();
  });

  it('preserves all optional fields together (durationSeconds + note + velocity)', async () => {
    const { Note } = await import('../note.js');
    const note = Note.create({ note: 'E', octave: 4 as never });
    const event = makeEvent(0.52, { durationSeconds: 0.3, note, velocity: 100 });
    const result = quantizePerformance([event], 0.5);
    const qe = result.events[0];
    expect(qe?.originalOnsetSeconds).toBe(0.52);
    expect(qe?.quantizedOnsetSeconds).toBe(0.5);
    expect(qe?.deviationSeconds).toBeCloseTo(0.02, 10);
    expect(qe?.durationSeconds).toBe(0.3);
    expect(qe?.note).toBe(note);
    expect(qe?.velocity).toBe(100);
  });

  it('handles empty event array', () => {
    const result = quantizePerformance([], 0.5);
    expect(result.events).toHaveLength(0);
  });

  it('throws RangeError for non-positive gridSeconds', () => {
    expect(() => quantizePerformance([], 0)).toThrow(RangeError);
    expect(() => quantizePerformance([], -0.5)).toThrow(RangeError);
  });

  it('throws RangeError for non-finite gridSeconds', () => {
    expect(() => quantizePerformance([], Infinity)).toThrow(RangeError);
    expect(() => quantizePerformance([], NaN)).toThrow(RangeError);
  });

  it('throws RangeError for non-finite offsetSeconds', () => {
    expect(() => quantizePerformance([], 0.5, { offsetSeconds: NaN })).toThrow(RangeError);
    expect(() => quantizePerformance([], 0.5, { offsetSeconds: Infinity })).toThrow(RangeError);
  });

  it('throws RangeError for non-finite onset in event', () => {
    expect(() => quantizePerformance([makeEvent(NaN)], 0.5)).toThrow(RangeError);
    expect(() => quantizePerformance([makeEvent(Infinity)], 0.5)).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// classifyTimingError
// ---------------------------------------------------------------------------

describe('classifyTimingError', () => {
  it('classifies 0.02 error with 0.05 tolerance as on-time (ground truth: 0.52 vs 0.5)', () => {
    // error = 0.52 - 0.5 = 0.02; 0.02 <= 0.05 ⇒ on-time
    expect(classifyTimingError(0.02, { toleranceSeconds: 0.05 })).toBe('on-time');
  });

  it('classifies 0.1 error with 0.05 tolerance as late (ground truth: 0.6 vs 0.5)', () => {
    // error = 0.6 - 0.5 = 0.1; 0.1 > 0.05 ⇒ late
    expect(classifyTimingError(0.1, { toleranceSeconds: 0.05 })).toBe('late');
  });

  it('classifies negative error within tolerance as on-time', () => {
    // 0.45 vs 0.5: error = 0.45 - 0.5 = -0.049... <= 0.05 ⇒ on-time
    const error = 0.45 - 0.5; // ≈ -0.04999...
    expect(classifyTimingError(error, { toleranceSeconds: 0.05 })).toBe('on-time');
  });

  it('classifies negative error beyond tolerance as early', () => {
    // error = -0.1; 0.1 > 0.05 and negative ⇒ early
    expect(classifyTimingError(-0.1, { toleranceSeconds: 0.05 })).toBe('early');
  });

  it('classifies exact zero as on-time', () => {
    expect(classifyTimingError(0)).toBe('on-time');
  });

  it('uses default tolerance of 0.05', () => {
    expect(classifyTimingError(0.04)).toBe('on-time');
    expect(classifyTimingError(0.06)).toBe('late');
    expect(classifyTimingError(-0.06)).toBe('early');
  });

  it('classifies exactly at tolerance boundary as on-time (inclusive)', () => {
    expect(classifyTimingError(0.05, { toleranceSeconds: 0.05 })).toBe('on-time');
    expect(classifyTimingError(-0.05, { toleranceSeconds: 0.05 })).toBe('on-time');
  });

  it('classifies just beyond tolerance as late/early', () => {
    expect(classifyTimingError(0.0501, { toleranceSeconds: 0.05 })).toBe('late');
    expect(classifyTimingError(-0.0501, { toleranceSeconds: 0.05 })).toBe('early');
  });

  it('throws RangeError for non-finite errorSeconds', () => {
    expect(() => classifyTimingError(NaN)).toThrow(RangeError);
    expect(() => classifyTimingError(Infinity)).toThrow(RangeError);
  });

  it('throws RangeError for negative toleranceSeconds', () => {
    expect(() => classifyTimingError(0.01, { toleranceSeconds: -0.01 })).toThrow(RangeError);
  });

  it('throws RangeError for non-finite toleranceSeconds', () => {
    expect(() => classifyTimingError(0.01, { toleranceSeconds: NaN })).toThrow(RangeError);
    expect(() => classifyTimingError(0.01, { toleranceSeconds: Infinity })).toThrow(RangeError);
  });

  it('allows zero toleranceSeconds (only exact match is on-time)', () => {
    expect(classifyTimingError(0, { toleranceSeconds: 0 })).toBe('on-time');
    expect(classifyTimingError(0.001, { toleranceSeconds: 0 })).toBe('late');
    expect(classifyTimingError(-0.001, { toleranceSeconds: 0 })).toBe('early');
  });
});

// ---------------------------------------------------------------------------
// comparePerformanceTiming
// ---------------------------------------------------------------------------

describe('comparePerformanceTiming', () => {
  it('classifies performed 0.52 vs expected 0.5 as on-time (ground truth)', () => {
    const result = comparePerformanceTiming([0.5], [makeEvent(0.52)], { toleranceSeconds: 0.05 });
    expect(result.onTimeCount).toBe(1);
    expect(result.earlyCount).toBe(0);
    expect(result.lateCount).toBe(0);
    expect(result.missedCount).toBe(0);
    expect(result.extraCount).toBe(0);

    const event = result.events[0];
    expect(event?.type).toBe('matched');
    if (event?.type === 'matched') {
      expect(event.classification).toBe('on-time');
      expect(event.errorSeconds).toBeCloseTo(0.02, 10);
    }
  });

  it('classifies performed 0.6 vs expected 0.5 as late (ground truth)', () => {
    const result = comparePerformanceTiming([0.5], [makeEvent(0.6)], { toleranceSeconds: 0.05 });
    expect(result.lateCount).toBe(1);
    expect(result.onTimeCount).toBe(0);

    const event = result.events[0];
    if (event?.type === 'matched') {
      expect(event.classification).toBe('late');
      expect(event.errorSeconds).toBeCloseTo(0.1, 10);
    }
  });

  it('applies latencyOffset: performed 0.6 - 0.1 = 0.5 vs expected 0.5 ⇒ on-time (ground truth)', () => {
    const result = comparePerformanceTiming([0.5], [makeEvent(0.6)], {
      toleranceSeconds: 0.05,
      latencyOffsetSeconds: 0.1,
    });
    expect(result.onTimeCount).toBe(1);
    expect(result.latencyOffsetSeconds).toBe(0.1);

    const event = result.events[0];
    if (event?.type === 'matched') {
      expect(event.performedOnsetSeconds).toBeCloseTo(0.5, 10);
      expect(event.classification).toBe('on-time');
    }
  });

  it('reports missed onset when no performed match', () => {
    const result = comparePerformanceTiming([0.5, 1.0], [makeEvent(0.5)], {
      toleranceSeconds: 0.05,
    });
    expect(result.missedCount).toBe(1);

    const missed = result.events.find((e) => e.type === 'missed');
    expect(missed?.type).toBe('missed');
    if (missed?.type === 'missed') {
      expect(missed.expectedOnsetSeconds).toBe(1.0);
    }
  });

  it('reports extra onset when no expected match', () => {
    const result = comparePerformanceTiming([0.5], [makeEvent(0.5), makeEvent(0.75)], {
      toleranceSeconds: 0.05,
    });
    expect(result.extraCount).toBe(1);

    const extra = result.events.find((e) => e.type === 'extra');
    expect(extra?.type).toBe('extra');
    if (extra?.type === 'extra') {
      expect(extra.performedOnsetSeconds).toBeCloseTo(0.75, 10);
    }
  });

  it('matches nearest neighbor correctly (greedy assignment)', () => {
    // expected=[0.5, 1.0], performed=[0.9]
    // 0.9 is closer to 1.0 (dist 0.1) than to 0.5 (dist 0.4)
    // → match 0.9↔1.0, miss 0.5
    const result = comparePerformanceTiming([0.5, 1.0], [makeEvent(0.9)], {
      toleranceSeconds: 0.05,
    });
    expect(result.missedCount).toBe(1);
    expect(result.extraCount).toBe(0);

    const matched = result.events.find((e) => e.type === 'matched');
    if (matched?.type === 'matched') {
      expect(matched.expectedOnsetSeconds).toBe(1.0);
      expect(matched.performedOnsetSeconds).toBeCloseTo(0.9, 10);
    }

    const missed = result.events.find((e) => e.type === 'missed');
    if (missed?.type === 'missed') {
      expect(missed.expectedOnsetSeconds).toBe(0.5);
    }
  });

  it('handles empty performed array (all expected are missed)', () => {
    const result = comparePerformanceTiming([0.5, 1.0], []);
    expect(result.missedCount).toBe(2);
    expect(result.extraCount).toBe(0);
    expect(result.onTimeCount).toBe(0);
  });

  it('handles empty expected array (all performed are extra)', () => {
    const result = comparePerformanceTiming([], [makeEvent(0.5), makeEvent(1.0)]);
    expect(result.extraCount).toBe(2);
    expect(result.missedCount).toBe(0);
  });

  it('handles both empty', () => {
    const result = comparePerformanceTiming([], []);
    expect(result.events).toHaveLength(0);
    expect(result.missedCount).toBe(0);
    expect(result.extraCount).toBe(0);
  });

  it('classifies early onset correctly', () => {
    const result = comparePerformanceTiming([0.5], [makeEvent(0.3)], { toleranceSeconds: 0.05 });
    expect(result.earlyCount).toBe(1);
    const event = result.events[0];
    if (event?.type === 'matched') {
      expect(event.classification).toBe('early');
      expect(event.errorSeconds).toBeCloseTo(-0.2, 10);
    }
  });

  it('accepts a Sequence as expected input (note/chord events only)', async () => {
    const { Sequence, musicalTime } = await import('../sequences/sequence.js');
    const { Note } = await import('../note.js');

    const note = Note.create({ note: 'C', octave: 4 as never });
    const seq = Sequence.create(
      [
        { type: 'note', note, start: musicalTime(0, 1), duration: musicalTime(1, 4) },
        { type: 'rest', start: musicalTime(1, 4), duration: musicalTime(1, 4) },
        { type: 'note', note, start: musicalTime(1, 2), duration: musicalTime(1, 4) },
      ],
      { tempo: 120 },
    );

    // At 120 BPM, quarter notes: start=0 ⇒ 0s, start=1/2 ⇒ 1.0s
    // (1/4) beat at 120 bpm: 1 beat = 0.5s; so 1/4 whole note = 1 beat = 0.5s
    // Actually: quarter note start = 0 ⇒ 0s; half-note start = 1/2 ⇒ 1.0s
    const result = comparePerformanceTiming(seq, [makeEvent(0.0), makeEvent(1.0)], {
      toleranceSeconds: 0.05,
    });

    // Rests don't contribute expected onsets, so 2 expected onsets.
    expect(result.onTimeCount).toBe(2);
    expect(result.missedCount).toBe(0);
  });

  it('uses default tolerance of 0.05 and latency of 0', () => {
    const result = comparePerformanceTiming([0.5], [makeEvent(0.52)]);
    expect(result.toleranceSeconds).toBe(0.05);
    expect(result.latencyOffsetSeconds).toBe(0);
    expect(result.onTimeCount).toBe(1);
  });

  it('throws RangeError for negative toleranceSeconds', () => {
    expect(() =>
      comparePerformanceTiming([0.5], [makeEvent(0.5)], { toleranceSeconds: -0.01 }),
    ).toThrow(RangeError);
  });

  it('throws RangeError for non-finite latencyOffsetSeconds', () => {
    expect(() =>
      comparePerformanceTiming([0.5], [makeEvent(0.5)], { latencyOffsetSeconds: NaN }),
    ).toThrow(RangeError);
  });

  it('throws RangeError for non-finite expected onset', () => {
    expect(() => comparePerformanceTiming([NaN], [makeEvent(0.5)])).toThrow(RangeError);
  });

  it('throws RangeError for non-finite performed onset', () => {
    expect(() => comparePerformanceTiming([0.5], [makeEvent(Infinity)])).toThrow(RangeError);
  });

  it('carries the original PerformedEvent on matched events', () => {
    const event = makeEvent(0.5, { velocity: 64 });
    const result = comparePerformanceTiming([0.5], [event]);
    const matched = result.events[0];
    if (matched?.type === 'matched') {
      expect(matched.event).toBe(event);
    }
  });

  it('carries the original PerformedEvent on extra events', () => {
    const event = makeEvent(0.75);
    const result = comparePerformanceTiming([], [event]);
    const extra = result.events[0];
    if (extra?.type === 'extra') {
      expect(extra.event).toBe(event);
    }
  });
});

// ---------------------------------------------------------------------------
// estimateTempoFromOnsets
// ---------------------------------------------------------------------------

describe('estimateTempoFromOnsets', () => {
  it('returns 120 BPM for onsets [0, 0.5, 1.0, 1.5] (ground truth)', () => {
    const result = estimateTempoFromOnsets([0, 0.5, 1.0, 1.5]);
    expect(result).not.toBeNull();
    expect(result?.bpm).toBeCloseTo(120, 8);
    expect(result?.medianInterOnsetSeconds).toBeCloseTo(0.5, 8);
    expect(result?.intervalCount).toBe(3);
  });

  it('returns 60 BPM for onsets 1 second apart', () => {
    const result = estimateTempoFromOnsets([0, 1, 2, 3]);
    expect(result?.bpm).toBeCloseTo(60, 8);
  });

  it('returns null for fewer than 2 onsets', () => {
    expect(estimateTempoFromOnsets([])).toBeNull();
    expect(estimateTempoFromOnsets([0.5])).toBeNull();
  });

  it('works with exactly 2 onsets', () => {
    const result = estimateTempoFromOnsets([0, 0.5]);
    expect(result?.bpm).toBeCloseTo(120, 8);
    expect(result?.intervalCount).toBe(1);
  });

  it('handles unsorted onsets by sorting internally', () => {
    // [1.5, 0, 1.0, 0.5] sorted ⇒ [0, 0.5, 1.0, 1.5] ⇒ same as ground truth
    const result = estimateTempoFromOnsets([1.5, 0, 1.0, 0.5]);
    expect(result?.bpm).toBeCloseTo(120, 8);
  });

  it('applies beatsPerInterval: 2 onsets per measure at 60 BPM still gives 60 BPM', () => {
    // IOI = 2.0s, beatsPerInterval=2 ⇒ secondsPerBeat = 1.0 ⇒ 60 BPM
    const result = estimateTempoFromOnsets([0, 2, 4], { beatsPerInterval: 2 });
    expect(result?.bpm).toBeCloseTo(60, 8);
  });

  it('throws RangeError for non-finite onset', () => {
    expect(() => estimateTempoFromOnsets([0, NaN, 1.0])).toThrow(RangeError);
  });

  it('throws RangeError for non-positive beatsPerInterval', () => {
    expect(() => estimateTempoFromOnsets([0, 0.5], { beatsPerInterval: 0 })).toThrow(RangeError);
    expect(() => estimateTempoFromOnsets([0, 0.5], { beatsPerInterval: -1 })).toThrow(RangeError);
  });

  it('throws RangeError for non-finite beatsPerInterval', () => {
    expect(() => estimateTempoFromOnsets([0, 0.5], { beatsPerInterval: NaN })).toThrow(RangeError);
  });

  it('throws RangeError for zero/negative IOI (duplicate or unsorted timestamps)', () => {
    expect(() => estimateTempoFromOnsets([0, 0, 1.0])).toThrow(RangeError);
    // Reversed would be sorted internally so this is fine; test true duplicates only
  });

  it('uses median (not mean) for robustness with outliers', () => {
    // IOIs: [0.5, 0.5, 0.5, 5.0] — outlier at end
    // median of [0.5, 0.5, 0.5, 5.0] = (0.5+0.5)/2 = 0.5
    // mean = (0.5+0.5+0.5+5.0)/4 = 1.625
    const result = estimateTempoFromOnsets([0, 0.5, 1.0, 1.5, 6.5]);
    expect(result?.bpm).toBeCloseTo(120, 5); // median gives 120, mean would give ~37
  });
});

// ---------------------------------------------------------------------------
// measureSwingRatio
// ---------------------------------------------------------------------------

describe('measureSwingRatio', () => {
  it('returns null for fewer than 3 events (< subBeats+1)', () => {
    expect(measureSwingRatio([])).toBeNull();
    expect(measureSwingRatio([makeEvent(0)])).toBeNull();
    expect(measureSwingRatio([makeEvent(0), makeEvent(0.5)])).toBeNull();
  });

  it('returns 1.0 for straight 8th notes (no swing)', () => {
    // 4 evenly-spaced events: 0, 0.25, 0.5, 0.75
    // group [0, 0.25, 0.5]: long=0.25, short=0.25, ratio=1.0
    // group [0.5, 0.75, ...] needs 3 events; only one full group
    const result = measureSwingRatio([makeEvent(0), makeEvent(0.25), makeEvent(0.5)]);
    expect(result).toBeCloseTo(1.0, 8);
  });

  it('returns 2.0 for 2:1 swing (triplet swing)', () => {
    // Beat group: long = 2/3 of beat, short = 1/3 of beat
    // onset at 0, 2/3, 1, 5/3, 2...
    // ratio = (2/3) / (1/3) = 2.0
    const third = 1 / 3;
    const events = [
      makeEvent(0),
      makeEvent(2 * third),
      makeEvent(1),
      makeEvent(1 + 2 * third),
      makeEvent(2),
    ];
    const result = measureSwingRatio(events);
    expect(result).not.toBeNull();
    expect(result!).toBeCloseTo(2.0, 5);
  });

  it('handles unsorted events by sorting internally', () => {
    // Same as straight 8th notes test but shuffled
    const result = measureSwingRatio([makeEvent(0.5), makeEvent(0), makeEvent(0.25)]);
    expect(result).toBeCloseTo(1.0, 8);
  });

  it('throws RangeError for non-finite onset', () => {
    expect(() => measureSwingRatio([makeEvent(0), makeEvent(NaN), makeEvent(0.5)])).toThrow(
      RangeError,
    );
  });

  it('throws RangeError for non-integer subBeatsPerBeat', () => {
    expect(() =>
      measureSwingRatio([makeEvent(0), makeEvent(0.25), makeEvent(0.5)], { subBeatsPerBeat: 1.5 }),
    ).toThrow(RangeError);
  });

  it('throws RangeError for subBeatsPerBeat < 1', () => {
    expect(() =>
      measureSwingRatio([makeEvent(0), makeEvent(0.25), makeEvent(0.5)], { subBeatsPerBeat: 0 }),
    ).toThrow(RangeError);
  });

  it('returns null when all short intervals are zero or negative (degenerate)', () => {
    // Duplicate onset times within a beat group
    const result = measureSwingRatio([makeEvent(0), makeEvent(0), makeEvent(0)]);
    expect(result).toBeNull();
  });
});
