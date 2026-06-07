import { describe, expect, it } from 'bun:test';
import * as fc from 'fast-check';
import { rationalsEqual } from './rational.js';
import { Duration, totalDurationFraction, type DurationValue } from './duration.js';

describe('Duration.create', () => {
  it('creates a whole note: fraction = 1/1', () => {
    const d = Duration.create('whole');
    expect(d.fraction()).toEqual({ numerator: 1, denominator: 1 });
  });

  it('creates a half note: fraction = 1/2', () => {
    const d = Duration.create('half');
    expect(d.fraction()).toEqual({ numerator: 1, denominator: 2 });
  });

  it('creates a quarter note: fraction = 1/4', () => {
    const d = Duration.create('quarter');
    expect(d.fraction()).toEqual({ numerator: 1, denominator: 4 });
  });

  it('creates an eighth note: fraction = 1/8', () => {
    const d = Duration.create('eighth');
    expect(d.fraction()).toEqual({ numerator: 1, denominator: 8 });
  });

  it('creates a sixteenth note: fraction = 1/16', () => {
    const d = Duration.create('sixteenth');
    expect(d.fraction()).toEqual({ numerator: 1, denominator: 16 });
  });

  it('creates a thirtySecond note: fraction = 1/32', () => {
    const d = Duration.create('thirtySecond');
    expect(d.fraction()).toEqual({ numerator: 1, denominator: 32 });
  });

  it('creates a sixtyFourth note: fraction = 1/64', () => {
    const d = Duration.create('sixtyFourth');
    expect(d.fraction()).toEqual({ numerator: 1, denominator: 64 });
  });

  it('creates a double whole note: fraction = 2/1', () => {
    const d = Duration.create('double');
    expect(d.fraction()).toEqual({ numerator: 2, denominator: 1 });
  });

  it('throws TypeError for unsupported duration value', () => {
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
    expect(() => Duration.create('invalid' as DurationValue)).toThrow(TypeError);
  });

  it('throws RangeError for dots out of range', () => {
    expect(() => Duration.create('quarter', { dots: 4 })).toThrow(RangeError);
  });

  it('throws RangeError for negative dots', () => {
    expect(() => Duration.create('quarter', { dots: -1 })).toThrow(RangeError);
  });

  it('throws RangeError for invalid tuplet (non-integer)', () => {
    expect(() => Duration.create('eighth', { tuplet: { actual: 1.5, normal: 2 } })).toThrow(
      RangeError,
    );
  });

  it('throws RangeError for invalid tuplet (zero actual)', () => {
    expect(() => Duration.create('eighth', { tuplet: { actual: 0, normal: 2 } })).toThrow(
      RangeError,
    );
  });
});

describe('dotted durations', () => {
  it('dotted quarter = 3/8', () => {
    const d = Duration.create('quarter', { dots: 1 });
    expect(d.fraction()).toEqual({ numerator: 3, denominator: 8 });
  });

  it('double-dotted quarter = 7/16', () => {
    const d = Duration.create('quarter', { dots: 2 });
    expect(d.fraction()).toEqual({ numerator: 7, denominator: 16 });
  });

  it('triple-dotted quarter = 15/32', () => {
    const d = Duration.create('quarter', { dots: 3 });
    expect(d.fraction()).toEqual({ numerator: 15, denominator: 32 });
  });

  it('dotted half = 3/4', () => {
    const d = Duration.create('half', { dots: 1 });
    expect(d.fraction()).toEqual({ numerator: 3, denominator: 4 });
  });

  it('dotted eighth = 3/16', () => {
    const d = Duration.create('eighth', { dots: 1 });
    expect(d.fraction()).toEqual({ numerator: 3, denominator: 16 });
  });
});

describe('tuplet durations', () => {
  it('triplet eighth = 1/12', () => {
    const d = Duration.create('eighth', { tuplet: { actual: 3, normal: 2 } });
    expect(d.fraction()).toEqual({ numerator: 1, denominator: 12 });
  });

  it('triplet quarter = 1/6', () => {
    const d = Duration.create('quarter', { tuplet: { actual: 3, normal: 2 } });
    expect(d.fraction()).toEqual({ numerator: 1, denominator: 6 });
  });

  it('quintuplet sixteenth = 1/20 (1/16 * 4/5)', () => {
    const d = Duration.create('sixteenth', { tuplet: { actual: 5, normal: 4 } });
    expect(d.fraction()).toEqual({ numerator: 1, denominator: 20 });
  });

  it('three triplet-eighths sum to exactly one quarter', () => {
    const tripletEighth = Duration.create('eighth', { tuplet: { actual: 3, normal: 2 } });
    const sum = totalDurationFraction([tripletEighth, tripletEighth, tripletEighth]);
    expect(sum).toEqual({ numerator: 1, denominator: 4 });
  });
});

describe('rest and tie flags', () => {
  it('isRest defaults to false', () => {
    const d = Duration.create('quarter');
    expect(d.isRest).toBe(false);
  });

  it('isRest is set when option provided', () => {
    const d = Duration.create('quarter', { isRest: true });
    expect(d.isRest).toBe(true);
  });

  it('rest fraction is unchanged vs note fraction', () => {
    const note = Duration.create('quarter');
    const rest = Duration.create('quarter', { isRest: true });
    expect(rationalsEqual(note.fraction(), rest.fraction())).toBe(true);
  });

  it('isTied defaults to false', () => {
    const d = Duration.create('quarter');
    expect(d.isTied).toBe(false);
  });

  it('isTied is set when option provided', () => {
    const d = Duration.create('quarter', { isTied: true });
    expect(d.isTied).toBe(true);
  });

  it('tie flag does not change the fraction', () => {
    const note = Duration.create('quarter');
    const tied = Duration.create('quarter', { isTied: true });
    expect(rationalsEqual(note.fraction(), tied.fraction())).toBe(true);
  });

  it('asRest returns a rest version', () => {
    const d = Duration.create('quarter');
    const rest = d.asRest();
    expect(rest.isRest).toBe(true);
    expect(rationalsEqual(rest.fraction(), d.fraction())).toBe(true);
  });

  it('withTie sets tie flag', () => {
    const d = Duration.create('quarter');
    const tied = d.withTie(true);
    expect(tied.isTied).toBe(true);
    expect(rationalsEqual(tied.fraction(), d.fraction())).toBe(true);
  });

  it('withTie clears tie flag', () => {
    const d = Duration.create('quarter', { isTied: true });
    const untied = d.withTie(false);
    expect(untied.isTied).toBe(false);
  });
});

describe('Duration.beats', () => {
  it('quarter note = 1 beat in 4/4 (beat unit = quarter)', () => {
    const d = Duration.create('quarter');
    const beats = d.beats({ numerator: 1, denominator: 4 });
    expect(beats).toEqual({ numerator: 1, denominator: 1 });
  });

  it('dotted quarter = 1 beat in 6/8 (beat unit = dotted-quarter = 3/8)', () => {
    const d = Duration.create('quarter', { dots: 1 });
    const beats = d.beats({ numerator: 3, denominator: 8 });
    expect(beats).toEqual({ numerator: 1, denominator: 1 });
  });

  it('eighth note = 0.5 beats in 4/4', () => {
    const d = Duration.create('eighth');
    const beats = d.beats({ numerator: 1, denominator: 4 });
    expect(beats).toEqual({ numerator: 1, denominator: 2 });
  });
});

describe('Duration getters', () => {
  it('.value returns the base note value', () => {
    expect(Duration.create('quarter').value).toBe('quarter');
  });

  it('.dots returns the dot count', () => {
    expect(Duration.create('quarter', { dots: 2 }).dots).toBe(2);
  });

  it('.tuplet returns null for non-tuplet', () => {
    expect(Duration.create('quarter').tuplet).toBeNull();
  });

  it('.tuplet returns the ratio for a tuplet', () => {
    const triplet = Duration.create('eighth', { tuplet: { actual: 3, normal: 2 } });
    expect(triplet.tuplet).toEqual({ actual: 3, normal: 2 });
  });
});

describe('Duration.equals', () => {
  it('equal durations', () => {
    const a = Duration.create('quarter');
    const b = Duration.create('quarter');
    expect(a.equals(b)).toBe(true);
  });

  it('different values are not equal', () => {
    const a = Duration.create('quarter');
    const b = Duration.create('half');
    expect(a.equals(b)).toBe(false);
  });

  it('same fraction but different rest flag', () => {
    const a = Duration.create('quarter');
    const b = Duration.create('quarter', { isRest: true });
    expect(a.equals(b)).toBe(false);
  });

  it('same fraction but different isTied flag are not equal', () => {
    const a = Duration.create('quarter');
    const b = Duration.create('quarter', { isTied: true });
    expect(a.equals(b)).toBe(false);
  });
});

describe('Duration.toString and toStringTag', () => {
  it('quarter note', () => {
    expect(Duration.create('quarter').toString()).toBe('quarter');
  });

  it('dotted quarter', () => {
    expect(Duration.create('quarter', { dots: 1 }).toString()).toBe('quarter.');
  });

  it('triplet eighth', () => {
    expect(Duration.create('eighth', { tuplet: { actual: 3, normal: 2 } }).toString()).toBe(
      'eighth [3:2]',
    );
  });

  it('rest', () => {
    expect(Duration.create('quarter', { isRest: true }).toString()).toBe('quarter rest');
  });

  it('tied', () => {
    expect(Duration.create('quarter', { isTied: true }).toString()).toBe('quarter~');
  });

  it('toStringTag', () => {
    expect(Duration.create('quarter')[Symbol.toStringTag]).toBe('Duration(quarter)');
  });
});

describe('Duration.toJSON and fromJSON', () => {
  it('round-trips a simple duration', () => {
    const original = Duration.create('quarter');
    const json = original.toJSON();
    const restored = Duration.fromJSON(json);
    expect(restored.equals(original)).toBe(true);
  });

  it('round-trips a dotted duration', () => {
    const original = Duration.create('quarter', { dots: 1 });
    const restored = Duration.fromJSON(original.toJSON());
    expect(restored.equals(original)).toBe(true);
  });

  it('round-trips a tuplet duration', () => {
    const original = Duration.create('eighth', { tuplet: { actual: 3, normal: 2 } });
    const restored = Duration.fromJSON(original.toJSON());
    expect(restored.equals(original)).toBe(true);
  });

  it('round-trips a rest', () => {
    const original = Duration.create('quarter', { isRest: true });
    const restored = Duration.fromJSON(original.toJSON());
    expect(restored.isRest).toBe(true);
  });

  it('throws TypeError on tampered fraction', () => {
    const json = Duration.create('quarter').toJSON();
    const tampered = { ...json, fraction: { numerator: 1, denominator: 3 } };
    expect(() => Duration.fromJSON(tampered)).toThrow(TypeError);
  });
});

describe('totalDurationFraction', () => {
  it('sums four quarters = 1 whole', () => {
    const q = Duration.create('quarter');
    const sum = totalDurationFraction([q, q, q, q]);
    expect(sum).toEqual({ numerator: 1, denominator: 1 });
  });

  it('empty array = 0', () => {
    const sum = totalDurationFraction([]);
    expect(sum).toEqual({ numerator: 0, denominator: 1 });
  });
});

describe('property tests', () => {
  const VALUES: DurationValue[] = [
    'whole',
    'half',
    'quarter',
    'eighth',
    'sixteenth',
    'thirtySecond',
    'sixtyFourth',
  ];

  it('swing does not change written fraction (tie flag preservation)', () => {
    fc.assert(
      fc.property(fc.constantFrom(...VALUES), (v) => {
        const original = Duration.create(v);
        const tied = original.withTie(true);
        return rationalsEqual(original.fraction(), tied.fraction());
      }),
      { numRuns: 50 },
    );
  });

  it('asRest preserves fraction for all duration values', () => {
    fc.assert(
      fc.property(fc.constantFrom(...VALUES), (v) => {
        const original = Duration.create(v);
        const rest = original.asRest();
        return rationalsEqual(original.fraction(), rest.fraction());
      }),
      { numRuns: 50 },
    );
  });
});
