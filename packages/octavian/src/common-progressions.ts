// common-progressions.ts: Catalog of named common harmonic progressions.
// Exported as a frozen array so callers can iterate or filter.

import { Progression } from './progression.js';

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

/**
 * A frozen array of common harmonic progressions drawn from common-practice
 * classical music and jazz. Each entry is a {@link Progression} that can be
 * materialized in any key via `.in(key)`.
 *
 * Included patterns:
 * - Authentic cadence (V–I)
 * - Plagal cadence (IV–I)
 * - ii–V–I (jazz staple)
 * - ii7–V7–I7 (jazz seventh-chord ii–V–I)
 * - I–vi–IV–V (50s progression)
 * - 12-bar blues (I–I–I–I–IV–IV–I–I–V–IV–I–V)
 * - Jazz turnaround (I–vi–ii–V)
 * - I–IV–V (classic rock three-chord)
 * - Circle-of-fifths sequence (I–IV–vii°–III–vi–ii–V–I)
 * - Andalusian cadence (i–bVII–bVI–V in minor)
 */
const CANONICAL_PROGRESSIONS: ReadonlyArray<{
  readonly name: string;
  readonly numerals: readonly string[];
}> = Object.freeze([
  {
    name: 'Authentic cadence',
    numerals: ['V', 'I'],
  },
  {
    name: 'Plagal cadence',
    numerals: ['IV', 'I'],
  },
  {
    name: 'ii–V–I',
    numerals: ['ii', 'V', 'I'],
  },
  {
    name: 'ii7–V7–Imaj7',
    numerals: ['ii7', 'V7', 'Imaj7'],
  },
  {
    name: 'I–vi–IV–V',
    numerals: ['I', 'vi', 'IV', 'V'],
  },
  {
    name: '12-bar blues',
    numerals: ['I', 'I', 'I', 'I', 'IV', 'IV', 'I', 'I', 'V', 'IV', 'I', 'V'],
  },
  {
    name: 'Jazz turnaround (I–vi–ii–V)',
    numerals: ['I', 'vi', 'ii', 'V'],
  },
  {
    name: 'I–IV–V',
    numerals: ['I', 'IV', 'V'],
  },
  {
    name: 'Circle of fifths (I–IV–vii°–III–vi–ii–V–I)',
    numerals: ['I', 'IV', 'vii°', 'III', 'vi', 'ii', 'V', 'I'],
  },
  {
    name: 'Andalusian cadence (minor)',
    numerals: ['i', 'bVII', 'bVI', 'V'],
  },
]);

/**
 * Returns the catalog of common harmonic progressions as a frozen array of
 * {@link Progression} instances.
 *
 * Each entry can be materialized in a key via `.in(key)`:
 *
 * @example
 * ```ts
 * const all = commonProgressions();
 * const iiVI = all.find(p => p.toString().includes('ii'));
 * const chords = iiVI?.in(Key.create('C', 'major')).chords;
 * ```
 */
export function commonProgressions(): readonly Progression[] {
  return COMMON_PROGRESSIONS_FROZEN;
}

// Build once at module load so repeated calls return the same objects.
const COMMON_PROGRESSIONS_FROZEN: readonly Progression[] = Object.freeze(
  CANONICAL_PROGRESSIONS.map(({ numerals }) => Progression.create(numerals)),
);

/**
 * Returns the named catalog entry matching `name` (case-insensitive substring
 * match), or `undefined` when no entry matches.
 */
export function findCommonProgression(name: string): Progression | undefined {
  const trimmed = name.trim();
  if (trimmed.length === 0) return undefined;
  const lower = trimmed.toLowerCase();
  const index = CANONICAL_PROGRESSIONS.findIndex((entry) =>
    entry.name.toLowerCase().includes(lower),
  );
  return index === -1 ? undefined : COMMON_PROGRESSIONS_FROZEN[index];
}

/**
 * Returns the human-readable name for the progression at `index` in the catalog,
 * or `undefined` when the index is out of range.
 */
export function commonProgressionName(index: number): string | undefined {
  return CANONICAL_PROGRESSIONS[index]?.name;
}
