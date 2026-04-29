import type { Chord } from './chord.js';
import type { Key } from './key.js';
import { romanNumeralFor } from './key-roman.js';
import type { RomanNumeral } from './roman-numeral.js';

/**
 * The functional role a diatonic chord plays in tonal harmony.
 *
 * - `'tonic'` — the chord of rest. I, iii, vi in major; i, III, VI in minor.
 *   These all share two pitches with the tonic triad and act as points of
 *   harmonic stability or substitutes for the tonic.
 * - `'predominant'` — chords that lead toward the dominant. ii, IV in
 *   major; ii°, iv in minor. Sometimes called "subdominant function";
 *   pedagogically `'subdominant'` is also accepted as an alias on the
 *   classification helper {@link harmonicFunctionFor}.
 * - `'dominant'` — chords that resolve to the tonic. V (with or without
 *   seventh) and vii° in major; the same plus the natural-minor VII and
 *   the harmonic-minor III in minor (the latter shares the leading tone).
 *
 * Returns `null` when no function classification applies — e.g., a
 * non-diatonic chord, an extended jazz chord, or a chord whose role
 * within the key is genuinely ambiguous. Future roadmap items extend the
 * recognition vocabulary (mixture in 2.11, secondary dominants in 2.12).
 */
export type HarmonicFunction = 'tonic' | 'predominant' | 'dominant';

/**
 * Returns the harmonic function of `chord` within `key`, or `null` when
 * no diatonic match applies.
 *
 * Recognition is based on the Roman-numeral analysis of the chord; if
 * `romanNumeralFor(key, chord)` returns null, this function does too.
 */
export function harmonicFunctionFor(key: Key, chord: Chord): HarmonicFunction | null {
  const numeral = romanNumeralFor(key, chord);
  if (numeral === null) {
    return null;
  }
  return harmonicFunctionForNumeral(numeral, key.mode);
}

/**
 * Returns the harmonic function of a {@link RomanNumeral} given a key
 * mode (`'major'` or `'minor'`), or `null` for non-functional numerals.
 *
 * Free function so callers who already have a `RomanNumeral` value
 * (e.g., from analyzing a progression) don't have to reconstruct the
 * chord just to query its function.
 */
export function harmonicFunctionForNumeral(
  numeral: RomanNumeral,
  mode: 'major' | 'minor',
): HarmonicFunction | null {
  // Altered or applied numerals fall outside the v1 diatonic surface.
  if (numeral.alteration !== undefined || numeral.applied !== undefined) {
    return null;
  }
  const table = mode === 'major' ? MAJOR_FUNCTION_TABLE : MINOR_FUNCTION_TABLE;
  return table[numeral.degree] ?? null;
}

const MAJOR_FUNCTION_TABLE: Readonly<Record<number, HarmonicFunction>> = {
  // Tonic group: I, iii, vi all share two tones with the tonic triad.
  1: 'tonic',
  3: 'tonic',
  6: 'tonic',
  // Predominant group: ii (and ii⁷) and IV move toward the dominant.
  2: 'predominant',
  4: 'predominant',
  // Dominant group: V (V⁷) and vii° pull back to the tonic.
  5: 'dominant',
  7: 'dominant',
};

const MINOR_FUNCTION_TABLE: Readonly<Record<number, HarmonicFunction>> = {
  // Tonic group: i, III (the relative major's tonic), VI.
  1: 'tonic',
  3: 'tonic',
  6: 'tonic',
  // Predominant group: ii° (the diatonic supertonic) and iv.
  2: 'predominant',
  4: 'predominant',
  // Dominant group: V (uppercase implies the harmonic-minor leading
  // tone), vii° (also harmonic-minor), VII (the natural-minor
  // sub-tonic — leads to tonic by step in natural-minor cadences).
  5: 'dominant',
  7: 'dominant',
};

/**
 * Pedagogical alias: in some teaching traditions the predominant function
 * is called "subdominant function". Returns whichever name the caller
 * prefers — the classification itself is identical.
 */
export type HarmonicFunctionAlias = 'tonic' | 'subdominant' | 'dominant';

/**
 * Returns the harmonic function of `chord` using the `'subdominant'`
 * alias for what {@link harmonicFunctionFor} calls `'predominant'`.
 */
export function harmonicFunctionForAsAlias(key: Key, chord: Chord): HarmonicFunctionAlias | null {
  const result = harmonicFunctionFor(key, chord);
  if (result === null) return null;
  return result === 'predominant' ? 'subdominant' : result;
}
