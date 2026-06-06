import { describe, expect, it } from 'bun:test';
import * as fc from 'fast-check';
import { Duration } from './duration.js';
import { Meter } from './meter.js';
import { compareRhythm, RhythmPattern } from './rhythm.js';
import { createRational, rationalsEqual } from './rational.js';

// Convenience helpers
const isPowerOfTwo = (n: number): boolean => n > 0 && (n & (n - 1)) === 0;
const q = () => Duration.create('quarter');
const h = () => Duration.create('half');
const e = () => Duration.create('eighth');
const qr = () => Duration.create('quarter', { isRest: true });

describe('RhythmPattern.create', () => {
  it('throws TypeError for empty array', () => {
    expect(() => RhythmPattern.create([])).toThrow(TypeError);
  });

  it('creates a pattern with events', () => {
    const p = RhythmPattern.create([q(), q(), q(), q()]);
    expect(p.length).toBe(4);
  });
});

describe('RhythmPattern.totalDuration', () => {
  it('four quarters = 1 whole note', () => {
    const p = RhythmPattern.create([q(), q(), q(), q()]);
    expect(p.totalDuration()).toEqual({ numerator: 1, denominator: 1 });
  });

  it('two quarters = 1/2', () => {
    const p = RhythmPattern.create([q(), q()]);
    expect(p.totalDuration()).toEqual({ numerator: 1, denominator: 2 });
  });

  it('half + two quarters = 1', () => {
    const p = RhythmPattern.create([h(), q(), q()]);
    expect(p.totalDuration()).toEqual({ numerator: 1, denominator: 1 });
  });

  it('eight eighths = 1', () => {
    const p = RhythmPattern.create([e(), e(), e(), e(), e(), e(), e(), e()]);
    expect(p.totalDuration()).toEqual({ numerator: 1, denominator: 1 });
  });

  it('three triplet-eighths = one quarter exactly', () => {
    const te = Duration.create('eighth', { tuplet: { actual: 3, normal: 2 } });
    const p = RhythmPattern.create([te, te, te]);
    expect(p.totalDuration()).toEqual({ numerator: 1, denominator: 4 });
  });
});

describe('RhythmPattern.fitsMeter', () => {
  it('[q,q,q,q] fits 4/4', () => {
    const p = RhythmPattern.create([q(), q(), q(), q()]);
    expect(p.fitsMeter(Meter.create('4/4'))).toBe(true);
  });

  it('[q,q] does not fit 4/4', () => {
    const p = RhythmPattern.create([q(), q()]);
    expect(p.fitsMeter(Meter.create('4/4'))).toBe(false);
  });

  it('[q,q,q,q,q,q,q,q] fits 2 measures of 4/4', () => {
    const p = RhythmPattern.create([q(), q(), q(), q(), q(), q(), q(), q()]);
    expect(p.fitsMeter(Meter.create('4/4'))).toBe(true);
  });

  it('dotted-quarter + dotted-quarter fits 3/4', () => {
    const dq = Duration.create('quarter', { dots: 1 }); // 3/8
    const p = RhythmPattern.create([dq, dq]); // total 3/4
    expect(p.fitsMeter(Meter.create('3/4'))).toBe(true);
  });

  it('six eighth notes fit 6/8', () => {
    const p = RhythmPattern.create([e(), e(), e(), e(), e(), e()]);
    expect(p.fitsMeter(Meter.create('6/8'))).toBe(true);
  });

  it('[e,e,e] fits 3/8', () => {
    const p = RhythmPattern.create([e(), e(), e()]);
    expect(p.fitsMeter(Meter.create('3/8'))).toBe(true);
  });
});

describe('RhythmPattern.subdivisionGrid', () => {
  it('returns correct onset positions for four quarters in 4/4', () => {
    const p = RhythmPattern.create([q(), q(), q(), q()]);
    const grid = p.subdivisionGrid(Meter.create('4/4'));
    expect(grid.length).toBe(4);
    expect(grid[0]?.onset).toEqual({ numerator: 0, denominator: 1 });
    expect(grid[1]?.onset).toEqual({ numerator: 1, denominator: 4 });
    expect(grid[2]?.onset).toEqual({ numerator: 1, denominator: 2 });
    expect(grid[3]?.onset).toEqual({ numerator: 3, denominator: 4 });
  });

  it('beat positions are beat-count integers for on-beat quarters in 4/4', () => {
    const p = RhythmPattern.create([q(), q(), q(), q()]);
    const grid = p.subdivisionGrid(Meter.create('4/4'));
    expect(grid[0]?.beatPosition).toEqual({ numerator: 0, denominator: 1 });
    expect(grid[1]?.beatPosition).toEqual({ numerator: 1, denominator: 1 });
    expect(grid[2]?.beatPosition).toEqual({ numerator: 2, denominator: 1 });
    expect(grid[3]?.beatPosition).toEqual({ numerator: 3, denominator: 1 });
  });

  it('accepts explicit subdivision', () => {
    const p = RhythmPattern.create([q(), q()]);
    const grid = p.subdivisionGrid(Meter.create('4/4'), createRational(1, 8));
    // quarter note at onset 0 = beat position 0 eighths; quarter = 2 eighths
    expect(grid[0]?.beatPosition).toEqual({ numerator: 0, denominator: 1 });
    expect(grid[1]?.beatPosition).toEqual({ numerator: 2, denominator: 1 });
  });
});

describe('RhythmPattern.isSyncopated', () => {
  it('four on-beat quarters are not syncopated in 4/4', () => {
    const p = RhythmPattern.create([q(), q(), q(), q()]);
    expect(p.isSyncopated(Meter.create('4/4'))).toBe(false);
  });

  it('rest + half + quarter is not syncopated in 4/4 (half falls on beat 2)', () => {
    // qrest on beat 1, half on beat 2 (on-beat, sustains across beat 3 is OK as on-beat start)
    const p = RhythmPattern.create([qr(), h(), q()]);
    expect(p.isSyncopated(Meter.create('4/4'))).toBe(false);
  });

  it('a tied note starting off-beat and crossing a beat is syncopated', () => {
    // e + dotted-quarter sustains across beat boundary: e ends at 1/8, dq starts at 1/8 (off beat 1/4)
    // and sustains to 1/8 + 3/8 = 4/8 = 1/2, crossing beat 2 (at 1/4)
    const dq = Duration.create('quarter', { dots: 1 }); // 3/8
    const p = RhythmPattern.create([e(), dq, e(), e()]);
    // Onsets: 0, 1/8, 4/8, 5/8
    // beat unit = 1/4; beats at 0, 1/4, 2/4, 3/4
    // event[1] at 1/8 is off-beat (not multiple of 1/4), ends at 4/8 which > next beat (2/4=4/8)? No, 4/8 = 2/4 = exactly next beat boundary.
    // Actually, compare > means strictly greater. 4/8 == 2/4. The end is exactly ON the next beat, so NOT syncopated.
    // Let's instead: e + dotted-quarter in 3/8 where dq = 3/8 but starts at 1/8
    // Actually let's test a known syncopation: eighth, quarter (crosses beat 2 at 1/4), eighth, eighth
    const pSync = RhythmPattern.create([e(), q(), e(), e()]);
    // event[1] starts at 1/8 (off-beat from 4/4 beat unit 1/4), ends at 1/8 + 2/8 = 3/8 > 2/8=1/4 (next beat)
    expect(pSync.isSyncopated(Meter.create('4/4'))).toBe(true);
  });

  it('skips rest events when checking syncopation', () => {
    // rest on offbeat — not a syncopated note
    const p = RhythmPattern.create([e(), qr(), e(), h()]);
    // event[1] is a rest starting at 1/8 (off-beat) but is a rest, so skipped
    // event[2] at 3/8 (off-beat) ends at 4/8 = 1/2, next beat is at 2/4 = 4/8 — not strictly greater
    // event[3] at 4/8 = 1/2 — on beat
    expect(p.isSyncopated(Meter.create('4/4'))).toBe(false);
  });

  it('tied note spanning a beat is syncopated — tie flag does not exempt it', () => {
    // eighth + tied quarter starting at 1/8 (off-beat), ends at 3/8, crosses beat 2 at 2/8 = 1/4
    const tiedQ = Duration.create('quarter', { isTied: true });
    const p = RhythmPattern.create([e(), tiedQ, e(), e()]);
    expect(p.isSyncopated(Meter.create('4/4'))).toBe(true);
    // Tie flag is preserved on the Duration, fraction is unchanged
    expect(tiedQ.isTied).toBe(true);
    expect(tiedQ.fraction()).toEqual({ numerator: 1, denominator: 4 });
  });
});

describe('RhythmPattern.withSwing', () => {
  it('returns a SwingDescriptor with offsets for each event', () => {
    const p = RhythmPattern.create([e(), e(), e(), e()]);
    const swing = p.withSwing(createRational(2, 3));
    expect(swing.offsets.length).toBe(4);
  });

  it('written fractions are unchanged after withSwing (swing is metadata only)', () => {
    const p = RhythmPattern.create([e(), e(), e(), e()]);
    const originalFractions = p.events.map((ev) => ev.fraction());
    p.withSwing(createRational(2, 3));
    // Re-read fractions — they should be identical
    p.events.forEach((ev, i) => {
      expect(rationalsEqual(ev.fraction(), originalFractions[i]!)).toBe(true);
    });
  });

  it('swing ratio is preserved in the descriptor', () => {
    const p = RhythmPattern.create([e(), e()]);
    const ratio = createRational(2, 3);
    const swing = p.withSwing(ratio);
    expect(rationalsEqual(swing.ratio, ratio)).toBe(true);
  });

  it('down-beat event (index 0 at position 0) has zero offset', () => {
    const p = RhythmPattern.create([e(), e()]);
    const swing = p.withSwing(createRational(2, 3));
    expect(swing.offsets[0]?.offset).toEqual({ numerator: 0, denominator: 1 });
  });

  it('ratio 1/2 (straight) gives zero offset for the second eighth', () => {
    // ratio = 1/2: offset = (1 - 1/2) - 1/2 = 1/2 - 1/2 = 0
    const p = RhythmPattern.create([e(), e()]);
    const swing = p.withSwing(createRational(1, 2));
    expect(swing.offsets[1]?.offset).toEqual({ numerator: 0, denominator: 1 });
  });

  it('ratio 2/3 (triplet swing) gives +1/6 offset for the second eighth', () => {
    // notated upbeat = 1/2 beat; swung onset = 2/3; offset = 2/3 - 1/2 = +1/6 (delayed)
    const p = RhythmPattern.create([e(), e()]);
    const swing = p.withSwing(createRational(2, 3));
    expect(swing.offsets[1]?.offset).toEqual({ numerator: 1, denominator: 6 });
  });
});

describe('compareRhythm', () => {
  it('identical patterns', () => {
    const a = RhythmPattern.create([q(), q(), q(), q()]);
    const b = RhythmPattern.create([q(), q(), q(), q()]);
    const result = compareRhythm(a, b);
    expect(result.isIdentical).toBe(true);
    expect(result.hasSameDuration).toBe(true);
  });

  it('different patterns with same duration', () => {
    const a = RhythmPattern.create([h(), h()]);
    const b = RhythmPattern.create([q(), q(), q(), q()]);
    const result = compareRhythm(a, b);
    expect(result.isIdentical).toBe(false);
    expect(result.hasSameDuration).toBe(true);
  });

  it('patterns with different durations', () => {
    const a = RhythmPattern.create([q(), q()]);
    const b = RhythmPattern.create([q(), q(), q(), q()]);
    const result = compareRhythm(a, b);
    expect(result.isIdentical).toBe(false);
    expect(result.hasSameDuration).toBe(false);
  });

  it('returns correct durationA and durationB', () => {
    const a = RhythmPattern.create([q(), q()]);
    const b = RhythmPattern.create([h()]);
    const result = compareRhythm(a, b);
    expect(rationalsEqual(result.durationA, createRational(1, 2))).toBe(true);
    expect(rationalsEqual(result.durationB, createRational(1, 2))).toBe(true);
  });
});

describe('RhythmPattern iteration and properties', () => {
  it('is iterable', () => {
    const p = RhythmPattern.create([q(), h()]);
    const events = [...p];
    expect(events.length).toBe(2);
  });

  it('toStringTag', () => {
    const p = RhythmPattern.create([q(), q()]);
    expect(p[Symbol.toStringTag]).toBe('RhythmPattern(2 events)');
  });
});

describe('property tests', () => {
  it('totalDuration is exact for any combination of powers-of-2 durations', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.constantFrom(
            Duration.create('whole'),
            Duration.create('half'),
            Duration.create('quarter'),
            Duration.create('eighth'),
          ),
          { minLength: 1, maxLength: 8 },
        ),
        (events) => {
          const p = RhythmPattern.create(events);
          const total = p.totalDuration();
          // Sanity: denominator should be a power of 2 (no floating-point leakage)
          return isPowerOfTwo(total.denominator) || total.denominator === 1;
        },
      ),
      { numRuns: 50 },
    );
  });

  it('withSwing preserves all written fractions', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(Duration.create('eighth'), Duration.create('quarter')), {
          minLength: 1,
          maxLength: 8,
        }),
        (events) => {
          const p = RhythmPattern.create(events);
          const before = p.events.map((ev) => ev.fraction());
          p.withSwing(createRational(2, 3));
          return p.events.every((ev, i) => rationalsEqual(ev.fraction(), before[i]));
        },
      ),
      { numRuns: 50 },
    );
  });
});
