import { describe, expect, it } from 'bun:test';

import { Note } from './note.ts';
import { randomInterval, randomNote } from './random.ts';
import { STANDARD_TUNING } from './tuning.ts';

describe('randomNote', () => {
  describe('range basics', () => {
    it('picks the first note when the random value is 0', () => {
      const result = randomNote({ range: ['C4', 'G4'], random: () => 0 });

      expect(result).toBeInstanceOf(Note);
      expect(result.toString()).toBe('C4');
    });

    it('picks the middle note for a midpoint random value', () => {
      const result = randomNote({ range: ['C4', 'G4'], random: () => 0.5 });

      expect(result.toString()).toBe('E4');
    });

    it('picks the last note when the random value is near 1', () => {
      const result = randomNote({ range: ['C4', 'G4'], random: () => 0.9999 });

      expect(result.toString()).toBe('G4');
    });
  });

  describe('pool basics', () => {
    it('picks the first pool entry when the random value is 0', () => {
      const result = randomNote({ pool: ['C4', 'E4', 'G4'], random: () => 0 });

      expect(result.toString()).toBe('C4');
    });

    it('picks the middle pool entry for a midpoint random value', () => {
      const result = randomNote({ pool: ['C4', 'E4', 'G4'], random: () => 0.5 });

      expect(result.toString()).toBe('E4');
    });

    it('picks the last pool entry when the random value is near 1', () => {
      const result = randomNote({ pool: ['C4', 'E4', 'G4'], random: () => 0.9999 });

      expect(result.toString()).toBe('G4');
    });
  });

  it('consumes exactly one random call for a single-note range', () => {
    let count = 0;
    const random = () => {
      count += 1;
      return 0;
    };

    const result = randomNote({ range: ['A4', 'A4'], random });

    expect(count).toBe(1);
    expect(result.toString()).toBe('A4');
    expect(result.frequency).toBe(STANDARD_TUNING.frequency);
  });

  describe('errors', () => {
    it('requires either a range or a pool', () => {
      expect(() => Reflect.apply(randomNote, undefined, [{}])).toThrow(TypeError);
      expect(() => Reflect.apply(randomNote, undefined, [{}])).toThrow(/either range or pool/i);
    });

    it('rejects providing both a range and a pool', () => {
      const invalidOptions = {
        range: ['C4', 'D4'],
        pool: ['E4'],
      };

      expect(() => Reflect.apply(randomNote, undefined, [invalidOptions])).toThrow(TypeError);
      expect(() => Reflect.apply(randomNote, undefined, [invalidOptions])).toThrow(
        /range or pool, not both/i,
      );
    });

    it('rejects descending ranges', () => {
      expect(() => randomNote({ range: ['G4', 'C4'] })).toThrow(RangeError);
      expect(() => randomNote({ range: ['G4', 'C4'] })).toThrow(/range start/i);
    });

    it('rejects an empty pool', () => {
      expect(() => randomNote({ pool: [] })).toThrow(RangeError);
      expect(() => randomNote({ pool: [] })).toThrow(/pool must not be empty/i);
    });

    it('rejects NaN from the random function', () => {
      expect(() => randomNote({ pool: ['C4'], random: () => Number.NaN })).toThrow(RangeError);
      expect(() => randomNote({ pool: ['C4'], random: () => Number.NaN })).toThrow(/NaN/);
    });

    it('rejects negative random values', () => {
      expect(() => randomNote({ pool: ['C4'], random: () => -0.1 })).toThrow(RangeError);
      expect(() => randomNote({ pool: ['C4'], random: () => -0.1 })).toThrow(/-0\.1/);
    });

    it('rejects 1 from the random function', () => {
      expect(() => randomNote({ pool: ['C4'], random: () => 1 })).toThrow(RangeError);
      expect(() => randomNote({ pool: ['C4'], random: () => 1 })).toThrow(/\[0, 1\)/);
    });

    it('rejects values above 1 from the random function', () => {
      expect(() => randomNote({ pool: ['C4'], random: () => 1.5 })).toThrow(RangeError);
      expect(() => randomNote({ pool: ['C4'], random: () => 1.5 })).toThrow(/1\.5/);
    });
  });
});

describe('randomInterval', () => {
  it('preserves multiplicity after canonicalization', () => {
    // 'tritone' and 'augmentedFourth' both canonicalize to 'augmentedFourth';
    // 'perfectFifth' appears twice — multiplicity is preserved, not deduplicated.
    // Pool after canonicalization: ['augmentedFourth', 'augmentedFourth', 'majorThird']
    let index = 0;
    const random = () => index++ / 3;
    const options = { pool: ['tritone', 'augmentedFourth', 'majorThird'] as const, random };

    expect(Reflect.apply(randomInterval, undefined, [options])).toBe('augmentedFourth');
    expect(Reflect.apply(randomInterval, undefined, [options])).toBe('augmentedFourth');
    expect(Reflect.apply(randomInterval, undefined, [options])).toBe('majorThird');
  });

  describe('errors', () => {
    it('rejects an empty pool', () => {
      expect(() => randomInterval({ pool: [] })).toThrow(RangeError);
      expect(() => randomInterval({ pool: [] })).toThrow(/pool must not be empty/i);
    });

    it('rejects NaN from the random function', () => {
      expect(() => randomInterval({ pool: ['majorThird'], random: () => Number.NaN })).toThrow(
        RangeError,
      );
      expect(() => randomInterval({ pool: ['majorThird'], random: () => Number.NaN })).toThrow(
        /NaN/,
      );
    });

    it('rejects negative random values', () => {
      expect(() => randomInterval({ pool: ['majorThird'], random: () => -0.1 })).toThrow(
        RangeError,
      );
      expect(() => randomInterval({ pool: ['majorThird'], random: () => -0.1 })).toThrow(/-0\.1/);
    });

    it('rejects 1 from the random function', () => {
      expect(() => randomInterval({ pool: ['majorThird'], random: () => 1 })).toThrow(RangeError);
      expect(() => randomInterval({ pool: ['majorThird'], random: () => 1 })).toThrow(/\[0, 1\)/);
    });

    it('rejects values above 1 from the random function', () => {
      expect(() => randomInterval({ pool: ['majorThird'], random: () => 1.5 })).toThrow(RangeError);
      expect(() => randomInterval({ pool: ['majorThird'], random: () => 1.5 })).toThrow(/1\.5/);
    });
  });

  it('rejects an empty pool at runtime', () => {
    expect(() => Reflect.apply(randomInterval, undefined, [{ pool: [] }])).toThrow(RangeError);
    expect(() => Reflect.apply(randomInterval, undefined, [{ pool: [] }])).toThrow(
      /pool must not be empty/i,
    );
  });
});
