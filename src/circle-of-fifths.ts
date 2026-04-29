import {
  KEY_SIGNATURES,
  type KeySignatureInformation,
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
const ENHARMONIC_PAIRS: ReadonlyMap<string, string> = new Map([
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
  const circle = signature.mode === 'major' ? CIRCLE_OF_FIFTHS_MAJOR : CIRCLE_OF_FIFTHS_MINOR;
  const index = circle.indexOf(signature);
  if (index !== -1) {
    return index;
  }
  // The signature is a theoretical key (e.g., G#-major) or another spelling
  // not present at any cardinal position. Resolve via enharmonic equivalent.
  const id = keyId(signature);
  const enharmonicId = ENHARMONIC_PAIRS.get(id);
  if (enharmonicId === undefined) {
    throw new RangeError(`Key "${id}" is not on the circle of fifths.`);
  }
  return circle.findIndex((entry) => keyId(entry) === enharmonicId);
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
 * Returns the dominant (clockwise) and subdominant (counter-clockwise)
 * neighbors of the given key on the circle of fifths.
 */
export function adjacentKeys(signature: KeySignatureInformation): {
  readonly dominant: KeySignatureInformation;
  readonly subdominant: KeySignatureInformation;
} {
  const circle = signature.mode === 'major' ? CIRCLE_OF_FIFTHS_MAJOR : CIRCLE_OF_FIFTHS_MINOR;
  const index = indexOnCircle(signature);
  const dominantIndex = (index + 1) % 12;
  const subdominantIndex = (index + 11) % 12;
  return {
    dominant: circle[dominantIndex]!,
    subdominant: circle[subdominantIndex]!,
  };
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
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
  return KEY_SIGNATURES[enharmonicId as keyof typeof KEY_SIGNATURES];
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
