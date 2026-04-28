import type { MidiKey } from './branded-types.js';
import {
  CHORDS,
  chordQualityForSuffix,
  createChordName,
  createSlashChordName,
  findChordSuffixByIntervals,
  resolveChordSuffix,
  type CanonicalChordSuffix,
  type ChordDegree,
  type ChordDisplayName,
  type ChordQuality,
  type ChordSuffix,
  type ChordSymbol,
  type InversionCount,
} from './chords.js';
import { INTERVALS, resolveInterval, type Interval } from './intervals.js';
import { isInterval } from './music-utilities.js';
import { Note, type NoteLike, type SerializedNote } from './note.js';

/**
 * A normalized voicing for a chord.
 */
export type ChordVoicing = {
  readonly chord: Chord;
  readonly notes: readonly Note[];
  readonly bass: Note;
  readonly midi: readonly MidiKey[];
};

/**
 * A JSON-serializable snapshot of a chord.
 */
export type SerializedChord = {
  readonly name: ChordDisplayName;
  readonly symbol: ChordSymbol;
  readonly suffix: ChordSuffix;
  readonly intervals: readonly Interval[];
  readonly notes: readonly SerializedNote[];
  readonly root: SerializedNote;
  readonly bass: SerializedNote;
  readonly inversion: InversionCount;
};

function toInversionCount(value: number): InversionCount {
  switch (value) {
    case 0:
    case 1:
    case 2:
    case 3:
    case 4:
    case 5:
    case 6:
      return value;
  }

  throw new RangeError(`Expected an inversion count in the range 0..6, received ${value}.`);
}

function canonicalIntervalsForSuffix(suffix: CanonicalChordSuffix): readonly Interval[] {
  return CHORDS[suffix].intervals.map((interval) => resolveInterval(interval));
}

function sortNotesAscending(notes: readonly Note[]): readonly Note[] {
  return Object.freeze(
    [...notes].toSorted((left, right) => Number(left.midi) - Number(right.midi)),
  );
}

function applyInversion(notes: readonly Note[], inversion: InversionCount): readonly Note[] {
  let result = [...notes];
  for (let index = 0; index < inversion; index += 1) {
    const [first, ...rest] = result;
    if (!first) {
      throw new RangeError('Cannot invert an empty chord.');
    }

    result = [...rest, first.up(1)];
  }

  return Object.freeze(result);
}

function chromaticIndexSignature(notes: readonly Note[]): string {
  return [...new Set(notes.map((note) => note.chromaticIndex))]
    .toSorted((left, right) => left - right)
    .join(':');
}

function buildVoicing(chord: Chord, notes: readonly Note[]): ChordVoicing {
  const ascending = sortNotesAscending(notes);
  const [bass] = ascending;
  if (!bass) {
    throw new RangeError('A voicing must contain at least one note.');
  }

  return Object.freeze({
    chord,
    notes: ascending,
    bass,
    midi: Object.freeze(ascending.map((note) => note.midi)),
  });
}

/**
 * An immutable chord built from a spelled root note and normalized suffix.
 */
export class Chord {
  readonly #root: Note;
  readonly #suffix: CanonicalChordSuffix;
  readonly #intervals: readonly Interval[];
  readonly #baseNotes: readonly Note[];
  readonly #inversionIndex: InversionCount;
  readonly #notes: readonly Note[];
  readonly #midi: readonly MidiKey[];

  /**
   * Creates an immutable chord from a root note and chord suffix or symbol.
   *
   * @param note The chord root.
   * @param chord The chord suffix or symbol.
   * @param inversion The inversion index to apply. Defaults to `0`.
   */
  /** @internal Use {@link Chord.create} or {@link Chord.fromJSON} instead. */
  protected constructor(
    note: NoteLike,
    chord: ChordSuffix | ChordSymbol,
    inversion: InversionCount = 0,
  ) {
    this.#root = Note.create(note);
    this.#suffix = resolveChordSuffix(chord);
    this.#intervals = Object.freeze(canonicalIntervalsForSuffix(this.#suffix));
    this.#baseNotes = Object.freeze(
      this.#intervals.map((interval) => this.#root.transpose(interval)),
    );
    if (inversion >= this.#baseNotes.length) {
      throw new RangeError(
        `Cannot invert a ${this.#baseNotes.length}-note chord by ${inversion} positions.`,
      );
    }

    this.#inversionIndex = inversion;
    this.#notes = applyInversion(this.#baseNotes, this.#inversionIndex);
    this.#midi = Object.freeze(this.#notes.map((n) => n.midi));
  }

  /**
   * Creates a chord from a root note and chord suffix or symbol.
   *
   * To recreate a chord from serialized data, use {@link Chord.fromJSON} instead.
   *
   * @param note The chord root.
   * @param chord The chord suffix or symbol.
   * @returns The created chord.
   */
  public static create(note: NoteLike, chord: ChordSuffix | ChordSymbol): Chord {
    return new Chord(note, chord);
  }

  /**
   * Recreates a chord from serialized data.
   *
   * @param serialized The serialized chord to recreate.
   * @returns The recreated chord.
   */
  public static fromJSON(serialized: SerializedChord): Chord {
    const chord = new Chord(serialized.root, serialized.suffix, serialized.inversion);
    const serializedNotesSignature = chromaticIndexSignature(
      serialized.notes.map((note) => Note.create(note)),
    );
    if (serializedNotesSignature !== chord.sameChromaticIndexesSignature()) {
      throw new TypeError('Serialized chord notes do not match the supplied root and suffix.');
    }

    return chord;
  }

  /**
   * The human-readable chord display name.
   */
  public get name(): ChordDisplayName {
    if (this.isSlashChord) {
      return createSlashChordName(`${this.root.note}${this.symbol}/${this.bass.note}`);
    }

    return createChordName(`${this.root.note}${this.symbol}`);
  }

  /**
   * The display symbol for the chord suffix.
   */
  public get symbol(): ChordSymbol {
    return CHORDS[this.#suffix].symbol;
  }

  /**
   * The canonical suffix for the chord.
   */
  public get suffix(): CanonicalChordSuffix {
    return this.#suffix;
  }

  /**
   * The root note of the chord.
   */
  public get root(): Note {
    return this.#root;
  }

  /**
   * The lowest note in the current inversion.
   */
  public get bass(): Note {
    const [bass] = this.#notes;
    if (!bass) {
      throw new RangeError('Chord has no notes.');
    }

    return bass;
  }

  /**
   * The notes in the current inversion.
   */
  public get notes(): readonly Note[] {
    return this.#notes;
  }

  /**
   * The canonical intervals that define the chord.
   */
  public get intervals(): readonly Interval[] {
    return this.#intervals;
  }

  /**
   * The MIDI keys for the notes in the current inversion.
   */
  public get midi(): readonly MidiKey[] {
    return this.#midi;
  }

  /**
   * The high-level chord quality classification.
   */
  public get quality(): ChordQuality {
    return chordQualityForSuffix(this.#suffix);
  }

  /**
   * The number of notes in the chord.
   */
  public get size(): number {
    return this.notes.length;
  }

  /**
   * Returns the note at a zero-based index in the current inversion.
   *
   * @param index The zero-based note index.
   * @returns The note at that position.
   */
  public at(index: number): Note {
    const note = this.notes.at(index);
    if (!note) {
      throw new RangeError(`Chord note index ${index} is out of range.`);
    }

    return note;
  }

  /**
   * Returns the chord note for a specific degree, or `null` when absent.
   *
   * @param degree The degree to locate.
   * @returns The corresponding note, or `null`.
   */
  public degree(degree: ChordDegree): Note | null {
    const intervalIndex = this.#intervals.findIndex(
      (interval) => INTERVALS[resolveInterval(interval)].degree === degree,
    );

    return intervalIndex === -1 ? null : (this.#baseNotes[intervalIndex] ?? null);
  }

  /**
   * Returns the chord note for a specific interval, or `null` when absent.
   *
   * @param interval The interval to locate.
   * @returns The corresponding note, or `null`.
   */
  public interval(interval: Interval): Note | null {
    const normalized = resolveInterval(interval);
    const intervalIndex = this.#intervals.findIndex(
      (candidate) => resolveInterval(candidate) === normalized,
    );

    return intervalIndex === -1 ? null : (this.#baseNotes[intervalIndex] ?? null);
  }

  /**
   * Transposes the chord by a named interval.
   *
   * @param interval The interval to apply.
   * @returns The transposed chord.
   */
  public transpose(interval: Interval): Chord {
    return new Chord(this.root.transpose(interval), this.suffix, this.inversionIndex);
  }

  /**
   * Transposes the chord by a semitone distance.
   *
   * @param semitones The semitone distance to apply.
   * @returns The transposed chord.
   */
  public transposeBy(semitones: number): Chord {
    return new Chord(this.root.transposeBy(semitones), this.suffix, this.inversionIndex);
  }

  /**
   * Returns a copy of the chord with a different root.
   *
   * @param note The new chord root.
   * @returns The updated chord.
   */
  public withRoot(note: NoteLike): Chord {
    return new Chord(note, this.suffix, this.inversionIndex);
  }

  /**
   * Applies one or more relative inversions to the chord.
   *
   * @param times The number of inversion steps to apply. Defaults to `1`.
   * @returns The inverted chord.
   */
  public invert(times = 1): Chord {
    if (!Number.isInteger(times) || times < 0) {
      throw new RangeError(`Expected a non-negative inversion count, received ${times}.`);
    }

    return this.inversion(toInversionCount((this.inversionIndex + times) % this.notes.length));
  }

  /**
   * Returns the chord at a specific absolute inversion index.
   *
   * @param index The inversion index to apply.
   * @returns The inverted chord.
   */
  public inversion(index: InversionCount): Chord {
    if (index >= this.notes.length) {
      throw new RangeError(
        `Cannot set inversion ${index} on a chord with ${this.notes.length} notes.`,
      );
    }

    return new Chord(this.root, this.suffix, index);
  }

  /**
   * The current inversion index.
   */
  public get inversionIndex(): InversionCount {
    return this.#inversionIndex;
  }

  /**
   * Returns `true` when the chord is not in root position.
   */
  public get isSlashChord(): boolean {
    return this.inversionIndex > 0;
  }

  /**
   * Returns `true` when the chord is in root position.
   */
  public get isRootPosition(): boolean {
    return this.inversionIndex === 0;
  }

  /**
   * Returns the inversion whose bass note matches a chord tone.
   *
   * @param bass The desired bass note.
   * @returns The resulting slash chord.
   */
  public slash(bass: NoteLike): Chord {
    const requestedBass = Note.create(bass);
    const baseIndex = this.#baseNotes.findIndex((candidate) =>
      candidate.isEnharmonicTo(requestedBass),
    );
    if (baseIndex === -1) {
      throw new RangeError('Slash chords are restricted to notes already present in the chord.');
    }

    return this.inversion(toInversionCount(baseIndex));
  }

  /**
   * Returns a chord with an interval removed, when the result still matches the chord catalog.
   *
   * @param interval The interval to remove.
   * @returns The updated chord.
   */
  public omit(interval: Interval): Chord {
    const normalized = resolveInterval(interval);
    const intervals = this.#intervals.filter(
      (candidate) => resolveInterval(candidate) !== normalized,
    );
    if (intervals.length === this.#intervals.length) {
      return this;
    }

    return this.chordFromIntervals(intervals);
  }

  /**
   * Returns a chord with an interval added, when the result matches the chord catalog.
   *
   * @param interval The interval to add.
   * @returns The updated chord.
   */
  public add(interval: Interval): Chord {
    const normalized = resolveInterval(interval);
    if (this.#intervals.some((candidate) => resolveInterval(candidate) === normalized)) {
      return this;
    }

    const intervals = [...this.#intervals, normalized].toSorted((left, right) => {
      const leftInfo = INTERVALS[left];
      const rightInfo = INTERVALS[right];
      if (leftInfo.semitones !== rightInfo.semitones) {
        return leftInfo.semitones - rightInfo.semitones;
      }

      return leftInfo.degree - rightInfo.degree;
    });

    return this.chordFromIntervals(intervals);
  }

  /**
   * Replaces one interval with another, when the result matches the chord catalog.
   *
   * @param from The interval to remove.
   * @param to The interval to add.
   * @returns The updated chord.
   */
  public alter(from: Interval, to: Interval): Chord {
    const fromInterval = resolveInterval(from);
    const replaced = this.#intervals.map((interval) =>
      resolveInterval(interval) === fromInterval ? resolveInterval(to) : resolveInterval(interval),
    );

    if (replaced.every((interval, index) => interval === this.#intervals[index])) {
      return this;
    }

    const deduplicated = [...new Set(replaced)].toSorted((left, right) => {
      const leftInfo = INTERVALS[left];
      const rightInfo = INTERVALS[right];
      if (leftInfo.semitones !== rightInfo.semitones) {
        return leftInfo.semitones - rightInfo.semitones;
      }

      return leftInfo.degree - rightInfo.degree;
    });

    return this.chordFromIntervals(deduplicated);
  }

  /**
   * Validates and returns an explicit voicing for the chord.
   *
   * @param notes The voicing notes to validate.
   * @returns The validated chord voicing.
   */
  public voicing(notes: readonly NoteLike[]): ChordVoicing {
    const normalizedNotes = notes.map((note) => Note.create(note));
    if (normalizedNotes.length !== this.notes.length) {
      throw new RangeError(
        `Expected ${this.notes.length} notes for this voicing, received ${normalizedNotes.length}.`,
      );
    }

    const signature = chromaticIndexSignature(normalizedNotes);
    if (signature !== this.sameChromaticIndexesSignature()) {
      throw new RangeError('Voicing notes must contain exactly the chord pitch classes.');
    }

    return buildVoicing(this, normalizedNotes);
  }

  /**
   * Returns the current close-position voicing for the chord.
   *
   * @returns The close-position voicing.
   */
  public closeVoicing(): ChordVoicing {
    return buildVoicing(this, this.notes);
  }

  /**
   * Lowers the `n`th note from the top by one or more octaves.
   *
   * @param n The note position from the top, where `1` means the top note.
   * @param octaves The number of octaves to lower. Defaults to `1`.
   * @returns The resulting voicing.
   */
  public lowerFromTop(n: number, octaves = 1): ChordVoicing {
    if (!Number.isInteger(n) || n < 1 || n > this.notes.length) {
      throw new RangeError(`Expected n to be in the range 1..${this.notes.length}, received ${n}.`);
    }

    if (!Number.isInteger(octaves) || octaves < 1) {
      throw new RangeError(`Expected a positive octave count, received ${octaves}.`);
    }

    const voicing = [...this.notes];
    const targetIndex = voicing.length - n;
    const note = voicing[targetIndex];
    if (!note) {
      throw new RangeError(`Could not locate note ${n} from the top.`);
    }

    voicing[targetIndex] = note.down(octaves);

    return this.voicing(sortNotesAscending(voicing));
  }

  /**
   * Returns `true` when another chord has the same root spelling, suffix, and inversion.
   *
   * @param other The other chord to compare.
   * @returns `true` when the chords are exactly equal.
   */
  public equals(other: Chord): boolean {
    return (
      this.root.equals(other.root) &&
      this.suffix === other.suffix &&
      this.inversionIndex === other.inversionIndex
    );
  }

  /**
   * Returns `true` when another chord has the same pitch content, root pitch, and bass pitch.
   *
   * @param other The other chord to compare.
   * @returns `true` when the chords are enharmonically equivalent.
   */
  public isEnharmonicTo(other: Chord): boolean {
    return (
      this.sameChromaticIndexes(other) &&
      this.root.isEnharmonicTo(other.root) &&
      this.bass.isEnharmonicTo(other.bass)
    );
  }

  /**
   * Returns `true` when another chord contains the same set of pitch classes.
   *
   * @param other The other chord to compare.
   * @returns `true` when the pitch-class sets match.
   */
  public sameChromaticIndexes(other: Chord): boolean {
    return this.sameChromaticIndexesSignature() === other.sameChromaticIndexesSignature();
  }

  /**
   * Returns `true` when the chord contains a note or interval.
   *
   * @param value The note-like value or interval to inspect.
   * @returns `true` when the chord contains the requested value.
   */
  public has(value: NoteLike | Interval): boolean {
    if (typeof value === 'string' && isInterval(value)) {
      const normalized = resolveInterval(value);

      return this.intervals.some((interval) => resolveInterval(interval) === normalized);
    }

    const note = Note.create(value);

    return this.notes.some((candidate) => candidate.chromaticIndex === note.chromaticIndex);
  }

  /**
   * Serializes the chord to JSON-safe data.
   *
   * @returns The serialized chord.
   */
  public toJSON(): SerializedChord {
    return {
      name: this.name,
      symbol: this.symbol,
      suffix: this.suffix,
      intervals: this.intervals,
      notes: this.notes.map((note) => note.toJSON()),
      root: this.root.toJSON(),
      bass: this.bass.toJSON(),
      inversion: this.inversionIndex,
    };
  }

  /**
   * Iterates over the notes in the current inversion.
   *
   * @returns An iterator over the chord notes.
   */
  public [Symbol.iterator](): IterableIterator<Note> {
    return this.notes[Symbol.iterator]();
  }

  private sameChromaticIndexesSignature(): string {
    return chromaticIndexSignature(this.notes);
  }

  private chordFromIntervals(intervals: readonly Interval[]): Chord {
    const suffix = findChordSuffixByIntervals(intervals);
    if (!suffix) {
      throw new RangeError('The resulting interval collection does not match an exported chord.');
    }

    const inversion = Math.min(this.inversionIndex, intervals.length - 1);

    return new Chord(this.root, suffix, toInversionCount(inversion));
  }
}
