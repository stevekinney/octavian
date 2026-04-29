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
  type KeySignatureKey,
  type KeySignatureMode,
} from './key-signature-catalog.js';
import { Note, type NoteLike } from './note.js';
import type { NoteName } from './note-spellings.js';
import { Scale } from './scale.js';

/**
 * A serialized snapshot of a {@link Key}.
 */
export type SerializedKey = {
  readonly tonic: NoteName;
  readonly mode: KeySignatureMode;
};

/**
 * Inputs accepted by {@link Key.create}.
 */
export type KeyLike =
  | Key
  | SerializedKey
  | { readonly tonic: NoteLike; readonly mode: KeySignatureMode };

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
    const scaleType = mode === 'major' ? 'major' : 'naturalMinor';
    this.#scale = Scale.create(this.#tonic, scaleType);
  }

  static {
    createKey = (tonic: NoteName, mode: KeySignatureMode) => new Key(tonic, mode);
  }

  /**
   * Creates a key from a tonic and a mode.
   *
   * @throws {TypeError} when the tonic+mode combination has no entry in
   *   the key-signature catalog.
   */
  public static create(tonicOrLike: NoteLike | KeyLike, mode?: KeySignatureMode): Key {
    if (tonicOrLike instanceof Key) {
      return tonicOrLike;
    }
    if (typeof tonicOrLike === 'object' && tonicOrLike !== null && 'mode' in tonicOrLike) {
      const note = Note.create(tonicOrLike.tonic);
      return createKey(note.note, tonicOrLike.mode);
    }
    if (mode === undefined) {
      throw new TypeError('Key.create requires both a tonic and a mode.');
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
   */
  public static adjacentKeys(key: Key): { readonly dominant: Key; readonly subdominant: Key } {
    const adjacent = adjacentKeys(key.signature);
    return {
      dominant: Key.create(adjacent.dominant.tonic, adjacent.dominant.mode),
      subdominant: Key.create(adjacent.subdominant.tonic, adjacent.subdominant.mode),
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
    if (this.#mode === 'major') {
      // Relative minor's tonic is the 6th scale degree.
      const relativeTonic = this.#scale.degree(6);
      return Key.create(relativeTonic.note, 'minor');
    }
    // Relative major's tonic is the 3rd scale degree of the natural minor.
    const relativeTonic = this.#scale.degree(3);
    return Key.create(relativeTonic.note, 'major');
  }

  /**
   * The parallel key — the same tonic letter, opposite mode.
   */
  public get parallelKey(): Key {
    return Key.create(this.#tonic, this.#mode === 'major' ? 'minor' : 'major');
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
   * Returns a new key transposed by the given interval.
   */
  public transpose(interval: Interval): Key {
    const transposedTonic = this.#tonic.transpose(interval);
    return Key.create(transposedTonic.note, this.#mode);
  }

  /**
   * Returns a new key transposed by the given number of semitones.
   */
  public transposeBy(semitones: number): Key {
    const transposedTonic = this.#tonic.transposeBy(semitones);
    return Key.create(transposedTonic.note, this.#mode);
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

  public toString(): string {
    return `${this.#tonic.note} ${this.#mode}`;
  }

  public get [Symbol.toStringTag](): string {
    return `Key(${this.toString()})`;
  }
}

/**
 * Returns whether a tonic + mode pair has a key entry in the catalog. The
 * single source of truth is {@link KEY_SIGNATURES} — the same set of keys
 * accepted by {@link Key.create}.
 */
export function isKnownKey(tonic: NoteName, mode: KeySignatureMode): boolean {
  const id = `${tonic}-${mode}`;
  return id in KEY_SIGNATURES;
}

// Re-export the catalog key type for convenience at the Key boundary.
export type { KeySignatureKey };
