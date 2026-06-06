import { describe, expect, it } from 'bun:test';
import * as fc from 'fast-check';
import {
  addRationals,
  compareRationals,
  createRational,
  divideRationals,
  formatRational,
  isZeroRational,
  multiplyRationals,
  ONE,
  rationalToNumber,
  rationalsEqual,
  subtractRationals,
  ZERO,
} from './rational.js';

describe('createRational', () => {
  it('reduces 2/4 to 1/2', () => {
    const r = createRational(2, 4);
    expect(r).toEqual({ numerator: 1, denominator: 2 });
  });

  it('reduces 6/4 to 3/2', () => {
    const r = createRational(6, 4);
    expect(r).toEqual({ numerator: 3, denominator: 2 });
  });

  it('always produces a positive denominator', () => {
    const r = createRational(1, -2);
    expect(r).toEqual({ numerator: -1, denominator: 2 });
  });

  it('normalizes zero to 0/1', () => {
    const r = createRational(0, 5);
    expect(r).toEqual({ numerator: 0, denominator: 1 });
  });

  it('throws on non-integer numerator', () => {
    expect(() => createRational(1.5, 2)).toThrow(RangeError);
  });

  it('throws on non-integer denominator', () => {
    expect(() => createRational(1, 1.5)).toThrow(RangeError);
  });

  it('throws when denominator is zero', () => {
    expect(() => createRational(1, 0)).toThrow(RangeError);
  });

  it('handles negative numerator', () => {
    const r = createRational(-3, 4);
    expect(r).toEqual({ numerator: -3, denominator: 4 });
  });
});

describe('addRationals', () => {
  it('adds 1/4 + 1/4 = 1/2', () => {
    const result = addRationals(createRational(1, 4), createRational(1, 4));
    expect(result).toEqual({ numerator: 1, denominator: 2 });
  });

  it('adds fractions with different denominators', () => {
    const result = addRationals(createRational(1, 3), createRational(1, 6));
    expect(result).toEqual({ numerator: 1, denominator: 2 });
  });

  it('computes 3 triplet-eighths = 1 quarter exactly', () => {
    // triplet eighth = 1/8 * 2/3 = 1/12
    const tripletEighth = createRational(1, 12);
    const sum = addRationals(addRationals(tripletEighth, tripletEighth), tripletEighth);
    expect(sum).toEqual({ numerator: 1, denominator: 4 });
  });
});

describe('subtractRationals', () => {
  it('subtracts 1/2 - 1/4 = 1/4', () => {
    const result = subtractRationals(createRational(1, 2), createRational(1, 4));
    expect(result).toEqual({ numerator: 1, denominator: 4 });
  });
});

describe('multiplyRationals', () => {
  it('multiplies 1/4 * 3/2 = 3/8 (dotted quarter)', () => {
    const result = multiplyRationals(createRational(1, 4), createRational(3, 2));
    expect(result).toEqual({ numerator: 3, denominator: 8 });
  });

  it('multiplies 1/8 * 2/3 = 1/12 (triplet eighth)', () => {
    const result = multiplyRationals(createRational(1, 8), createRational(2, 3));
    expect(result).toEqual({ numerator: 1, denominator: 12 });
  });
});

describe('divideRationals', () => {
  it('divides 1/4 / 1/4 = 1', () => {
    const result = divideRationals(createRational(1, 4), createRational(1, 4));
    expect(result).toEqual({ numerator: 1, denominator: 1 });
  });

  it('divides 3/4 / 3/8 = 2', () => {
    const result = divideRationals(createRational(3, 4), createRational(3, 8));
    expect(result).toEqual({ numerator: 2, denominator: 1 });
  });

  it('throws RangeError when the divisor is zero', () => {
    expect(() => divideRationals(createRational(1, 4), ZERO)).toThrow(RangeError);
  });
});

describe('rationalsEqual', () => {
  it('returns true for equal rationals', () => {
    expect(rationalsEqual(createRational(1, 2), createRational(2, 4))).toBe(true);
  });

  it('returns false for unequal rationals', () => {
    expect(rationalsEqual(createRational(1, 2), createRational(1, 3))).toBe(false);
  });
});

describe('compareRationals', () => {
  it('returns -1 when a < b', () => {
    expect(compareRationals(createRational(1, 4), createRational(1, 2))).toBe(-1);
  });

  it('returns 0 when equal', () => {
    expect(compareRationals(createRational(1, 2), createRational(2, 4))).toBe(0);
  });

  it('returns 1 when a > b', () => {
    expect(compareRationals(createRational(1, 2), createRational(1, 4))).toBe(1);
  });
});

describe('isZeroRational', () => {
  it('returns true for zero', () => {
    expect(isZeroRational(ZERO)).toBe(true);
  });

  it('returns false for non-zero', () => {
    expect(isZeroRational(ONE)).toBe(false);
  });
});

describe('rationalToNumber', () => {
  it('converts 1/4 to 0.25', () => {
    expect(rationalToNumber(createRational(1, 4))).toBe(0.25);
  });
});

describe('formatRational', () => {
  it('formats 1/4 as "1/4"', () => {
    expect(formatRational(createRational(1, 4))).toBe('1/4');
  });

  it('formats 1/1 as "1"', () => {
    expect(formatRational(ONE)).toBe('1');
  });
});

describe('ZERO and ONE constants', () => {
  it('ZERO is 0/1', () => {
    expect(ZERO).toEqual({ numerator: 0, denominator: 1 });
  });

  it('ONE is 1/1', () => {
    expect(ONE).toEqual({ numerator: 1, denominator: 1 });
  });
});

describe('property tests', () => {
  it('addition is commutative', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -100, max: 100 }),
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: -100, max: 100 }),
        fc.integer({ min: 1, max: 100 }),
        (an, ad, bn, bd) => {
          const a = createRational(an, ad);
          const b = createRational(bn, bd);
          const ab = addRationals(a, b);
          const ba = addRationals(b, a);
          return rationalsEqual(ab, ba);
        },
      ),
      { numRuns: 50 },
    );
  });

  it('a - b + b = a', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -100, max: 100 }),
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: -100, max: 100 }),
        fc.integer({ min: 1, max: 100 }),
        (an, ad, bn, bd) => {
          const a = createRational(an, ad);
          const b = createRational(bn, bd);
          return rationalsEqual(addRationals(subtractRationals(a, b), b), a);
        },
      ),
      { numRuns: 50 },
    );
  });

  it('multiplication is commutative', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -100, max: 100 }),
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: -100, max: 100 }),
        fc.integer({ min: 1, max: 100 }),
        (an, ad, bn, bd) => {
          const a = createRational(an, ad);
          const b = createRational(bn, bd);
          return rationalsEqual(multiplyRationals(a, b), multiplyRationals(b, a));
        },
      ),
      { numRuns: 50 },
    );
  });
});
