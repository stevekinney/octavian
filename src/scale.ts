import type { ChordType } from './chords.js';
import { findChordSuffixByIntervals } from './chords.js';
import { resolveInterval, type Interval } from './intervals.js';
import { type NoteName } from './note-spellings.js';
import {
  SCALES,
  isDiatonicModeFamily,
  resolveScaleType,
  scaleTypeForMode,
  type CanonicalScaleType,
  type ModeName,
  type ScaleType,
} from './scales.js';
import { Chord } from './chord.js';
import { Note, type NoteLike, type SerializedNote } from './note.js';

const CHORD_SIZE_BY_STRUCTURE = {
  triad: 3,
  seventh: 4,
  ninth: 5,
  eleventh: 6,
  thirteenth: 7,
} as const satisfies Record<ChordType, number>;

const MODE_ORDER = [
  'ionian',
  'dorian',
  'phrygian',
  'lydian',
  'mixolydian',
  'aeolian',
  'locrian',
] as const satisfies readonly ModeName[];

/**
 * A JSON-serializable snapshot of a scale.
 */
export type SerializedScale = {
  readonly root: SerializedNote;
  readonly type: CanonicalScaleType;
  readonly notes: readonly SerializedNote[];
  readonly intervals: readonly Interval[];
};

function structureSize(structure: ChordType): number {
  return CHORD_SIZE_BY_STRUCTURE[structure];
}

function pitchClassSignature(notes: readonly Note[]): string {
  return [...new Set(notes.map((note) => note.chromaticIndex))]
    .toSorted((left, right) => left - right)
    .join(':');
}

function buildAscendingCandidate(source: Note, target: Note): Note {
  let candidate = target.withOctave(source.octave);
  while (candidate.midi <= source.midi) {
    candidate = candidate.up(1);
  }

  return candidate;
}

function buildDescendingCandidate(source: Note, target: Note): Note {
  let candidate = target.withOctave(source.octave);
  while (candidate.midi >= source.midi) {
    candidate = candidate.down(1);
  }

  return candidate;
}

/**
 * An immutable musical scale rooted on a spelled note.
 */
export class Scale {
  readonly #root: Note;
  readonly #type: CanonicalScaleType;
  readonly #intervals: readonly Interval[];
  readonly #notes: readonly Note[];

  /**
   * Creates an immutable scale from a root note and scale type.
   *
   * @param note The scale root.
   * @param type The scale type.
   */
  public constructor(note: NoteLike, type: ScaleType) {
    this.#root = Note.create(note);
    this.#type = resolveScaleType(type);
    this.#intervals = Object.freeze(
      SCALES[this.#type].intervals.map((interval) => resolveInterval(interval)),
    );
    this.#notes = Object.freeze(this.#intervals.map((interval) => this.#root.transpose(interval)));
  }

  /**
   * Creates a scale from a root note and scale type.
   *
   * @param note The scale root.
   * @param type The scale type.
   * @returns The created scale.
   */
  public static create(note: NoteLike, type: ScaleType): Scale {
    return new Scale(note, type);
  }

  /**
   * Recreates a scale from serialized data.
   *
   * @param serialized The serialized scale.
   * @returns The recreated scale.
   */
  public static fromJSON(serialized: SerializedScale): Scale {
    const scale = new Scale(serialized.root, serialized.type);
    if (
      pitchClassSignature(scale.notes) !==
      pitchClassSignature(serialized.notes.map((note) => Note.create(note)))
    ) {
      throw new TypeError('Serialized scale notes do not match the supplied root and type.');
    }

    return scale;
  }

  /**
   * The scale root note.
   */
  public get root(): Note {
    return this.#root;
  }

  /**
   * The canonical scale type.
   */
  public get type(): CanonicalScaleType {
    return this.#type;
  }

  /**
   * The spelled notes in the scale.
   */
  public get notes(): readonly Note[] {
    return this.#notes;
  }

  /**
   * The defining intervals for the scale.
   */
  public get intervals(): readonly Interval[] {
    return this.#intervals;
  }

  /**
   * The number of notes in the scale.
   */
  public get size(): number {
    return this.notes.length;
  }

  /**
   * Returns the note at a zero-based scale index.
   *
   * @param index The zero-based index.
   * @returns The note at that position.
   */
  public at(index: number): Note {
    const note = this.notes.at(index);
    if (!note) {
      throw new RangeError(`Scale note index ${index} is out of range.`);
    }

    return note;
  }

  /**
   * Returns `true` when the scale contains the supplied note pitch class.
   *
   * @param value The note-like value to inspect.
   * @returns `true` when the pitch class appears in the scale.
   */
  public has(value: NoteLike): boolean {
    const note = Note.create(value);

    return this.notes.some((candidate) => candidate.chromaticIndex === note.chromaticIndex);
  }

  /**
   * Returns the note for a one-based scale degree.
   *
   * @param degree The one-based scale degree.
   * @returns The corresponding note.
   */
  public degree(degree: number): Note {
    if (!Number.isInteger(degree) || degree < 1 || degree > this.size) {
      throw new RangeError(`Expected a degree in the range 1..${this.size}, received ${degree}.`);
    }

    const note = this.notes[degree - 1];
    if (!note) {
      throw new RangeError(`Scale degree ${degree} is out of range.`);
    }

    return note;
  }

  /**
   * Returns the one-based scale degree for a note, or `null` when absent.
   *
   * @param value The note-like value to inspect.
   * @returns The matching scale degree, or `null`.
   */
  public degreeOf(value: NoteLike): number | null {
    const note = Note.create(value);
    const index = this.notes.findIndex(
      (candidate) => candidate.chromaticIndex === note.chromaticIndex,
    );

    return index === -1 ? null : index + 1;
  }

  /**
   * Returns the defining interval for a note in the scale.
   *
   * @param value The note-like value to inspect.
   * @returns The corresponding scale interval.
   */
  public interval(value: NoteLike): Interval {
    const note = Note.create(value);
    const index = this.notes.findIndex(
      (candidate) => candidate.chromaticIndex === note.chromaticIndex,
    );
    if (index === -1) {
      throw new RangeError('The supplied note is not part of the scale.');
    }

    return this.intervals[index]!;
  }

  /**
   * Transposes the scale by a named interval.
   *
   * @param interval The interval to apply.
   * @returns The transposed scale.
   */
  public transpose(interval: Interval): Scale {
    return new Scale(this.root.transpose(interval), this.type);
  }

  /**
   * Transposes the scale by a semitone distance.
   *
   * @param semitones The semitone distance to apply.
   * @returns The transposed scale.
   */
  public transposeBy(semitones: number): Scale {
    return new Scale(this.root.transposeBy(semitones), this.type);
  }

  /**
   * Returns the relative scale of another type that shares the same pitch classes.
   *
   * @param type The target scale type.
   * @returns The relative scale.
   */
  public relative(type: ScaleType): Scale {
    const canonicalType = resolveScaleType(type);
    for (const note of this.notes) {
      const candidate = new Scale(note, canonicalType);
      if (candidate.samePitchClasses(this)) {
        return candidate;
      }
    }

    throw new RangeError(`No relative ${canonicalType} scale exists for ${this.toString()}.`);
  }

  /**
   * Returns the parallel scale of another type with the same root.
   *
   * @param type The target scale type.
   * @returns The parallel scale.
   */
  public parallel(type: ScaleType): Scale {
    return new Scale(this.root, type);
  }

  /**
   * Returns the requested mode from the same pitch-class collection.
   *
   * @param mode The requested mode.
   * @returns The related mode.
   */
  public mode(mode: ModeName): Scale {
    if (!isDiatonicModeFamily(this.type)) {
      throw new RangeError('Named modes are only supported for seven-note diatonic scales.');
    }

    return this.relative(scaleTypeForMode(mode));
  }

  /**
   * Returns every named mode from the same pitch-class collection.
   *
   * @returns The related modes in traditional order.
   */
  public modes(): readonly Scale[] {
    if (!isDiatonicModeFamily(this.type)) {
      throw new RangeError('Named modes are only supported for seven-note diatonic scales.');
    }

    return Object.freeze(MODE_ORDER.map((mode) => this.mode(mode)));
  }

  /**
   * Rotates the scale to another exported scale type when one matches.
   *
   * @param index The zero-based rotation index.
   * @returns The rotated scale.
   */
  public rotate(index: number): Scale {
    if (!Number.isInteger(index) || index < 0 || index >= this.size) {
      throw new RangeError(`Expected a rotation index in the range 0..${this.size - 1}.`);
    }

    const candidateRoot = this.at(index);
    const candidateTypes: readonly CanonicalScaleType[] = [
      'major',
      'naturalMinor',
      'harmonicMinor',
      'melodicMinor',
      'dorian',
      'phrygian',
      'lydian',
      'mixolydian',
      'locrian',
      'majorPentatonic',
      'minorPentatonic',
      'blues',
      'chromatic',
      'wholeTone',
      'diminished',
      'halfWholeDiminished',
    ];

    for (const type of candidateTypes) {
      const candidate = new Scale(candidateRoot, type);
      if (candidate.samePitchClasses(this)) {
        return candidate;
      }
    }

    throw new RangeError('The requested rotation does not match an exported scale type.');
  }

  /**
   * Returns the next scale tone above a note.
   *
   * @param value The reference note.
   * @returns The next scale tone above it.
   */
  public next(value: NoteLike): Note {
    const note = Note.create(value);
    const candidates = this.notes.map((candidate) => buildAscendingCandidate(note, candidate));

    return candidates.reduce((best, candidate) => (candidate.midi < best.midi ? candidate : best));
  }

  /**
   * Returns the previous scale tone below a note.
   *
   * @param value The reference note.
   * @returns The previous scale tone below it.
   */
  public previous(value: NoteLike): Note {
    const note = Note.create(value);
    const candidates = this.notes.map((candidate) => buildDescendingCandidate(note, candidate));

    return candidates.reduce((best, candidate) => (candidate.midi > best.midi ? candidate : best));
  }

  /**
   * Returns the nearest scale tone to a note.
   *
   * @param value The reference note.
   * @returns The nearest scale tone.
   */
  public nearest(value: NoteLike): Note {
    const note = Note.create(value);
    const samePitch = this.notes
      .map((candidate) => candidate.withOctave(note.octave))
      .find((candidate) => candidate.midi === note.midi);
    if (samePitch) {
      return samePitch;
    }

    const previous = this.previous(note);
    const next = this.next(note);
    const previousDistance = Math.abs(Number(note.semitonesTo(previous)));
    const nextDistance = Math.abs(Number(note.semitonesTo(next)));

    return previousDistance <= nextDistance ? previous : next;
  }

  /**
   * Returns one ascending cycle of the scale starting from the supplied note.
   *
   * @param value The starting note.
   * @returns A one-cycle ascending collection.
   */
  public ascendingFrom(value: NoteLike): readonly Note[] {
    let current = this.has(value) ? this.nearest(value) : this.next(value);
    const result = [current];
    while (result.length < this.size) {
      current = this.next(current);
      result.push(current);
    }

    return Object.freeze(result);
  }

  /**
   * Returns one descending cycle of the scale starting from the supplied note.
   *
   * @param value The starting note.
   * @returns A one-cycle descending collection.
   */
  public descendingFrom(value: NoteLike): readonly Note[] {
    let current = this.has(value) ? this.nearest(value) : this.previous(value);
    const result = [current];
    while (result.length < this.size) {
      current = this.previous(current);
      result.push(current);
    }

    return Object.freeze(result);
  }

  /**
   * Builds the diatonic triad for a scale degree.
   *
   * @param degree The one-based scale degree.
   * @returns The resulting triad.
   */
  public triad(degree: number): Chord {
    return this.chord(degree, 'triad');
  }

  /**
   * Builds a diatonic tertian chord for a scale degree.
   *
   * @param degree The one-based scale degree.
   * @param structure The tertian structure to build.
   * @returns The resulting chord.
   */
  public chord(degree: number, structure: ChordType): Chord {
    const root = this.degree(degree);
    const rootIndex = degree - 1;
    const notes: Note[] = [];
    for (let step = 0; step < structureSize(structure); step += 1) {
      const absoluteIndex = rootIndex + step * 2;
      const note = this.notes[absoluteIndex % this.size];
      if (!note) {
        throw new RangeError(`Could not build a ${structure} chord from degree ${degree}.`);
      }

      notes.push(note.up(Math.floor(absoluteIndex / this.size)));
    }

    const intervals = notes.map((note) => root.distanceTo(note));
    const suffix = findChordSuffixByIntervals(intervals);
    if (!suffix) {
      throw new RangeError(
        `No exported chord matches the ${structure} built on degree ${degree} of ${this.toString()}.`,
      );
    }

    return new Chord(root, suffix);
  }

  /**
   * Returns every diatonic triad in the scale.
   *
   * @returns The scale triads.
   */
  public chords(): readonly Chord[] {
    return Object.freeze(Array.from({ length: this.size }, (_, index) => this.triad(index + 1)));
  }

  /**
   * Returns every diatonic seventh chord in the scale.
   *
   * @returns The scale seventh chords.
   */
  public seventhChords(): readonly Chord[] {
    return Object.freeze(
      Array.from({ length: this.size }, (_, index) => this.chord(index + 1, 'seventh')),
    );
  }

  /**
   * Returns `true` when another scale contains the same pitch classes.
   *
   * @param other The other scale to compare.
   * @returns `true` when the pitch-class sets match.
   */
  public samePitchClasses(other: Scale): boolean {
    return pitchClassSignature(this.notes) === pitchClassSignature(other.notes);
  }

  /**
   * Returns `true` when another scale has the same root spelling and canonical type.
   *
   * @param other The other scale to compare.
   * @returns `true` when the scales are exactly equal.
   */
  public equals(other: Scale): boolean {
    return this.root.equals(other.root) && this.type === other.type;
  }

  /**
   * Returns an iterator over the scale notes.
   *
   * @returns An iterator over the scale notes.
   */
  public [Symbol.iterator](): IterableIterator<Note> {
    return this.notes[Symbol.iterator]();
  }

  /**
   * Returns the human-readable scale name.
   *
   * @returns The scale name.
   */
  public toString(): string {
    return `${this.root.note} ${this.type}`;
  }

  /**
   * Serializes the scale to JSON-safe data.
   *
   * @returns The serialized scale.
   */
  public toJSON(): SerializedScale {
    return {
      root: this.root.toJSON(),
      type: this.type,
      notes: this.notes.map((note) => note.toJSON()),
      intervals: this.intervals,
    };
  }

  /**
   * Returns the note spellings in the scale.
   *
   * @returns The scale spellings.
   */
  public spellings(): readonly NoteName[] {
    return Object.freeze(this.notes.map((note) => note.note));
  }

  /**
   * Returns the custom `Object.prototype.toString` tag for the scale.
   */
  public get [Symbol.toStringTag](): `Scale(${NoteName} ${CanonicalScaleType})` {
    return `Scale(${this.root.note} ${this.type})`;
  }
}
