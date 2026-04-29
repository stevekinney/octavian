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
 * Spelling-preserving overrides for individual neighbor directions where
 * the cardinal-circle lookup would produce the wrong spelling family.
 * Each direction is overridden independently — a key can have a
 * spelling-correct standard dominant without a spelling-correct
 * standard subdominant (or vice versa).
 *
 * Cardinal-path lookups produce structurally correct but sometimes
 * wrong-spelled neighbors at the seams (e.g., `Db-major`'s subdominant
 * via the cardinal circle is `F#-major` instead of the musically-spelled
 * `Gb-major`). The override maps below are consulted before the cardinal
 * path; missing entries fall through to cardinal lookup.
 *
 * Targets are guaranteed standard (non-theoretical) catalog members.
 * Spelling-preserving neighbors that would point at a theoretical key
 * are deliberately omitted — those directions fall through to the
 * cardinal path, which gives the standard enharmonic.
 */
const DOMINANT_SPELLING_OVERRIDES: ReadonlyMap<string, KeySignatureKey> = new Map<
  string,
  KeySignatureKey
>([
  ['Db-major', 'Ab-major'],
  ['Gb-major', 'Db-major'],
  ['Cb-major', 'Gb-major'],
  ['Eb-minor', 'Bb-minor'],
]);

const SUBDOMINANT_SPELLING_OVERRIDES: ReadonlyMap<string, KeySignatureKey> = new Map<
  string,
  KeySignatureKey
>([
  ['C#-major', 'F#-major'],
  ['Db-major', 'Gb-major'],
  ['Gb-major', 'Cb-major'],
  ['Eb-minor', 'Ab-minor'],
]);

/**
 * Returns the dominant (clockwise) and subdominant (counter-clockwise)
 * neighbors of the given key on the circle of fifths.
 *
 * For seam keys whose cardinal-circle neighbor would be wrong-spelled
 * (e.g., D♭ major's subdominant resolves to F♯ major on the cardinal
 * circle, but musically should be G♭ major), the per-direction overrides
 * in {@link DOMINANT_SPELLING_OVERRIDES} and
 * {@link SUBDOMINANT_SPELLING_OVERRIDES} apply. Directions that would
 * point at a theoretical key fall through to the cardinal path, which
 * gives the standard enharmonic spelling — `Key.adjacentKeys` further
 * normalizes through `resolveStandardKey` to keep all results
 * constructible as `Key` instances.
 */
export function adjacentKeys(signature: KeySignatureInformation): {
  readonly dominant: KeySignatureInformation;
  readonly subdominant: KeySignatureInformation;
} {
  const id = keyId(signature);
  const circle = signature.mode === 'major' ? CIRCLE_OF_FIFTHS_MAJOR : CIRCLE_OF_FIFTHS_MINOR;
  const index = indexOnCircle(signature);
  const dominantOverride = DOMINANT_SPELLING_OVERRIDES.get(id);
  const subdominantOverride = SUBDOMINANT_SPELLING_OVERRIDES.get(id);
  // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
  const cardinalDominant = circle[(index + 1) % 12]!;
  // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
  const cardinalSubdominant = circle[(index + 11) % 12]!;
  return {
    dominant:
      dominantOverride !== undefined ? lookupSignatureById(dominantOverride) : cardinalDominant,
    subdominant:
      subdominantOverride !== undefined
        ? lookupSignatureById(subdominantOverride)
        : cardinalSubdominant,
  };
}

function lookupSignatureById(id: KeySignatureKey): KeySignatureInformation {
  return KEY_SIGNATURES[id];
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
