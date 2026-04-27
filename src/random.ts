import { resolveInterval } from './intervals.js';
import type { CanonicalInterval, Interval } from './intervals.js';
import { Note } from './note.js';
import type { NoteLike } from './note.js';

/**
 * A random-number source used by the random selection helpers.
 */
export type RandomFunction = () => number;

/**
 * Options for selecting a random note from either an inclusive MIDI range or an explicit pool.
 */
export type RandomNoteOptions =
  | { range: readonly [NoteLike, NoteLike]; pool?: never; random?: RandomFunction }
  | { pool: readonly NoteLike[]; range?: never; random?: RandomFunction };

/**
 * Options for selecting a random interval from a pool of interval names or aliases.
 */
export type RandomIntervalOptions = {
  pool: readonly Interval[];
  random?: RandomFunction;
};

function pick<T>(pool: readonly T[], random: RandomFunction): T {
  const value = random();

  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError(
      `Random function returned an invalid value: ${value}. Expected a finite number in [0, 1).`,
    );
  }

  // pool is guaranteed non-empty by callers; value is in [0, 1) so index is always valid
  return pool[Math.floor(value * pool.length)] as T;
}

function hasRangeOption(
  options: RandomNoteOptions | Record<string, unknown> | null | undefined,
): options is Extract<RandomNoteOptions, { range: readonly [NoteLike, NoteLike] }> {
  return typeof options === 'object' && options !== null && options.range !== undefined;
}

function hasPoolOption(
  options: RandomNoteOptions | Record<string, unknown> | null | undefined,
): options is Extract<RandomNoteOptions, { pool: readonly NoteLike[] }> {
  return typeof options === 'object' && options !== null && options.pool !== undefined;
}

function randomNoteFromRange(range: readonly [NoteLike, NoteLike], random: RandomFunction): Note {
  const start = Note.create(range[0]);
  const end = Note.create(range[1]);

  if (start.midi > end.midi) {
    throw new RangeError('range start must not be higher than range end');
  }

  const pool = Array.from({ length: Number(end.midi) - Number(start.midi) + 1 }, (_, index) =>
    Note.fromMidi(Number(start.midi) + index),
  );

  return pick(pool, random);
}

function randomNoteFromPool(pool: readonly NoteLike[], random: RandomFunction): Note {
  if (pool.length === 0) {
    throw new RangeError('pool must not be empty');
  }

  return pick(
    pool.map((entry) => Note.create(entry)),
    random,
  );
}

/**
 * Selects a random note from an inclusive range or an explicit pool of note-like values.
 *
 * @param options The selection source and optional random-number function.
 * @returns The selected note.
 * @throws {TypeError} When neither or both of `range` and `pool` are provided.
 * @throws {RangeError} When the range is descending, the pool is empty, or the random function returns an invalid value.
 */
export function randomNote(options: RandomNoteOptions): Note {
  const hasRange = hasRangeOption(options);
  const hasPool = hasPoolOption(options);

  if (!hasRange && !hasPool) {
    throw new TypeError('randomNote requires either range or pool');
  }

  if (hasRange && hasPool) {
    throw new TypeError('randomNote accepts range or pool, not both');
  }

  const random = options.random ?? Math.random;

  if (hasRange) {
    return randomNoteFromRange(options.range, random);
  }

  return randomNoteFromPool(options.pool, random);
}

/**
 * Selects a random interval from a pool, preserving duplicate aliases after canonicalization.
 *
 * @param options The interval pool and optional random-number function.
 * @returns The selected canonical interval name.
 * @throws {RangeError} When the pool is empty or the random function returns an invalid value.
 */
export function randomInterval(options: RandomIntervalOptions): CanonicalInterval {
  if (options.pool.length === 0) {
    throw new RangeError('pool must not be empty');
  }

  const random = options.random ?? Math.random;
  const pool = options.pool.map((interval) => resolveInterval(interval));

  return pick(pool, random);
}
