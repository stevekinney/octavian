import type { NoteName } from './note-spellings.js';
import type { AccidentalPreference } from './key-signatures.js';

/**
 * The mode component of a key signature in the v1 catalog.
 *
 * Currently only major and minor — the two modes whose key-signature
 * conventions are firmly standardized in common-practice notation.
 */
export type KeySignatureMode = 'major' | 'minor';

/**
 * The accidental order on the staff for a key signature.
 *
 * - `'sharps'` — accidentals appear in the order F♯ C♯ G♯ D♯ A♯ E♯ B♯
 * - `'flats'` — accidentals appear in the order B♭ E♭ A♭ D♭ G♭ C♭ F♭
 * - `'none'` — no accidentals (C major, A minor)
 */
export type AccidentalOrder = 'sharps' | 'flats' | 'none';

/**
 * A complete key signature record.
 *
 * - `accidentalCount`: the number of accidental symbols that appear on the
 *   staff (8 for G♯ major, 10 for A♯ major, etc.).
 * - `accidentals`: one entry per affected letter, written in the standard
 *   F♯-C♯-G♯-… or B♭-E♭-A♭-… order. For theoretical keys with > 7
 *   symbols on the staff, the early letters are upgraded to their
 *   double-accidental form (G♯ major's F-letter becomes `F##`); the
 *   array therefore always has at most 7 entries.
 *
 * This means `accidentals.length` is the number of *letters affected* by
 * the key signature, while `accidentalCount` is the number of *symbols*
 * the engraver writes. They are equal for standard keys (1–7) and
 * diverge for theoretical keys.
 */
export type KeySignatureInformation = {
  readonly tonic: NoteName;
  readonly mode: KeySignatureMode;
  readonly accidentalCount: number;
  readonly accidentals: readonly NoteName[];
  readonly order: AccidentalOrder;
  readonly accidentalPreference: AccidentalPreference;
};

// Standard order of sharps as they appear on the staff: F♯, C♯, G♯, D♯,
// A♯, E♯, B♯. The same letter sequence is used to compute double-sharps in
// theoretical keys: G♯ major (8 sharps) replaces position 1's `F#` with
// `F##` because the scale's F-letter is now double-sharped.
const SHARP_LETTER_ORDER: readonly NoteName[] = ['F#', 'C#', 'G#', 'D#', 'A#', 'E#', 'B#'];
const SHARP_DOUBLE_LETTER_ORDER: readonly NoteName[] = [
  'F##',
  'C##',
  'G##',
  'D##',
  'A##',
  'E##',
  'B##',
];

// Standard order of flats: B♭, E♭, A♭, D♭, G♭, C♭, F♭. Theoretical keys
// with > 7 flats apply double-flats to the early letters in the same order.
const FLAT_LETTER_ORDER: readonly NoteName[] = ['Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb', 'Fb'];
const FLAT_DOUBLE_LETTER_ORDER: readonly NoteName[] = [
  'Bbb',
  'Ebb',
  'Abb',
  'Dbb',
  'Gbb',
  'Cbb',
  'Fbb',
];

function buildAccidentalsForCount(
  count: number,
  singles: readonly NoteName[],
  doubles: readonly NoteName[],
): readonly NoteName[] {
  // Up to 7: take the first `count` single-accidentals.
  // Above 7: every letter gets its single-accidental, and the first
  // `count - 7` letters are upgraded to their double-accidental form.
  if (count <= 7) {
    return singles.slice(0, count);
  }
  const result: NoteName[] = [];
  const doubled = count - 7;
  for (let i = 0; i < 7; i++) {
    result.push(i < doubled ? doubles[i]! : singles[i]!);
  }
  return result;
}

function buildSharpKey(
  tonic: NoteName,
  mode: KeySignatureMode,
  count: number,
  accidentalPreference: AccidentalPreference = 'sharps',
): KeySignatureInformation {
  return {
    tonic,
    mode,
    accidentalCount: count,
    accidentals: buildAccidentalsForCount(count, SHARP_LETTER_ORDER, SHARP_DOUBLE_LETTER_ORDER),
    order: count === 0 ? 'none' : 'sharps',
    accidentalPreference,
  };
}

function buildFlatKey(
  tonic: NoteName,
  mode: KeySignatureMode,
  count: number,
  accidentalPreference: AccidentalPreference = 'flats',
): KeySignatureInformation {
  return {
    tonic,
    mode,
    accidentalCount: count,
    accidentals: buildAccidentalsForCount(count, FLAT_LETTER_ORDER, FLAT_DOUBLE_LETTER_ORDER),
    order: count === 0 ? 'none' : 'flats',
    accidentalPreference,
  };
}

/**
 * The string keys present in {@link KEY_SIGNATURES}.
 *
 * Format: `${tonic}-${mode}` (e.g. `'Db-major'`, `'A-minor'`). Both
 * enharmonic spellings are present at the bottom of the circle (e.g.
 * `'F#-major'` and `'Gb-major'`).
 */
export type KeySignatureKey =
  | 'C-major'
  | 'G-major'
  | 'D-major'
  | 'A-major'
  | 'E-major'
  | 'B-major'
  | 'F#-major'
  | 'C#-major'
  | 'G#-major'
  | 'D#-major'
  | 'A#-major'
  | 'F-major'
  | 'Bb-major'
  | 'Eb-major'
  | 'Ab-major'
  | 'Db-major'
  | 'Gb-major'
  | 'Cb-major'
  | 'Fb-major'
  | 'A-minor'
  | 'E-minor'
  | 'B-minor'
  | 'F#-minor'
  | 'C#-minor'
  | 'G#-minor'
  | 'D#-minor'
  | 'A#-minor'
  | 'D-minor'
  | 'G-minor'
  | 'C-minor'
  | 'F-minor'
  | 'Bb-minor'
  | 'Eb-minor'
  | 'Ab-minor';

/**
 * Catalog of key signatures: 15 standard major keys, 15 standard minor keys,
 * and 4 theoretical major keys (G♯ / D♯ / A♯ major and F♭ major) that
 * complete the enharmonic chart. Theoretical entries are tagged
 * `accidentalPreference: 'theoretical'` and are excluded from
 * {@link keySignatureFromAccidentals} but accessible by name.
 *
 * Keyed by `${tonic}-${mode}` (tonic spelled per the conventional notation
 * for that key — e.g., `Db-major`, not `C#-major`). Enharmonic equivalents
 * (C♯ major and D♭ major) are both present.
 */
export const KEY_SIGNATURES: Readonly<Record<KeySignatureKey, KeySignatureInformation>> =
  Object.freeze({
    // Major keys — sharp side
    'C-major': buildSharpKey('C', 'major', 0),
    'G-major': buildSharpKey('G', 'major', 1),
    'D-major': buildSharpKey('D', 'major', 2),
    'A-major': buildSharpKey('A', 'major', 3),
    'E-major': buildSharpKey('E', 'major', 4),
    'B-major': buildSharpKey('B', 'major', 5),
    'F#-major': buildSharpKey('F#', 'major', 6),
    'C#-major': buildSharpKey('C#', 'major', 7),
    'G#-major': buildSharpKey('G#', 'major', 8, 'theoretical'),
    'D#-major': buildSharpKey('D#', 'major', 9, 'theoretical'),
    'A#-major': buildSharpKey('A#', 'major', 10, 'theoretical'),
    // Major keys — flat side
    'F-major': buildFlatKey('F', 'major', 1),
    'Bb-major': buildFlatKey('Bb', 'major', 2),
    'Eb-major': buildFlatKey('Eb', 'major', 3),
    'Ab-major': buildFlatKey('Ab', 'major', 4),
    'Db-major': buildFlatKey('Db', 'major', 5),
    'Gb-major': buildFlatKey('Gb', 'major', 6),
    'Cb-major': buildFlatKey('Cb', 'major', 7),
    'Fb-major': buildFlatKey('Fb', 'major', 8, 'theoretical'),
    // Minor keys — sharp side
    'A-minor': buildSharpKey('A', 'minor', 0),
    'E-minor': buildSharpKey('E', 'minor', 1),
    'B-minor': buildSharpKey('B', 'minor', 2),
    'F#-minor': buildSharpKey('F#', 'minor', 3),
    'C#-minor': buildSharpKey('C#', 'minor', 4),
    'G#-minor': buildSharpKey('G#', 'minor', 5),
    'D#-minor': buildSharpKey('D#', 'minor', 6),
    'A#-minor': buildSharpKey('A#', 'minor', 7),
    // Minor keys — flat side
    'D-minor': buildFlatKey('D', 'minor', 1),
    'G-minor': buildFlatKey('G', 'minor', 2),
    'C-minor': buildFlatKey('C', 'minor', 3),
    'F-minor': buildFlatKey('F', 'minor', 4),
    'Bb-minor': buildFlatKey('Bb', 'minor', 5),
    'Eb-minor': buildFlatKey('Eb', 'minor', 6),
    'Ab-minor': buildFlatKey('Ab', 'minor', 7),
  } satisfies Record<KeySignatureKey, KeySignatureInformation>);

/**
 * Look up a key signature by its tonic note name and mode.
 *
 * @throws {TypeError} when no signature exists for the given tonic+mode.
 */
export function keySignatureFor(tonic: NoteName, mode: KeySignatureMode): KeySignatureInformation {
  const key = `${tonic}-${mode}`;
  const signature = (
    KEY_SIGNATURES as Readonly<Record<string, KeySignatureInformation | undefined>>
  )[key];
  if (!signature) {
    throw new TypeError(`No key signature found for tonic "${tonic}" and mode "${mode}".`);
  }
  return signature;
}

function validateAccidentalArgs(count: number, order: AccidentalOrder): void {
  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError(`Accidental count must be a non-negative integer; got ${count}.`);
  }
  if (count === 0 && order !== 'none') {
    throw new RangeError(`Order must be 'none' when count is 0; got ${order}.`);
  }
  if (count > 0 && order === 'none') {
    throw new RangeError(`Order must be 'sharps' or 'flats' when count > 0; got ${order}.`);
  }
}

/**
 * Look up a key signature by its accidental count and order.
 *
 * Returns the standard (non-theoretical) major and minor keys with the given
 * accidental count and order. Always returns both modes when applicable so
 * the caller can pick the relevant one.
 *
 * @throws {RangeError} when count is out of valid range (0–8 for sharps,
 *   0–8 for flats; 0 must use order `'none'`).
 */
export function keySignatureFromAccidentals(
  count: number,
  order: AccidentalOrder,
): readonly KeySignatureInformation[] {
  validateAccidentalArgs(count, order);
  const matches = Object.values(KEY_SIGNATURES).filter(
    (signature) =>
      signature.accidentalCount === count &&
      signature.order === order &&
      signature.accidentalPreference !== 'theoretical',
  );
  if (matches.length === 0) {
    throw new RangeError(
      `No standard key signature with ${count} ${order === 'none' ? 'accidental' : order}.`,
    );
  }
  return Object.freeze(matches);
}
