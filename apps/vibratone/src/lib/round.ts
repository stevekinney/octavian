/**
 * Pure round-selection logic: choosing the next pitch to play, and the small
 * clamp/round helpers the octave slider shares. Randomness is injected so every
 * branch is deterministically testable.
 */

import { normalizePitchClass, type Pitch, type PitchClass } from './music.ts';

/** The lowest and highest octaves the app offers, inclusive. C2–C6. */
export const MIN_OCTAVE = 2;
export const MAX_OCTAVE = 6;

/** Returns an integer in `[0, count)`. Defaults to `Math.random`. */
export type RandomInt = (count: number) => number;

const defaultRandomInt: RandomInt = (count) => Math.floor(Math.random() * count);

export type CreatePromptOptions = {
	/** The pitch classes the user has marked eligible. */
	eligiblePitchClasses: Iterable<PitchClass>;
	/** Inclusive octave bounds; assumed `octaveLo <= octaveHi`. */
	octaveLo: number;
	octaveHi: number;
	/** Injectable randomness for deterministic tests. */
	randomInt?: RandomInt;
};

/** Every `{pc, octave}` permitted by the eligible pitch classes and octaves. */
export function buildPool(
	eligiblePitchClasses: Iterable<PitchClass>,
	octaveLo: number,
	octaveHi: number
): Pitch[] {
	const pitchClasses = [...new Set([...eligiblePitchClasses].map(normalizePitchClass))].sort(
		(a, b) => a - b
	);
	const pool: Pitch[] = [];
	for (let octave = octaveLo; octave <= octaveHi; octave++) {
		for (const pc of pitchClasses) {
			pool.push({ pc, octave });
		}
	}
	return pool;
}

/** The number of pitches available for the given eligibility settings. */
export function poolSize(
	eligiblePitchClasses: Iterable<PitchClass>,
	octaveLo: number,
	octaveHi: number
): number {
	const count = new Set([...eligiblePitchClasses].map(normalizePitchClass)).size;
	return count * Math.max(0, octaveHi - octaveLo + 1);
}

/**
 * Pick a uniformly random pitch from the eligible pool. Each call is
 * independent, so a pitch may repeat when the random draw selects it again.
 * Returns `null` when the pool is empty.
 */
export function createPrompt(options: CreatePromptOptions): Pitch | null {
	const { octaveLo, octaveHi, randomInt = defaultRandomInt } = options;
	const pool = buildPool(options.eligiblePitchClasses, octaveLo, octaveHi);
	if (pool.length === 0) return null;

	const index = randomInt(pool.length);
	return pool[Math.min(Math.max(index, 0), pool.length - 1)];
}

/** Clamp `value` to `[min, max]`. */
export function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

/** Clamp and round an octave to the nearest valid integer stop (C2–C6). */
export function clampOctave(value: number): number {
	return clamp(Math.round(value), MIN_OCTAVE, MAX_OCTAVE);
}

/**
 * Normalize a low/high octave pair into ordered, clamped integer stops with
 * `lo <= hi`. Swaps the pair if they arrive reversed.
 */
export function normalizeOctaveRange(lo: number, hi: number): [number, number] {
	const a = clampOctave(lo);
	const b = clampOctave(hi);
	return a <= b ? [a, b] : [b, a];
}
