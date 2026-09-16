import { describe, expect, it } from 'bun:test';
import * as fc from 'fast-check';
import {
  createRatio,
  justIntonationRatiosFor,
  justRatioForSemitone,
  ratioCents,
  ratioValue,
  type Ratio,
} from './just-intonation.js';

describe('createRatio', () => {
  it('creates a valid ratio', () => {
    const ratio = createRatio(3, 2);
    expect(ratio.numerator).toBe(3);
    expect(ratio.denominator).toBe(2);
  });

  it('throws RangeError for non-positive numerator', () => {
    expect(() => createRatio(0, 2)).toThrow(RangeError);
    expect(() => createRatio(-1, 2)).toThrow(RangeError);
  });

  it('throws RangeError for non-integer numerator', () => {
    expect(() => createRatio(1.5, 2)).toThrow(RangeError);
  });

  it('throws RangeError for non-positive denominator', () => {
    expect(() => createRatio(3, 0)).toThrow(RangeError);
    expect(() => createRatio(3, -1)).toThrow(RangeError);
  });

  it('throws RangeError for non-integer denominator', () => {
    expect(() => createRatio(3, 1.5)).toThrow(RangeError);
  });

  it('accepts 1/1 (unison)', () => {
    const ratio = createRatio(1, 1);
    expect(ratioValue(ratio)).toBe(1);
  });
});

describe('ratioValue', () => {
  it('returns numerator/denominator as a float', () => {
    expect(ratioValue({ numerator: 3, denominator: 2 })).toBe(1.5);
    expect(ratioValue({ numerator: 9, denominator: 8 })).toBe(1.125);
  });

  it('1/1 = 1.0 exactly', () => {
    expect(ratioValue({ numerator: 1, denominator: 1 })).toBe(1);
  });
});

describe('ratioCents', () => {
  it('unison 1/1 = 0 cents', () => {
    expect(ratioCents({ numerator: 1, denominator: 1 })).toBe(0);
  });

  it('octave 2/1 = 1200 cents', () => {
    expect(ratioCents({ numerator: 2, denominator: 1 })).toBeCloseTo(1200, 6);
  });

  it('perfect fifth 3/2 ≈ 701.955 cents', () => {
    expect(ratioCents({ numerator: 3, denominator: 2 })).toBeCloseTo(701.955, 2);
  });

  it('major third 5/4 ≈ 386.314 cents', () => {
    expect(ratioCents({ numerator: 5, denominator: 4 })).toBeCloseTo(386.314, 2);
  });

  it('major second 9/8 ≈ 203.910 cents', () => {
    expect(ratioCents({ numerator: 9, denominator: 8 })).toBeCloseTo(203.91, 2);
  });

  it('perfect fourth 4/3 ≈ 498.045 cents', () => {
    expect(ratioCents({ numerator: 4, denominator: 3 })).toBeCloseTo(498.045, 2);
  });

  it('major sixth 5/3 ≈ 884.359 cents', () => {
    expect(ratioCents({ numerator: 5, denominator: 3 })).toBeCloseTo(884.359, 2);
  });

  it('major seventh 15/8 ≈ 1088.269 cents', () => {
    expect(ratioCents({ numerator: 15, denominator: 8 })).toBeCloseTo(1088.269, 2);
  });
});

describe('justRatioForSemitone', () => {
  it('returns 1/1 for semitone 0 (unison)', () => {
    const ratio = justRatioForSemitone(0);
    expect(ratio.numerator).toBe(1);
    expect(ratio.denominator).toBe(1);
  });

  it('returns 9/8 for semitone 2 (major 2nd)', () => {
    const ratio = justRatioForSemitone(2);
    expect(ratio.numerator).toBe(9);
    expect(ratio.denominator).toBe(8);
  });

  it('returns 5/4 for semitone 4 (major 3rd)', () => {
    const ratio = justRatioForSemitone(4);
    expect(ratio.numerator).toBe(5);
    expect(ratio.denominator).toBe(4);
  });

  it('returns 4/3 for semitone 5 (perfect 4th)', () => {
    const ratio = justRatioForSemitone(5);
    expect(ratio.numerator).toBe(4);
    expect(ratio.denominator).toBe(3);
  });

  it('returns 3/2 for semitone 7 (perfect 5th)', () => {
    const ratio = justRatioForSemitone(7);
    expect(ratio.numerator).toBe(3);
    expect(ratio.denominator).toBe(2);
  });

  it('returns 5/3 for semitone 9 (major 6th)', () => {
    const ratio = justRatioForSemitone(9);
    expect(ratio.numerator).toBe(5);
    expect(ratio.denominator).toBe(3);
  });

  it('returns 15/8 for semitone 11 (major 7th)', () => {
    const ratio = justRatioForSemitone(11);
    expect(ratio.numerator).toBe(15);
    expect(ratio.denominator).toBe(8);
  });

  it('throws TypeError for semitone 1 (not in major scale)', () => {
    expect(() => justRatioForSemitone(1)).toThrow(TypeError);
  });

  it('throws TypeError for semitone 3 (not in major scale)', () => {
    expect(() => justRatioForSemitone(3)).toThrow(TypeError);
  });

  it('throws TypeError for semitone 6 (not in major scale)', () => {
    expect(() => justRatioForSemitone(6)).toThrow(TypeError);
  });

  it('throws TypeError for semitone 8 (not in major scale)', () => {
    expect(() => justRatioForSemitone(8)).toThrow(TypeError);
  });

  it('throws TypeError for semitone 10 (not in major scale)', () => {
    expect(() => justRatioForSemitone(10)).toThrow(TypeError);
  });
});

describe('justIntonationRatiosFor', () => {
  it('returns 7 ratios for the major scale', () => {
    const ratios = justIntonationRatiosFor('major');
    expect(ratios.length).toBe(7);
  });

  it('returns the exact 5-limit major scale ratios in order', () => {
    const ratios = justIntonationRatiosFor('major');
    const expected: Ratio[] = [
      { numerator: 1, denominator: 1 }, // unison
      { numerator: 9, denominator: 8 }, // M2
      { numerator: 5, denominator: 4 }, // M3
      { numerator: 4, denominator: 3 }, // P4
      { numerator: 3, denominator: 2 }, // P5
      { numerator: 5, denominator: 3 }, // M6
      { numerator: 15, denominator: 8 }, // M7
    ];

    for (let i = 0; i < expected.length; i += 1) {
      expect(ratios[i].numerator).toBe(expected[i].numerator);
      expect(ratios[i].denominator).toBe(expected[i].denominator);
    }
  });

  it('accepts ionian as an alias for major', () => {
    const major = justIntonationRatiosFor('major');
    const ionian = justIntonationRatiosFor('ionian');
    expect(major.length).toBe(ionian.length);

    for (let i = 0; i < major.length; i += 1) {
      expect(ionian[i].numerator).toBe(major[i].numerator);
      expect(ionian[i].denominator).toBe(major[i].denominator);
    }
  });

  it('throws RangeError for unsupported scale types', () => {
    expect(() => justIntonationRatiosFor('minor')).toThrow(RangeError);
    expect(() => justIntonationRatiosFor('dorian')).toThrow(RangeError);
    expect(() => justIntonationRatiosFor('chromatic')).toThrow(RangeError);
    expect(() => justIntonationRatiosFor('naturalMinor')).toThrow(RangeError);
  });

  it('returns a frozen array', () => {
    const ratios = justIntonationRatiosFor('major');
    expect(Object.isFrozen(ratios)).toBe(true);
  });

  it('property: all ratios are ascending in value', () => {
    const ratios = justIntonationRatiosFor('major');

    for (let i = 1; i < ratios.length; i += 1) {
      expect(ratioValue(ratios[i])).toBeGreaterThan(ratioValue(ratios[i - 1]));
    }
  });

  it('property: all ratios are in (0, 2) — within one octave', () => {
    fc.assert(
      fc.property(fc.constant(justIntonationRatiosFor('major')), (ratios) => {
        for (const ratio of ratios) {
          const v = ratioValue(ratio);
          expect(v).toBeGreaterThanOrEqual(1);
          expect(v).toBeLessThan(2);
        }
      }),
      { numRuns: 50 },
    );
  });
});
