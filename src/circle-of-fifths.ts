import {
  KEY_SIGNATURES,
  type KeySignatureInformation,
  type KeySignatureKey,
  type KeySignatureMode,
} from './key-signature-catalog.js';
import type { NoteName } from './note-spellings.js';

/**
 * The 12 standard major-key positions on the circle of fifths, clockwise
 * from C at the top. Each position is the key signature whose tonic sits
 * there.
 *
 * Sharp keys go clockwise (C → G → D → A → E → B → F♯ / G♭). Flat keys go
 * counter-clockwise (C → F → B♭ → E♭ → A♭ → D♭ → G♭ / F♯). The bottom
 * position has two enharmonic spellings; we use the sharp form (F♯) here
 * and provide {@link enharmonicEquivalent} for the flat form.
 */
export const CIRCLE_OF_FIFTHS_MAJOR: readonly KeySignatureInformation[] = Object.freeze([
  KEY_SIGNATURES['C-major'],
  KEY_SIGNATURES['G-major'],
  KEY_SIGNATURES['D-major'],
  KEY_SIGNATURES['A-major'],
  KEY_SIGNATURES['E-major'],
  KEY_SIGNATURES['B-major'],
  KEY_SIGNATURES['F#-major'],
  KEY_SIGNATURES['Db-major'],
  KEY_SIGNATURES['Ab-major'],
  KEY_SIGNATURES['Eb-major'],
  KEY_SIGNATURES['Bb-major'],
  KEY_SIGNATURES['F-major'],
]);

/**
 * The 12 standard minor-key positions on the circle of fifths, clockwise
 * from A minor at the top. Each entry is the relative minor of the
 * corresponding major-key position in {@link CIRCLE_OF_FIFTHS_MAJOR}.
 */
export const CIRCLE_OF_FIFTHS_MINOR: readonly KeySignatureInformation[] = Object.freeze([
  KEY_SIGNATURES['A-minor'],
  KEY_SIGNATURES['E-minor'],
  KEY_SIGNATURES['B-minor'],
  KEY_SIGNATURES['F#-minor'],
  KEY_SIGNATURES['C#-minor'],
  KEY_SIGNATURES['G#-minor'],
  KEY_SIGNATURES['D#-minor'],
  KEY_SIGNATURES['Bb-minor'],
  KEY_SIGNATURES['F-minor'],
  KEY_SIGNATURES['C-minor'],
  KEY_SIGNATURES['G-minor'],
  KEY_SIGNATURES['D-minor'],
]);

/**
 * Enharmonic-equivalent pairs at the bottom of the circle, where sharp-side
 * and flat-side spellings refer to the same pitch class.
 */
const ENHARMONIC_PAIRS: ReadonlyMap<string, KeySignatureKey> = new Map<string, KeySignatureKey>([
  // Major pairs
  ['F#-major', 'Gb-major'],
  ['Gb-major', 'F#-major'],
  ['C#-major', 'Db-major'],
  ['Db-major', 'C#-major'],
  ['Cb-major', 'B-major'],
  ['B-major', 'Cb-major'],
  // Minor pairs
  ['D#-minor', 'Eb-minor'],
  ['Eb-minor', 'D#-minor'],
  ['G#-minor', 'Ab-minor'],
  ['Ab-minor', 'G#-minor'],
  ['A#-minor', 'Bb-minor'],
  ['Bb-minor', 'A#-minor'],
]);

function keyId(signature: KeySignatureInformation): string {
  return `${signature.tonic}-${signature.mode}`;
}

/**
 * Pre-computed `id → cardinal index` map for both circles, built once at
 * module load. Looking up a signature by its id (rather than by reference
 * via `Array.indexOf`) lets callers pass structurally-equivalent objects
 * without losing position resolution, and gives O(1) lookup.
 */
const CARDINAL_INDEX_BY_ID: ReadonlyMap<string, number> = (() => {
  const map = new Map<string, number>();
  for (let index = 0; index < CIRCLE_OF_FIFTHS_MAJOR.length; index++) {
    const entry = CIRCLE_OF_FIFTHS_MAJOR[index];
    if (entry !== undefined) {
      map.set(keyId(entry), index);
    }
  }
  for (let index = 0; index < CIRCLE_OF_FIFTHS_MINOR.length; index++) {
    const entry = CIRCLE_OF_FIFTHS_MINOR[index];
    if (entry !== undefined) {
      map.set(keyId(entry), index);
    }
  }
  return map;
})();

/**
 * Returns the full circle of fifths as an ordered array, starting at C
 * major (or A minor) and proceeding clockwise.
 *
 * @param mode Whether to return the major or minor circle. Defaults to
 *   `'major'`.
 */
export function circleOfFifths(
  mode: KeySignatureMode = 'major',
): readonly KeySignatureInformation[] {
  return mode === 'major' ? CIRCLE_OF_FIFTHS_MAJOR : CIRCLE_OF_FIFTHS_MINOR;
}

function indexOnCircle(signature: KeySignatureInformation): number {
  const id = keyId(signature);
  const direct = CARDINAL_INDEX_BY_ID.get(id);
  if (direct !== undefined) {
    return direct;
  }
  // The signature is a theoretical key or an enharmonic alternate spelling
  // not present at any cardinal position. Resolve via enharmonic equivalent.
  const enharmonicId = ENHARMONIC_PAIRS.get(id);
  if (enharmonicId === undefined) {
    throw new RangeError(`Key "${id}" is not on the circle of fifths.`);
  }
  // ENHARMONIC_PAIRS values are typed as KeySignatureKey, so they're
  // guaranteed members of CARDINAL_INDEX_BY_ID by construction.
  // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
  return CARDINAL_INDEX_BY_ID.get(enharmonicId)!;
}

/**
 * Returns the signed distance in fifths from `from` to `to`, in the range
 * `-6..6`. Positive values are clockwise (sharp direction); negative values
 * are counter-clockwise (flat direction). Both keys must be the same mode.
 *
 * @throws {TypeError} when the two keys differ in mode.
 * @throws {RangeError} when either key is not on the circle.
 */
export function distanceInFifths(
  from: KeySignatureInformation,
  to: KeySignatureInformation,
): number {
  if (from.mode !== to.mode) {
    throw new TypeError(
      `distanceInFifths requires keys of the same mode; got ${from.mode} and ${to.mode}.`,
    );
  }
  const fromIndex = indexOnCircle(from);
  const toIndex = indexOnCircle(to);
  let delta = toIndex - fromIndex;
  if (delta > 6) {
    delta -= 12;
  } else if (delta < -6) {
    delta += 12;
  }
  return delta;
}

/**
 * Spelling-preserving neighbors for keys that aren't on the cardinal
 * circle (theoretical or enharmonic alternates). Each entry maps a key
 * id to the dominant and subdominant id that match the key's spelling
 * family — e.g., the dominant of `C#-major` is `G#-major`, not `Ab-major`.
 *
 * Cardinal-circle keys aren't in this map; their neighbors come from the
 * `CIRCLE_OF_FIFTHS_*` arrays directly. Keys whose spelling-preserving
 * neighbors fall outside the catalog (e.g., the dominant of A#-major
 * would be E#-major, which isn't catalogued) are also omitted —
 * `adjacentKeys` falls through to the cardinal-circle path and throws
 * `RangeError` for those, indicating the relationship escapes the
 * library's coverage.
 */
const SPELLING_NEIGHBORS: ReadonlyMap<
  string,
  { readonly dominantId: string; readonly subdominantId: string }
> = new Map([
  // Sharp-side enharmonic alternates
  ['C#-major', { dominantId: 'G#-major', subdominantId: 'F#-major' }],
  ['G#-major', { dominantId: 'D#-major', subdominantId: 'C#-major' }],
  ['D#-major', { dominantId: 'A#-major', subdominantId: 'G#-major' }],
  // Flat-side enharmonic alternates
  ['Gb-major', { dominantId: 'Db-major', subdominantId: 'Cb-major' }],
  ['Cb-major', { dominantId: 'Gb-major', subdominantId: 'Fb-major' }],
  // Flat-side minor enharmonic alternate
  ['Eb-minor', { dominantId: 'Bb-minor', subdominantId: 'Ab-minor' }],
]);

/**
 * Returns the dominant (clockwise) and subdominant (counter-clockwise)
 * neighbors of the given key on the circle of fifths.
 *
 * For cardinal-circle keys, walks the circle directly. For enharmonic and
 * theoretical alternates (e.g., C♯ major, G♭ major), preserves the
 * caller's spelling family: the dominant of C♯ major is G♯ major (not
 * A♭ major); the dominant of G♭ major is D♭ major (not C♯ major).
 *
 * @throws {TypeError} when an enharmonic-alternate input has no
 *   spelling-preserving neighbor pair (e.g., a one-off theoretical key
 *   not represented in the spelling-neighbor map).
 */
export function adjacentKeys(signature: KeySignatureInformation): {
  readonly dominant: KeySignatureInformation;
  readonly subdominant: KeySignatureInformation;
} {
  const id = keyId(signature);
  // Enharmonic-alternate path: preserve spelling family.
  const spellingNeighbors = SPELLING_NEIGHBORS.get(id);
  if (spellingNeighbors !== undefined) {
    return {
      dominant: lookupSignatureById(spellingNeighbors.dominantId),
      subdominant: lookupSignatureById(spellingNeighbors.subdominantId),
    };
  }
  // Cardinal-circle path.
  const circle = signature.mode === 'major' ? CIRCLE_OF_FIFTHS_MAJOR : CIRCLE_OF_FIFTHS_MINOR;
  const index = indexOnCircle(signature);
  const dominantIndex = (index + 1) % 12;
  const subdominantIndex = (index + 11) % 12;
  // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
  return { dominant: circle[dominantIndex]!, subdominant: circle[subdominantIndex]! };
}

function lookupSignatureById(id: string): KeySignatureInformation {
  // SPELLING_NEIGHBORS only references catalog members (entries whose
  // neighbors fall outside the catalog are deliberately omitted), so the
  // lookup is safe by construction.
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
  return (KEY_SIGNATURES as Record<string, KeySignatureInformation | undefined>)[id]!;
}

/**
 * Returns the enharmonic-equivalent spelling of a key at the bottom of the
 * circle (F♯ major ↔ G♭ major, etc.) or `null` when the key has no
 * standard enharmonic counterpart.
 */
export function enharmonicEquivalent(
  signature: KeySignatureInformation,
): KeySignatureInformation | null {
  const enharmonicId = ENHARMONIC_PAIRS.get(keyId(signature));
  if (enharmonicId === undefined) {
    return null;
  }
  return KEY_SIGNATURES[enharmonicId];
}

/**
 * Returns whether a tonic + mode pair has an entry on the circle of fifths.
 */
export function isOnCircleOfFifths(tonic: NoteName, mode: KeySignatureMode): boolean {
  const id = `${tonic}-${mode}`;
  const circle = mode === 'major' ? CIRCLE_OF_FIFTHS_MAJOR : CIRCLE_OF_FIFTHS_MINOR;
  if (circle.some((entry) => keyId(entry) === id)) {
    return true;
  }
  return ENHARMONIC_PAIRS.has(id);
}
