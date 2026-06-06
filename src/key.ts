import {
  identifyCadence as identifyCadenceForKey,
  identifyCadenceSequence as identifyCadenceSequenceForKey,
  type CadenceInput,
  type CadenceOccurrence,
  type CadenceType,
} from './cadence.js';
import {
  adjacentKeys,
  distanceInFifths as distanceInFifthsForSignatures,
  enharmonicEquivalent as enharmonicEquivalentSignature,
} from './circle-of-fifths.js';
import { Chord } from './chord.js';
import type { Interval } from './intervals.js';
import {
  KEY_SIGNATURES,
  keySignatureFor,
  type KeySignatureInformation,
  type KeySignatureMode,
} from './key-signature-catalog.js';
import { Note, type NoteLike } from './note.js';
import type { NoteName } from './note-spellings.js';
import { Scale } from './scale.js';
import { parseKeyParts } from './theory-parser-utils.js';

/**
 * A serialized snapshot of a {@link Key}.
 */
export type SerializedKey = {
  readonly tonic: NoteName;
  readonly mode: KeySignatureMode;
};

/**
 * Inputs accepted by {@link Key.create} when given a single argument.
 *
 * The object form's `tonic` accepts any `NoteLike` (including a `Note`
 * instance), so it's strictly wider than {@link SerializedKey} for runtime
 * use — `SerializedKey` is the type used for JSON snapshots specifically.
 */
export type KeyLike = Key | { readonly tonic: NoteLike; readonly mode: KeySignatureMode };

let createKey: (tonic: NoteName, mode: KeySignatureMode) => Key;

/**
 * A tonal key — a tonic plus a mode (`'major'` or `'minor'`) — with derived
 * scale, key signature, and standard related-key relationships.
 *
 * The v1 surface focuses on the keystone relationships needed by Phase 1
 * roadmap items: relative / parallel / dominant / subdominant keys,
 * diatonic chord generation, membership tests, and transposition.
 * Roman-numeral analysis, harmonic-function classification, modulation,
 * and cadence detection live in dedicated modules and add delegating
 * methods here in later items.
 */
export class Key {
  readonly #tonic: Note;
  readonly #mode: KeySignatureMode;
  readonly #signature: KeySignatureInformation;
  readonly #scale: Scale;

  /** @internal Use {@link Key.create} or {@link Key.fromJSON}. */
  protected constructor(tonic: NoteName, mode: KeySignatureMode) {
    this.#tonic = Note.create(tonic);
    this.#mode = mode;
    this.#signature = keySignatureFor(tonic, mode);
    if (this.#signature.accidentalPreference === 'theoretical') {
      // Theoretical keys (e.g., G♯ major) live in the catalog for
      // completeness, but `Key`'s relationship getters (`relativeKey`,
      // `dominantKey`, etc.) need standard targets that may fall outside
      // the catalog. Rather than half-support them, we reject at
      // construction. The catalog itself remains accessible via
      // `keySignatureFor`.
      throw new TypeError(
        `Key.create does not support theoretical keys (got "${tonic} ${mode}"); use ` +
          `keySignatureFor for catalog-only access, or use the enharmonic standard ` +
          `key (e.g., "Ab major" instead of "G# major").`,
      );
    }
    const scaleType = mode === 'major' ? 'major' : 'naturalMinor';
    this.#scale = Scale.create(this.#tonic, scaleType);
  }

  static {
    createKey = (tonic: NoteName, mode: KeySignatureMode) => new Key(tonic, mode);
  }

  /**
   * Parses a key name string into a {@link Key}.
   *
   * Accepted formats include `"C major"`, `"Bb major"`, and `"F# minor"`.
   *
   * @param name The key name string to parse.
   * @returns The parsed key.
   * @throws {TypeError} When the tonic or mode is unrecognized.
   */
  public static parse(name: string): Key {
    const { root, mode } = parseKeyParts(name);
    return Key.create(root, mode);
  }

  /**
   * Creates a key from a tonic and a mode.
   *
   * @throws {TypeError} when the tonic+mode combination has no entry in
   *   the key-signature catalog.
   */
  public static create(tonicOrLike: NoteLike | KeyLike, mode?: KeySignatureMode): Key {
    if (tonicOrLike instanceof Key) {
      if (mode !== undefined && mode !== tonicOrLike.mode) {
        throw new TypeError(
          `Key.create received a Key (${tonicOrLike.toString()}) AND a different mode ` +
            `("${mode}"). Use Key.create(key.tonic, mode) or key.parallelKey instead.`,
        );
      }
      return tonicOrLike;
    }
    if (typeof tonicOrLike === 'object' && tonicOrLike !== null && 'mode' in tonicOrLike) {
      const note = Note.create(tonicOrLike.tonic);
      return createKey(note.note, tonicOrLike.mode);
    }
    if (mode === undefined) {
      throw new TypeError(
        'Key.create requires both a tonic and a mode (e.g., Key.create("C", "major")).',
      );
    }
    const note = Note.create(tonicOrLike);
    return createKey(note.note, mode);
  }

  /**
   * Recreates a {@link Key} from a serialized snapshot.
   *
   * @throws {TypeError} when the serialized data does not name a key in
   *   the catalog.
   */
  public static fromJSON(value: SerializedKey): Key {
    return Key.create(value.tonic, value.mode);
  }

  /**
   * Returns true when the value is a constructed {@link Key}.
   */
  public static isKey(value: unknown): value is Key {
    return value instanceof Key;
  }

  /**
   * Returns the signed distance in fifths from `from` to `to`. Both keys
   * must be the same mode. Positive is clockwise (sharp direction);
   * negative is counter-clockwise (flat direction).
   */
  public static distanceInFifths(from: Key, to: Key): number {
    return distanceInFifthsForSignatures(from.signature, to.signature);
  }

  /**
   * Returns the dominant (clockwise) and subdominant (counter-clockwise)
   * neighbors of `key` on the circle of fifths.
   *
   * If a spelling-preserving neighbor is theoretical (e.g., the
   * subdominant of `Cb major` is spelled `Fb major`, which is in the
   * catalog as theoretical), the result resolves through the tonic's
   * enharmonics to the standard catalog spelling — the same
   * `resolveStandardKey` policy used by `relativeKey` and `parallelKey`.
   */
  public static adjacentKeys(key: Key): { readonly dominant: Key; readonly subdominant: Key } {
    const adjacent = adjacentKeys(key.signature);
    const dominantTonic = Note.create(adjacent.dominant.tonic);
    const subdominantTonic = Note.create(adjacent.subdominant.tonic);
    return {
      dominant: resolveStandardKey(
        dominantTonic,
        adjacent.dominant.mode,
        `${key.toString()}.dominantKey`,
      ),
      subdominant: resolveStandardKey(
        subdominantTonic,
        adjacent.subdominant.mode,
        `${key.toString()}.subdominantKey`,
      ),
    };
  }

  /**
   * Returns the enharmonic-equivalent spelling of `key` (F♯ ↔ G♭, etc.) or
   * `null` when the key has no standard enharmonic counterpart.
   */
  public static enharmonicEquivalent(key: Key): Key | null {
    const enharmonic = enharmonicEquivalentSignature(key.signature);
    if (enharmonic === null) {
      return null;
    }
    return Key.create(enharmonic.tonic, enharmonic.mode);
  }

  /**
   * The tonic of this key as a {@link Note}.
   */
  public get tonic(): Note {
    return this.#tonic;
  }

  /**
   * The mode of this key (`'major'` or `'minor'`).
   */
  public get mode(): KeySignatureMode {
    return this.#mode;
  }

  /**
   * The full key-signature record for this key.
   */
  public get signature(): KeySignatureInformation {
    return this.#signature;
  }

  /**
   * The diatonic scale of this key. Major keys use the major scale; minor
   * keys use the natural minor scale.
   */
  public get scale(): Scale {
    return this.#scale;
  }

  /**
   * The relative key — the key with the same key signature but the
   * opposite mode. Major's relative is the minor a third below; minor's
   * relative is the major a third above.
   */
  public get relativeKey(): Key {
    const targetMode: KeySignatureMode = this.#mode === 'major' ? 'minor' : 'major';
    const relativeTonic = this.#mode === 'major' ? this.#scale.degree(6) : this.#scale.degree(3);
    return resolveStandardKey(relativeTonic, targetMode, `${this.toString()}.relativeKey`);
  }

  /**
   * The parallel key — the same tonic, opposite mode.
   *
   * If the direct tonic+mode combination has no entry in the catalog
   * (e.g., D♭ minor isn't catalogued), the enharmonic equivalent of the
   * tonic is used (D♭ minor → C♯ minor).
   */
  public get parallelKey(): Key {
    const targetMode: KeySignatureMode = this.#mode === 'major' ? 'minor' : 'major';
    return resolveStandardKey(this.#tonic, targetMode, `${this.toString()}.parallelKey`);
  }

  /**
   * The key a perfect fifth above this one — the dominant on the circle.
   */
  public get dominantKey(): Key {
    return Key.adjacentKeys(this).dominant;
  }

  /**
   * The key a perfect fifth below this one — the subdominant on the circle.
   */
  public get subdominantKey(): Key {
    return Key.adjacentKeys(this).subdominant;
  }

  /**
   * Returns the seven diatonic triads of this key, in scale-degree order.
   */
  public diatonicChords(): readonly Chord[] {
    return this.#scale.chords();
  }

  /**
   * Returns the seven diatonic seventh chords of this key, in scale-degree order.
   */
  public diatonicSeventhChords(): readonly Chord[] {
    return this.#scale.seventhChords();
  }

  /**
   * Returns whether `value` (a note or chord) is a member of this key.
   *
   * For notes, membership is by pitch class — `Note.create('A4')` is in
   * C major regardless of octave.
   *
   * For chords, membership is true when every chord tone is a pitch
   * class of the diatonic scale.
   */
  public contains(value: Note | Chord): boolean {
    if (value instanceof Note) {
      return this.#scale.has(value);
    }
    for (const chordNote of value.notes) {
      if (!this.#scale.has(chordNote)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Identifies the cadence formed by two adjacent chords or Roman
   * numerals in this key.
   */
  public identifyCadence(first: CadenceInput, second: CadenceInput): CadenceType | null {
    return identifyCadenceForKey(this, first, second);
  }

  /**
   * Scans a progression for cadences between adjacent entries.
   */
  public identifyCadenceSequence(inputs: readonly CadenceInput[]): readonly CadenceOccurrence[] {
    return identifyCadenceSequenceForKey(this, inputs);
  }

  /**
   * Returns a new key transposed by the given interval.
   *
   * If the transposed tonic+mode combination falls outside the standard
   * catalog (e.g., transposing C♯ major by a perfect fifth lands on G♯
   * major, which is theoretical), the result resolves through the
   * tonic's enharmonic equivalents to the standard catalog spelling
   * (G♯ major → A♭ major). Same policy as `relativeKey`/`parallelKey`.
   */
  public transpose(interval: Interval): Key {
    const transposedTonic = this.#tonic.transpose(interval);
    return resolveStandardKey(
      transposedTonic,
      this.#mode,
      `${this.toString()}.transpose("${String(interval)}")`,
    );
  }

  /**
   * Returns a new key transposed by the given number of semitones.
   *
   * Same enharmonic-fallback policy as {@link transpose}.
   */
  public transposeBy(semitones: number): Key {
    const transposedTonic = this.#tonic.transposeBy(semitones);
    return resolveStandardKey(
      transposedTonic,
      this.#mode,
      `${this.toString()}.transposeBy(${semitones})`,
    );
  }

  /**
   * Returns true when `other` has the same tonic spelling and mode.
   */
  public equals(other: Key): boolean {
    return this.#tonic.note === other.#tonic.note && this.#mode === other.#mode;
  }

  /**
   * Returns true when `other` has the same tonic pitch class and mode.
   */
  public isEnharmonicTo(other: Key): boolean {
    return this.#tonic.chromaticIndex === other.#tonic.chromaticIndex && this.#mode === other.#mode;
  }

  /**
   * Returns the serialized snapshot for this key.
   */
  public toJSON(): SerializedKey {
    return {
      tonic: this.#tonic.note,
      mode: this.#mode,
    };
  }

  public toString(): `${NoteName} ${KeySignatureMode}` {
    return `${this.#tonic.note} ${this.#mode}`;
  }

  public get [Symbol.toStringTag](): `Key(${NoteName} ${KeySignatureMode})` {
    return `Key(${this.#tonic.note} ${this.#mode})`;
  }
}

/**
 * Builds a `Key` for a tonic+mode pair, trying the tonic's spelling first
 * and falling back through its enharmonic equivalents if the direct
 * combination has no standard catalog entry. Used by relationship getters
 * that may land on flat-side spellings whose mode isn't catalogued (e.g.,
 * D♭ minor → resolves to C♯ minor).
 *
 * @throws {TypeError} when neither the tonic nor any of its enharmonic
 *   equivalents has a standard entry for `mode`.
 */
function resolveStandardKey(tonic: Note, mode: KeySignatureMode, source: string): Key {
  if (isKnownKey(tonic.note, mode)) {
    return Key.create(tonic, mode);
  }
  for (const candidate of tonic.enharmonics) {
    if (isKnownKey(candidate, mode)) {
      return Key.create(candidate, mode);
    }
  }
  throw new TypeError(
    `${source} resolves to "${tonic.note} ${mode}", which has no standard catalog entry ` +
      `(nor any enharmonic spelling that does).`,
  );
}

/**
 * Returns whether a tonic + mode pair is constructible via {@link Key.create}.
 *
 * Theoretical keys (G♯ major, F♭ major, etc.) are present in
 * {@link KEY_SIGNATURES} for catalog completeness but NOT constructible as
 * `Key` instances — their relationship getters would fall outside the
 * catalog. Use {@link keySignatureFor} for catalog-only access.
 */
export function isKnownKey(tonic: NoteName, mode: KeySignatureMode): boolean {
  const id = `${tonic}-${mode}`;
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
  const signature = (KEY_SIGNATURES as Record<string, KeySignatureInformation | undefined>)[id];
  if (signature === undefined) {
    return false;
  }
  return signature.accidentalPreference !== 'theoretical';
}
