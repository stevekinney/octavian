import { describe, expect, it } from 'bun:test';
import * as fc from 'fast-check';

import { Chord } from './chord.ts';
import { Key } from './key.ts';
import { RomanNumeral } from './roman-numeral.ts';
import { Scale } from './scale.ts';
import { createSeededRandom } from './seeded-random.ts';
import {
  randomChord,
  randomRomanNumeral,
  randomRomanNumeralSequence,
  randomScale,
  randomScaleDegree,
} from './random-theory.ts';

// Generates a value in [0, 1) from an arbitrary integer in [0, 9999].
const randInUnit = fc.integer({ min: 0, max: 9999 }).map((n) => n / 10000);

// ---------------------------------------------------------------------------
// randomChord
// ---------------------------------------------------------------------------

describe('randomChord', () => {
  it('returns a Chord instance', () => {
    const result = randomChord({ random: createSeededRandom(1) });
    expect(result).toBeInstanceOf(Chord);
  });

  it('is deterministic with the same seeded random', () => {
    const result1 = randomChord({ random: createSeededRandom(42) });
    const result2 = randomChord({ random: createSeededRandom(42) });
    expect(result1.equals(result2)).toBe(true);
  });

  it('produces a fixed known chord for seed 1 (golden output)', () => {
    // Pinned against actual mulberry32(1) output — any PRNG regression breaks this.
    const result = randomChord({ random: createSeededRandom(1) });
    expect(result.name).toBe('G#');
  });

  it('picks the first root from the pool when random is 0', () => {
    const chord = randomChord({ roots: ['C', 'D', 'E'], random: () => 0 });
    expect(chord.root.note).toBe('C');
  });

  it('respects a roots pool', () => {
    fc.assert(
      fc.property(randInUnit, (rand) => {
        const chord = randomChord({ roots: ['C', 'G'], random: () => rand });
        const rootNote = chord.root.note;
        expect(['C', 'G']).toContain(rootNote);
      }),
      { numRuns: 50 },
    );
  });

  it('respects a suffixes pool', () => {
    fc.assert(
      fc.property(randInUnit, (rand) => {
        const chord = randomChord({ suffixes: ['major', 'minor'], random: () => rand });
        expect(['major', 'minor']).toContain(chord.suffix);
      }),
      { numRuns: 50 },
    );
  });

  it('respects a qualities filter', () => {
    fc.assert(
      fc.property(randInUnit, (rand) => {
        const chord = randomChord({ qualities: ['major'], random: () => rand });
        expect(chord.quality).toBe('major');
      }),
      { numRuns: 50 },
    );
  });

  it('restricts roots to key scale when key is supplied', () => {
    const key = Key.create('C', 'major');
    const keyNotes = new Set(key.scale.notes.map((n) => n.note));
    fc.assert(
      fc.property(randInUnit, (rand) => {
        const chord = randomChord({ key, random: () => rand });
        expect(keyNotes.has(chord.root.note)).toBe(true);
      }),
      { numRuns: 50 },
    );
  });

  it('applies the specified inversion', () => {
    const chord = randomChord({ suffixes: ['major'], inversion: 1, random: createSeededRandom(5) });
    expect(chord.inversionIndex).toBe(1);
  });

  describe('errors', () => {
    it('throws TypeError when suffixes + qualities combination produces no results', () => {
      // 'major' quality filtered against 'minor' suffix produces empty pool
      expect(() =>
        randomChord({ suffixes: ['minor'], qualities: ['major'], random: () => 0 }),
      ).toThrow(TypeError);
    });

    it('throws TypeError when the roots pool is an empty array', () => {
      expect(() => randomChord({ roots: [], random: () => 0 })).toThrow(TypeError);
    });
  });
});

// ---------------------------------------------------------------------------
// randomScale
// ---------------------------------------------------------------------------

describe('randomScale', () => {
  it('returns a Scale instance', () => {
    const result = randomScale({ random: createSeededRandom(1) });
    expect(result).toBeInstanceOf(Scale);
  });

  it('is deterministic with the same seeded random', () => {
    const result1 = randomScale({ random: createSeededRandom(77) });
    const result2 = randomScale({ random: createSeededRandom(77) });
    expect(result1.equals(result2)).toBe(true);
  });

  it('produces a fixed known scale for seed 2 (golden output)', () => {
    // Pinned against actual mulberry32(2) output — any PRNG regression breaks this.
    const result = randomScale({ random: createSeededRandom(2) });
    expect(result.toString()).toBe('Db phrygian');
  });

  it('respects an explicit types pool', () => {
    fc.assert(
      fc.property(randInUnit, (rand) => {
        const scale = randomScale({ types: ['major', 'naturalMinor'], random: () => rand });
        expect(['major', 'naturalMinor']).toContain(scale.type);
      }),
      { numRuns: 50 },
    );
  });

  it('respects an explicit roots pool', () => {
    fc.assert(
      fc.property(randInUnit, (rand) => {
        const scale = randomScale({ roots: ['C', 'G', 'D'], random: () => rand });
        expect(['C', 'G', 'D']).toContain(scale.root.note);
      }),
      { numRuns: 50 },
    );
  });

  describe('errors', () => {
    it('throws TypeError when the types pool is empty', () => {
      expect(() => randomScale({ types: [], random: () => 0 })).toThrow(TypeError);
    });

    it('throws TypeError when the roots pool is empty', () => {
      expect(() => randomScale({ roots: [], random: () => 0 })).toThrow(TypeError);
    });
  });
});

// ---------------------------------------------------------------------------
// randomRomanNumeral
// ---------------------------------------------------------------------------

describe('randomRomanNumeral', () => {
  it('returns a RomanNumeral instance', () => {
    const result = randomRomanNumeral({ random: createSeededRandom(1) });
    expect(result).toBeInstanceOf(RomanNumeral);
  });

  it('is deterministic with the same seeded random', () => {
    const result1 = randomRomanNumeral({ random: createSeededRandom(10) });
    const result2 = randomRomanNumeral({ random: createSeededRandom(10) });
    expect(result1.equals(result2)).toBe(true);
  });

  it('produces a fixed known numeral for seed 3 (golden output)', () => {
    // Pinned against actual mulberry32(3) output — any PRNG regression breaks this.
    const result = randomRomanNumeral({ random: createSeededRandom(3) });
    expect(result.toString()).toBe('VI');
  });

  describe('mode-derived default qualities', () => {
    it('degree 2 in major mode always yields minor quality', () => {
      const rn = randomRomanNumeral({ degrees: [2], mode: 'major', random: createSeededRandom(4) });
      expect(rn.degree).toBe(2);
      expect(rn.quality).toBe('minor');
    });

    it('degree 7 in major mode always yields diminished quality', () => {
      const rn = randomRomanNumeral({ degrees: [7], mode: 'major', random: createSeededRandom(5) });
      expect(rn.degree).toBe(7);
      expect(rn.quality).toBe('diminished');
    });

    it('degree 3 in minor mode always yields major quality', () => {
      const rn = randomRomanNumeral({ degrees: [3], mode: 'minor', random: createSeededRandom(6) });
      expect(rn.degree).toBe(3);
      expect(rn.quality).toBe('major');
    });

    it('degree 1 in minor mode always yields minor quality', () => {
      const rn = randomRomanNumeral({ degrees: [1], mode: 'minor', random: createSeededRandom(7) });
      expect(rn.degree).toBe(1);
      expect(rn.quality).toBe('minor');
    });

    it('explicit qualities override mode-derived quality', () => {
      // Degree 2 in major would normally be minor, but explicit 'major' wins
      const rn = randomRomanNumeral({
        degrees: [2],
        mode: 'major',
        qualities: ['major'],
        random: createSeededRandom(8),
      });
      expect(rn.quality).toBe('major');
    });

    it('mode-derived quality is consistent across all 7 major degrees', () => {
      const expectedMajor: Record<number, string> = {
        1: 'major',
        2: 'minor',
        3: 'minor',
        4: 'major',
        5: 'major',
        6: 'minor',
        7: 'diminished',
      };
      for (const [deg, expectedQuality] of Object.entries(expectedMajor)) {
        const degree = Number(deg) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
        const rn = randomRomanNumeral({ degrees: [degree], mode: 'major', random: () => 0 });
        expect(rn.quality).toBe(expectedQuality);
      }
    });

    it('mode-derived quality is consistent across all 7 minor degrees', () => {
      const expectedMinor: Record<number, string> = {
        1: 'minor',
        2: 'diminished',
        3: 'major',
        4: 'minor',
        5: 'minor',
        6: 'major',
        7: 'major',
      };
      for (const [deg, expectedQuality] of Object.entries(expectedMinor)) {
        const degree = Number(deg) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
        const rn = randomRomanNumeral({ degrees: [degree], mode: 'minor', random: () => 0 });
        expect(rn.quality).toBe(expectedQuality);
      }
    });
  });

  it('always produces root-position (5/3) inversions', () => {
    fc.assert(
      fc.property(randInUnit, (rand) => {
        const rn = randomRomanNumeral({ random: () => rand });
        expect(rn.inversion).toBe('5/3');
      }),
      { numRuns: 50 },
    );
  });

  it('respects a degrees pool', () => {
    fc.assert(
      fc.property(randInUnit, (rand) => {
        const rn = randomRomanNumeral({ degrees: [1, 4, 5], random: () => rand });
        expect([1, 4, 5]).toContain(rn.degree);
      }),
      { numRuns: 50 },
    );
  });

  it('respects a qualities pool', () => {
    fc.assert(
      fc.property(randInUnit, (rand) => {
        const rn = randomRomanNumeral({ qualities: ['major', 'minor'], random: () => rand });
        expect(['major', 'minor']).toContain(rn.quality);
      }),
      { numRuns: 50 },
    );
  });

  it('picks the first degree when random is 0', () => {
    const rn = randomRomanNumeral({ degrees: [2, 4, 6], random: () => 0 });
    expect(rn.degree).toBe(2);
  });

  describe('errors', () => {
    it('throws TypeError when the degree pool is empty', () => {
      expect(() => randomRomanNumeral({ degrees: [], random: () => 0 })).toThrow(TypeError);
    });

    it('throws TypeError when the quality pool is empty', () => {
      expect(() => randomRomanNumeral({ qualities: [], random: () => 0 })).toThrow(TypeError);
    });
  });
});

// ---------------------------------------------------------------------------
// randomRomanNumeralSequence
// ---------------------------------------------------------------------------

describe('randomRomanNumeralSequence', () => {
  it('returns an array of the requested length (default 4)', () => {
    const seq = randomRomanNumeralSequence({ random: createSeededRandom(1) });
    expect(seq).toHaveLength(4);
  });

  it('returns an array of the explicit length', () => {
    const seq = randomRomanNumeralSequence({ length: 8, random: createSeededRandom(1) });
    expect(seq).toHaveLength(8);
  });

  it('each element is a RomanNumeral instance', () => {
    const seq = randomRomanNumeralSequence({ length: 4, random: createSeededRandom(2) });
    for (const rn of seq) {
      expect(rn).toBeInstanceOf(RomanNumeral);
    }
  });

  it('is deterministic with the same seeded random', () => {
    const seq1 = randomRomanNumeralSequence({ length: 4, random: createSeededRandom(55) });
    const seq2 = randomRomanNumeralSequence({ length: 4, random: createSeededRandom(55) });
    expect(seq1.every((rn, i) => rn.equals(seq2[i]))).toBe(true);
  });

  it('is frozen (readonly)', () => {
    const seq = randomRomanNumeralSequence({ random: createSeededRandom(1) });
    expect(Object.isFrozen(seq)).toBe(true);
  });

  it('respects degree and quality constraints', () => {
    const seq = randomRomanNumeralSequence({
      length: 10,
      degrees: [1, 4, 5],
      qualities: ['major'],
      random: createSeededRandom(3),
    });
    for (const rn of seq) {
      expect([1, 4, 5]).toContain(rn.degree);
      expect(rn.quality).toBe('major');
    }
  });

  describe('errors', () => {
    it('throws RangeError when length is 0', () => {
      expect(() => randomRomanNumeralSequence({ length: 0 })).toThrow(RangeError);
    });

    it('throws RangeError when length is negative', () => {
      expect(() => randomRomanNumeralSequence({ length: -1 })).toThrow(RangeError);
    });

    it('throws RangeError when length is a non-integer', () => {
      expect(() => randomRomanNumeralSequence({ length: 1.5 })).toThrow(RangeError);
    });
  });
});

// ---------------------------------------------------------------------------
// randomScaleDegree
// ---------------------------------------------------------------------------

describe('randomScaleDegree', () => {
  it('returns a ScaleDegreeAnalysis with valid fields (Scale context)', () => {
    const context = Scale.create('C4', 'major');
    const result = randomScaleDegree({ context, random: createSeededRandom(1) });
    expect(typeof result.degree).toBe('number');
    expect(typeof result.alteration).toBe('string');
    expect(typeof result.semitoneFromTonic).toBe('number');
    expect(result.degree >= 1 && result.degree <= 7).toBe(true);
  });

  it('returns a ScaleDegreeAnalysis with valid fields (Key context)', () => {
    const context = Key.create('G', 'major');
    const result = randomScaleDegree({ context, random: createSeededRandom(2) });
    expect(result.degree >= 1 && result.degree <= 7).toBe(true);
  });

  it('is deterministic with the same seeded random', () => {
    const context = Scale.create('C4', 'major');
    const result1 = randomScaleDegree({ context, random: createSeededRandom(20) });
    const result2 = randomScaleDegree({ context, random: createSeededRandom(20) });
    expect(result1).toEqual(result2);
  });

  it('picks the first note in the scale when random is 0', () => {
    const context = Scale.create('C4', 'major');
    const result = randomScaleDegree({ context, random: () => 0 });
    // The first note in C major is C, which is degree 1 with no alteration.
    expect(result.degree).toBe(1);
    expect(result.alteration).toBe('');
  });

  it('always returns a degree in 1..7 for a heptatonic scale', () => {
    const context = Scale.create('F4', 'naturalMinor');
    fc.assert(
      fc.property(randInUnit, (rand) => {
        const result = randomScaleDegree({ context, random: () => rand });
        expect(result.degree >= 1 && result.degree <= 7).toBe(true);
      }),
      { numRuns: 50 },
    );
  });

  describe('errors', () => {
    it('throws RangeError for a non-heptatonic scale', () => {
      const pentatonic = Scale.create('C4', 'majorPentatonic');
      expect(() => randomScaleDegree({ context: pentatonic, random: () => 0 })).toThrow(RangeError);
    });
  });
});
