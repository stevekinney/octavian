import { Chord } from './chord.js';
import { Key } from './key.js';
import { Scale } from './scale.js';

// ---------------------------------------------------------------------------
// Chord parsing
// ---------------------------------------------------------------------------

/**
 * Parses a full chord name string into a {@link Chord}.
 *
 * Accepted formats:
 * - `"C"` — C major triad
 * - `"Am"` — A minor triad
 * - `"Cmaj7"` — C major seventh chord
 * - `"Cmaj7/E"` — C major seventh over E (first inversion; E is a chord tone)
 *
 * Slash chords are parsed as inversions: the bass note must be a chord tone
 * already present in the chord. Non-chord-tone pedal-point and polychord
 * slashes (e.g., `"Dm7/G"`) are not supported and will throw.
 *
 * @param name The chord name string to parse.
 * @returns The parsed chord.
 * @throws {TypeError} When the root or suffix is unrecognized, the slash bass
 *   note is not a valid note name, or the slash bass note is not a chord tone
 *   (slash chords are parsed as inversions only).
 */
export function parseChordName(name: string): Chord {
  return Chord.parse(name);
}

// ---------------------------------------------------------------------------
// Scale parsing
// ---------------------------------------------------------------------------

/**
 * Parses a full scale name string into a {@link Scale}.
 *
 * Accepted formats:
 * - `"C major"` — C major scale
 * - `"A natural minor"` — A natural minor scale
 * - `"F# melodic minor"` — F# melodic minor scale
 * - `"Db lydian"` — Db lydian scale
 *
 * @param name The scale name string to parse.
 * @returns The parsed scale.
 * @throws {TypeError} When the root or scale type is unrecognized.
 */
export function parseScaleName(name: string): Scale {
  return Scale.parse(name);
}

// ---------------------------------------------------------------------------
// Key parsing
// ---------------------------------------------------------------------------

/**
 * Parses a full key name string into a {@link Key}.
 *
 * Accepted formats:
 * - `"C major"` — C major key
 * - `"Bb major"` — B-flat major key
 * - `"F# minor"` — F-sharp minor key
 *
 * @param name The key name string to parse.
 * @returns The parsed key.
 * @throws {TypeError} When the tonic or mode is unrecognized, or the
 *   tonic/mode combination is a theoretical key not supported by
 *   {@link Key.create} (e.g., `"G# major"`).
 */
export function parseKeyName(name: string): Key {
  return Key.parse(name);
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

/**
 * Options for {@link formatChord}.
 */
export type FormatChordOptions = {
  /** When `true`, always use the slash-chord form even in root position. Defaults to `false`. */
  readonly forceSlash?: boolean;
};

/**
 * Returns the canonical display string for a chord.
 *
 * @param chord The chord to format.
 * @param options Optional formatting options.
 * @returns The chord display name string.
 */
export function formatChord(chord: Chord, options?: FormatChordOptions): string {
  if (options?.forceSlash === true) {
    return `${chord.root.note}${chord.symbol}/${chord.bass.note}`;
  }

  return chord.name;
}

/**
 * Returns the canonical display string for a scale.
 *
 * @param scale The scale to format.
 * @returns The scale display name string.
 */
export function formatScale(scale: Scale): string {
  return scale.toString();
}

/**
 * Returns the canonical display string for a key.
 *
 * @param key The key to format.
 * @returns The key display name string.
 */
export function formatKey(key: Key): string {
  return key.toString();
}
