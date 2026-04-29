import type { Chord } from './chord.js';
import type { Key } from './key.js';
import { romanNumeralFor } from './key-roman.js';
import type { RomanNumeral, RomanNumeralDegree, RomanNumeralQuality } from './roman-numeral.js';

/**
 * The functional role a diatonic chord plays in tonal harmony.
 *
 * Classification names the chord's role within the prolongation of a
 * tonic; it does not describe pitch content alone. Chords that share
 * pitches with the tonic triad and behave as tonic substitutes (e.g.,
 * vi as a deceptive resolution target) are classified as `'tonic'`
 * even though their root is not scale degree 1.
 *
 * - `'tonic'` — the chord of rest, plus tonic substitutes. I, iii, vi
 *   in major; i, III, VI in minor. (III in minor is the relative-major
 *   tonic and is treated as a tonic substitute, not as a dominant —
 *   the harmonic-minor leading tone reaches the dominant via V/vii°,
 *   not via III.)
 * - `'predominant'` — chords that lead toward the dominant. ii, IV in
 *   major; ii°, iv in minor. Sometimes called "subdominant function";
 *   {@link harmonicFunctionForAsAlias} returns `'subdominant'` instead
 *   of `'predominant'` for callers preferring that pedagogical label.
 *   (Note: the alias is exposed by a separate function, not as a
 *   parameter on {@link harmonicFunctionFor}.)
 * - `'dominant'` — chords that resolve to the tonic. V (with or
 *   without seventh) and vii° in major; the same plus the
 *   natural-minor v (a weak diatonic dominant — it lacks the leading
 *   tone) and the natural-minor VII (sub-tonic, leads to tonic by
 *   step) in minor.
 *
 * Returns `null` when no function classification applies — for a
 * non-diatonic chord, an altered numeral (e.g., `♭III`), an applied
 * numeral (e.g., `V/V`), or a same-degree numeral whose quality
 * doesn't match the diatonic chord at that degree (a borrowed `i` in
 * major, an `IV` in minor, etc.). Future roadmap items extend the
 * recognition vocabulary (mixture in 2.11, secondary dominants in
 * 2.12).
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
 * Validates the full diatonic shape of the numeral — degree *and*
 * quality — so a same-degree numeral that doesn't match the diatonic
 * chord at that degree (e.g., a borrowed `i` in major, an `IV` in
 * minor) returns `null` instead of being classified by degree alone.
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
  // `RomanNumeralDegree` is the literal union 1..7 and both tables are
  // exhaustive, so the lookup is always defined.
  const entry = table[numeral.degree];
  if (!entry.qualities.has(numeral.quality)) {
    return null;
  }
  return entry.function;
}

type FunctionEntry = {
  readonly function: HarmonicFunction;
  readonly qualities: ReadonlySet<RomanNumeralQuality>;
};

// The two tables share the same {tonic, predominant, dominant}
// degree assignments (1/3/6, 2/4, 5/7) but differ in the diatonic
// qualities at each degree (e.g., ii is minor in major, ii° is
// diminished in minor; III is major in minor, iii is minor in major).
// Keeping them as separate literals makes the per-mode quality set
// directly readable rather than requiring a derivation pass.
const MAJOR_FUNCTION_TABLE: Readonly<Record<RomanNumeralDegree, FunctionEntry>> = {
  // Tonic group: I, iii, vi all share two tones with the tonic triad.
  1: { function: 'tonic', qualities: new Set(['major']) },
  3: { function: 'tonic', qualities: new Set(['minor']) },
  6: { function: 'tonic', qualities: new Set(['minor']) },
  // Predominant group: ii (and ii⁷) and IV move toward the dominant.
  2: { function: 'predominant', qualities: new Set(['minor']) },
  4: { function: 'predominant', qualities: new Set(['major']) },
  // Dominant group: V (V⁷) and vii° pull back to the tonic.
  5: { function: 'dominant', qualities: new Set(['major']) },
  7: { function: 'dominant', qualities: new Set(['diminished']) },
};

const MINOR_FUNCTION_TABLE: Readonly<Record<RomanNumeralDegree, FunctionEntry>> = {
  // Tonic group: i, III (the relative major's tonic — a tonic
  // substitute, not a dominant), VI.
  1: { function: 'tonic', qualities: new Set(['minor']) },
  3: { function: 'tonic', qualities: new Set(['major']) },
  6: { function: 'tonic', qualities: new Set(['major']) },
  // Predominant group: ii° (the diatonic supertonic) and iv.
  2: { function: 'predominant', qualities: new Set(['diminished']) },
  4: { function: 'predominant', qualities: new Set(['minor']) },
  // Dominant group: harmonic-minor V (uppercase implies the raised
  // leading tone) and natural-minor v (weak dominant, no leading
  // tone) both classify as dominant; vii° is the harmonic-minor
  // leading-tone chord; VII is the natural-minor sub-tonic, which
  // leads to tonic by step.
  5: { function: 'dominant', qualities: new Set(['major', 'minor']) },
  7: { function: 'dominant', qualities: new Set(['major', 'diminished']) },
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
