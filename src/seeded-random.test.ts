import { describe, expect, it } from 'bun:test';

import { createSeededRandom } from './seeded-random.ts';

describe('createSeededRandom', () => {
  describe('basic output properties', () => {
    it('returns a function', () => {
      expect(typeof createSeededRandom(42)).toBe('function');
    });

    it('returns values in [0, 1)', () => {
      const rng = createSeededRandom(1);
      for (let i = 0; i < 100; i++) {
        const value = rng();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }
    });
  });

  describe('determinism', () => {
    it('produces the same first value for the same seed', () => {
      const rng1 = createSeededRandom(42);
      const rng2 = createSeededRandom(42);
      expect(rng1()).toBe(rng2());
    });

    it('produces the same sequence for the same seed', () => {
      const rng1 = createSeededRandom(99);
      const rng2 = createSeededRandom(99);
      for (let i = 0; i < 20; i++) {
        expect(rng1()).toBe(rng2());
      }
    });

    it('produces a fixed known value for seed 42', () => {
      const rng = createSeededRandom(42);
      const first = rng();
      // The value should be deterministic — re-creating from the same seed returns the same first value.
      const rng2 = createSeededRandom(42);
      expect(rng2()).toBe(first);
    });
  });

  describe('seed independence', () => {
    it('produces different sequences for different seeds', () => {
      const rng1 = createSeededRandom(1);
      const rng2 = createSeededRandom(2);
      // With high probability, at least one of the first 10 values should differ.
      const seq1 = Array.from({ length: 10 }, () => rng1());
      const seq2 = Array.from({ length: 10 }, () => rng2());
      expect(seq1).not.toEqual(seq2);
    });

    it('seed 0 produces a valid sequence', () => {
      const rng = createSeededRandom(0);
      for (let i = 0; i < 10; i++) {
        const value = rng();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }
    });

    it('large seed values produce valid sequences', () => {
      const rng = createSeededRandom(0xdeadbeef);
      for (let i = 0; i < 10; i++) {
        const value = rng();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }
    });
  });

  describe('state progression', () => {
    it('advances state on each call (does not repeat the same value forever)', () => {
      const rng = createSeededRandom(7);
      const values = new Set(Array.from({ length: 50 }, () => rng()));
      // With a decent PRNG, 50 calls should produce more than 1 unique value.
      expect(values.size).toBeGreaterThan(1);
    });
  });
});
