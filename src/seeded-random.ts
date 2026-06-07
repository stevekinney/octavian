import type { RandomFunction } from './random.js';

/**
 * Creates a deterministic pseudo-random number generator using the mulberry32
 * algorithm. Given the same seed, the returned function always produces the
 * same sequence of values in [0, 1).
 *
 * The mulberry32 algorithm is a fast, high-quality 32-bit PRNG suitable for
 * seeded drills and reproducible tests.
 *
 * @param seed An integer seed value. The same seed always produces the same sequence.
 * @returns A {@link RandomFunction} that returns values in [0, 1).
 *
 * @example
 * const rng = createSeededRandom(42);
 * const value = rng(); // always the same for seed 42
 */
export function createSeededRandom(seed: number): RandomFunction {
  // Ensure we have a 32-bit unsigned integer as the initial state.
  let state = seed >>> 0;

  return (): number => {
    state += 0x6d2b79f5;
    let z = state;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    z = (z ^ (z >>> 14)) >>> 0;
    // Divide by 2^32 to produce a value in [0, 1).
    return z / 0x100000000;
  };
}
