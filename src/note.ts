import {
  createChromaticIndex,
  createFrequency,
  createMidiKey,
  createOctave,
  createSemitones,
  type ChromaticIndex,
  type Frequency,
  type MidiKey,
  type Octave,
  type Semitones,
} from './branded-types.js';
import type { ChordSuffix, ChordSymbol } from './chords.js';
import {
  INTERVALS,
  findCanonicalIntervalBySemitonesAndDegree,
  resolveInterval,
  type Interval,
} from './intervals.js';
import {
  NATURALS,
  naturalFromNoteName,
  NATURAL_CHROMATIC_INDEXES,
  buildNoteName,
  enharmonicsForNoteName,
  noteNameToChromaticIndex,
  noteNameToRawSemitone,
  normalizeChromaticIndex,
  type Natural,
  type NoteName,
} from './note-spellings.js';
import {
  frequencyToNearestMidi,
  isInterval,
  isNoteName,
  isNoteNameWithOctave,
  midiToFrequency,
  midiToNoteNameWithOctave,
  noteNameToMidi,
  parseNoteNameWithOctave,
} from './music-utilities.js';
import type { ScaleType } from './scales.js';
import { STANDARD_TUNING, type Tuning } from './tuning.js';
import type { Chord } from './chord.js';
import type { Scale } from './scale.js';

const DEFAULT_OCTAVE = createOctave(4);

type ChordFactory = (note: Note, chord: ChordSuffix | ChordSymbol) => Chord;
type ScaleFactory = (note: Note, type: ScaleType) => Scale;

let noteChordFactory: ChordFactory | null = null;
let noteScaleFactory: ScaleFactory | null = null;

/**
 * A JSON-serializable snapshot of a note.
 */
export type SerializedNote = {
  readonly note: NoteName;
  readonly octave: Octave;
  readonly midi: MidiKey;
  readonly frequency: Frequency;
};

/**
 * Any value that can be normalized into a {@link Note}.
 */
export type NoteLike =
  | NoteName
  | `${NoteName}${Octave}`
  | Note
  | SerializedNote
  | {
      readonly note: NoteName;
      readonly octave?: Octave;
    };

function noteNameWithOctave(note: NoteName, octave: Octave): `${NoteName}${Octave}` {
  return `${note}${octave}`;
}

function naturalIndex(note: NoteName): number {
  const index = NATURALS.indexOf(naturalFromNoteName(note));
  if (index === -1) {
    throw new TypeError(`Unsupported natural note letter in ${note}.`);
  }

  return index;
}

function accidentalOffsetForPitchClass(natural: Natural, targetPitchClass: ChromaticIndex): number {
  const rawOffset = targetPitchClass - NATURAL_CHROMATIC_INDEXES[natural];
  for (const candidate of [rawOffset, rawOffset - 12, rawOffset + 12]) {
    if (candidate >= -2 && candidate <= 2) {
      return candidate;
    }
  }

  throw new RangeError(
    `Cannot spell pitch class ${targetPitchClass} as a ${natural} note with supported accidentals.`,
  );
}

function validateSerializedNote(note: Note, serialized: SerializedNote): void {
  if (serialized.midi !== note.midi) {
    throw new TypeError('Serialized note MIDI value does not match the supplied note spelling.');
  }

  if (Math.abs(Number(serialized.frequency) - Number(note.frequency)) > 1e-9) {
    throw new TypeError('Serialized note frequency does not match the supplied note spelling.');
  }
}

function describeUnknown(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value === null ||
    value === undefined
  ) {
    return String(value);
  }

  return JSON.stringify(value);
}

function isStructuredNoteLike(
  value: unknown,
): value is SerializedNote | { readonly note: NoteName; readonly octave?: number } {
  return typeof value === 'object' && value !== null && 'note' in value && isNoteName(value.note);
}

function createNoteFromStructuredValue(
  value: SerializedNote | { readonly note: NoteName; readonly octave?: number },
): Note {
  const octave =
    'octave' in value && value.octave !== undefined ? createOctave(value.octave) : DEFAULT_OCTAVE;
  const note = new Note(value.note, octave);

  if ('midi' in value && 'frequency' in value) {
    validateSerializedNote(note, value);
  }

  return note;
}

/**
 * Registers the chord factory used by `Note#chord`.
 *
 * @internal
 * @param factory The factory function to register.
 */
export function setNoteChordFactory(factory: ChordFactory): void {
  noteChordFactory = factory;
}

/**
 * Registers the scale factory used by `Note#scale`.
 *
 * @internal
 * @param factory The factory function to register.
 */
export function setNoteScaleFactory(factory: ScaleFactory): void {
  noteScaleFactory = factory;
}

function requireChordFactory(): ChordFactory {
  if (!noteChordFactory) {
    throw new TypeError('Chord support has not been configured.');
  }

  return noteChordFactory;
}

function requireScaleFactory(): ScaleFactory {
  if (!noteScaleFactory) {
    throw new TypeError('Scale support has not been configured.');
  }

  return noteScaleFactory;
}

/**
 * Applies an interval to a note while preserving theory-correct spelling.
 *
 * @param note The starting note.
 * @param interval The interval to apply.
 * @returns The transposed note.
 * @throws {RangeError} When the interval produces a note outside the supported MIDI range or requires unsupported accidentals.
 */
export function applyInterval(note: Note, interval: Interval): Note {
  const canonicalInterval = resolveInterval(interval);
  const intervalInformation = INTERVALS[canonicalInterval];
  const sourceNaturalIndex = naturalIndex(note.note);
  const targetNaturalIndex =
    (sourceNaturalIndex + intervalInformation.degree - 1) % NATURALS.length;
  const targetNatural = NATURALS[targetNaturalIndex];
  if (!targetNatural) {
    throw new RangeError(`Could not resolve a target natural note for ${interval}.`);
  }
  const targetMidiNumber = Number(note.midi) + intervalInformation.semitones;
  const targetChromaticIndex = normalizeChromaticIndex(
    note.chromaticIndex + intervalInformation.semitones,
  );
  const accidentalOffset = accidentalOffsetForPitchClass(targetNatural, targetChromaticIndex);
  const targetNoteName = buildNoteName(targetNatural, accidentalOffset);
  const targetOctave = createOctave(
    Math.floor((targetMidiNumber - noteNameToRawSemitone(targetNoteName)) / 12) - 1,
  );

  return new Note(targetNoteName, targetOctave);
}

/**
 * An immutable musical note with spelling, MIDI, and frequency metadata.
 */
export class Note {
  readonly #note: NoteName;
  readonly #octave: Octave;
  readonly #midi: MidiKey;
  readonly #frequency: Frequency;
  readonly #chromaticIndex: ChromaticIndex;
  readonly #enharmonics: readonly NoteName[];

  /**
   * Creates an immutable note from a validated spelling and octave.
   *
   * @param note The note spelling to construct.
   * @param octave The octave to use. Defaults to `4`.
   * @throws {RangeError} When the resulting note falls outside the supported MIDI range.
   */
  public constructor(note: NoteName, octave: Octave = DEFAULT_OCTAVE) {
    if (!isNoteName(note)) {
      throw new TypeError(`Unsupported note name: ${String(note)}.`);
    }

    this.#note = note;
    this.#octave = createOctave(octave);
    this.#midi = noteNameToMidi(this.#note, this.#octave);
    this.#frequency = createFrequency(Number(midiToFrequency(this.#midi)));
    this.#chromaticIndex = createChromaticIndex(noteNameToChromaticIndex(this.#note));
    this.#enharmonics = enharmonicsForNoteName(this.#note);

    Object.freeze(this);
  }

  /**
   * Creates a note from any supported note-like input.
   *
   * @param value The value to normalize into a note.
   * @returns The normalized note instance.
   * @throws {TypeError} When the value is not a supported note-like shape.
   */
  public static create(value: NoteLike): Note {
    if (value instanceof Note) {
      return value;
    }

    if (isNoteNameWithOctave(value)) {
      const { note, octave } = parseNoteNameWithOctave(value);
      return new Note(note, octave);
    }

    if (isNoteName(value)) {
      return new Note(value, DEFAULT_OCTAVE);
    }

    if (isStructuredNoteLike(value)) {
      return createNoteFromStructuredValue(value);
    }

    throw new TypeError(`Unsupported note-like value: ${describeUnknown(value)}.`);
  }

  /**
   * Creates a note from a MIDI key using sharp-preferred spellings.
   *
   * @param midi The MIDI key to convert.
   * @returns The created note.
   */
  public static fromMidi(midi: MidiKey | number): Note {
    const normalizedMidi = typeof midi === 'number' ? createMidiKey(midi) : midi;
    const { note, octave } = midiToNoteNameWithOctave(normalizedMidi);

    return new Note(note, octave);
  }

  /**
   * Creates the nearest equal-tempered note for a frequency.
   *
   * @param frequency The frequency in hertz.
   * @param tuning The tuning reference to use.
   * @returns The nearest note.
   * @throws {RangeError} When the frequency is not positive or resolves outside the supported MIDI range.
   */
  public static fromFrequency(
    frequency: Frequency | number,
    tuning: Tuning = STANDARD_TUNING,
  ): Note {
    const normalizedFrequency =
      typeof frequency === 'number' ? createFrequency(frequency) : frequency;

    return Note.fromMidi(frequencyToNearestMidi(Number(normalizedFrequency), tuning));
  }

  /**
   * Returns `true` when a value can be normalized into a note.
   *
   * @param value The value to inspect.
   * @returns `true` when the value is note-like.
   */
  public static isNoteLike(value: unknown): value is NoteLike {
    if (value instanceof Note || isNoteName(value) || isNoteNameWithOctave(value)) {
      return true;
    }

    if (!isStructuredNoteLike(value)) {
      return false;
    }

    if (!('octave' in value) || value.octave === undefined) {
      return true;
    }

    if (typeof value.octave !== 'number') {
      return false;
    }

    try {
      createOctave(value.octave);

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Compares two note-like values by pitch height.
   *
   * @param first The first note-like value.
   * @param second The second note-like value.
   * @returns `-1`, `0`, or `1`.
   */
  public static compare(first: NoteLike, second: NoteLike): -1 | 0 | 1 {
    const left = Note.create(first);
    const right = Note.create(second);

    if (left.midi === right.midi) {
      return 0;
    }

    return left.midi < right.midi ? -1 : 1;
  }

  /**
   * The spelled note name.
   */
  public get note(): NoteName {
    return this.#note;
  }

  /**
   * The note octave.
   */
  public get octave(): Octave {
    return this.#octave;
  }

  /**
   * The equal-tempered frequency in hertz.
   */
  public get frequency(): Frequency {
    return this.#frequency;
  }

  /**
   * The MIDI key number for the note.
   */
  public get midi(): MidiKey {
    return this.#midi;
  }

  /**
   * Alternate supported spellings for the same pitch class.
   */
  public get enharmonics(): readonly NoteName[] {
    return this.#enharmonics;
  }

  /**
   * The pitch-class index in the range `0..11`.
   */
  public get chromaticIndex(): ChromaticIndex {
    return this.#chromaticIndex;
  }

  /**
   * Transposes the note by either a named interval or a semitone distance.
   *
   * @param value The interval or semitone distance to apply.
   * @returns The transposed note.
   */
  public transpose(value: Interval | Semitones | number): Note {
    if (typeof value === 'string' && isInterval(value)) {
      return applyInterval(this, value);
    }

    return this.transposeBy(value);
  }

  /**
   * Transposes the note by a semitone distance using sharp-preferred spelling.
   *
   * @param semitones The semitone distance to apply.
   * @returns The transposed note.
   */
  public transposeBy(semitones: Semitones | number): Note {
    const normalizedSemitones =
      typeof semitones === 'number' ? createSemitones(semitones) : semitones;

    return Note.fromMidi(Number(this.midi) + Number(normalizedSemitones));
  }

  /**
   * Raises the note by one or more octaves while preserving its spelling.
   *
   * @param octaves The number of octaves to add. Defaults to `1`.
   * @returns The raised note.
   */
  public up(octaves = 1): Note {
    if (!Number.isInteger(octaves) || octaves < 0) {
      throw new RangeError(`Expected a non-negative integer octave distance, received ${octaves}.`);
    }

    return this.withOctave(createOctave(this.octave + octaves));
  }

  /**
   * Lowers the note by one or more octaves while preserving its spelling.
   *
   * @param octaves The number of octaves to subtract. Defaults to `1`.
   * @returns The lowered note.
   */
  public down(octaves = 1): Note {
    if (!Number.isInteger(octaves) || octaves < 0) {
      throw new RangeError(`Expected a non-negative integer octave distance, received ${octaves}.`);
    }

    return this.withOctave(createOctave(this.octave - octaves));
  }

  /**
   * Returns `true` when another note has the same spelling and octave.
   *
   * @param value The note-like value to compare.
   * @returns `true` when the note spelling and octave match.
   */
  public equals(value: NoteLike): boolean {
    const other = Note.create(value);

    return this.note === other.note && this.octave === other.octave;
  }

  /**
   * Creates a scale rooted on this note.
   *
   * @param scaleType The scale type to create.
   * @returns The created scale.
   */
  public scale(scaleType: ScaleType): Scale {
    return requireScaleFactory()(this, scaleType);
  }

  /**
   * Creates a chord rooted on this note.
   *
   * @param chord The chord suffix or symbol to apply.
   * @returns The created chord.
   */
  public chord(chord: ChordSuffix | ChordSymbol): Chord {
    return requireChordFactory()(this, chord);
  }

  /**
   * Returns the next note above this note that belongs to a scale.
   *
   * @param scale The scale instance or scale type to use.
   * @returns The next scale tone above this note.
   */
  public next(scale: Scale | ScaleType): Note {
    const resolvedScale = typeof scale === 'string' ? this.scale(scale) : scale;

    return resolvedScale.next(this);
  }

  /**
   * Returns the previous note below this note that belongs to a scale.
   *
   * @param scale The scale instance or scale type to use.
   * @returns The previous scale tone below this note.
   */
  public previous(scale: Scale | ScaleType): Note {
    const resolvedScale = typeof scale === 'string' ? this.scale(scale) : scale;

    return resolvedScale.previous(this);
  }

  /**
   * Returns the ascending interval from this note to another note.
   *
   * @param value The target note-like value.
   * @returns The canonical interval name.
   * @throws {RangeError} When the interval is not represented by the exported interval catalog.
   */
  public distanceTo(value: NoteLike): Interval {
    const target = Note.create(value);
    const targetWasLower = target.midi < this.midi;
    let semitoneDistance = Number(target.midi) - Number(this.midi);
    let targetDegreePosition = naturalIndex(target.note) + target.octave * NATURALS.length;
    const sourceDegreePosition = naturalIndex(this.note) + this.octave * NATURALS.length;

    while (semitoneDistance < 0) {
      semitoneDistance += 12;
      targetDegreePosition += NATURALS.length;
    }

    while (targetDegreePosition < sourceDegreePosition) {
      targetDegreePosition += NATURALS.length;
    }

    if (targetWasLower && semitoneDistance === 0 && this.note === target.note) {
      semitoneDistance = 12;
      targetDegreePosition += NATURALS.length;
    }

    const degree = targetDegreePosition - sourceDegreePosition + 1;
    const interval = findCanonicalIntervalBySemitonesAndDegree(semitoneDistance, degree);
    if (!interval) {
      throw new RangeError(
        `No exported interval matches ${semitoneDistance} semitones and degree ${degree}.`,
      );
    }

    return interval;
  }

  /**
   * Returns the signed semitone distance to another note.
   *
   * @param value The target note-like value.
   * @returns The signed semitone distance.
   */
  public semitonesTo(value: NoteLike): Semitones {
    const target = Note.create(value);

    return createSemitones(Number(target.midi) - Number(this.midi));
  }

  /**
   * Simplifies the note to a common sharp-preferred spelling while preserving pitch.
   *
   * @returns The simplified note.
   */
  public simplify(): Note {
    return Note.fromMidi(this.midi);
  }

  /**
   * Re-spells the note at a different octave while preserving its note name.
   *
   * @param octave The octave to apply.
   * @returns The respelled note.
   */
  public withOctave(octave: Octave): Note {
    return new Note(this.note, createOctave(octave));
  }

  /**
   * Returns the note data as a tuple.
   *
   * @returns A tuple of note name, octave, MIDI key, and frequency.
   */
  public toTuple(): readonly [NoteName, Octave, MidiKey, Frequency] {
    return [this.note, this.octave, this.midi, this.frequency];
  }

  /**
   * Returns `true` when another note has the same pitch, regardless of spelling.
   *
   * @param value The note-like value to compare.
   * @returns `true` when the notes are enharmonic.
   */
  public isEnharmonicTo(value: NoteLike): boolean {
    return this.midi === Note.create(value).midi;
  }

  /**
   * Returns the scientific pitch notation string for the note.
   *
   * @returns The note string.
   */
  public toString(): `${NoteName}${Octave}` {
    return noteNameWithOctave(this.note, this.octave);
  }

  /**
   * Returns the MIDI key when the note is used in numeric contexts.
   *
   * @returns The MIDI key number.
   */
  public valueOf(): MidiKey {
    return this.midi;
  }

  /**
   * Serializes the note to JSON-safe data.
   *
   * @returns The serialized note.
   */
  public toJSON(): SerializedNote {
    return {
      note: this.note,
      octave: this.octave,
      midi: this.midi,
      frequency: this.frequency,
    };
  }

  /**
   * Converts the note to either its string or numeric primitive representation.
   *
   * @param hint The JavaScript coercion hint.
   * @returns The string note or MIDI key representation.
   */
  public [Symbol.toPrimitive](hint: string): `${NoteName}${Octave}` | MidiKey {
    if (hint === 'number') {
      return this.midi;
    }

    return this.toString();
  }

  /**
   * Returns the custom `Object.prototype.toString` tag for the note.
   */
  public get [Symbol.toStringTag](): `Note(${`${NoteName}${Octave}`})` {
    return `Note(${this.toString()})`;
  }

  /**
   * Iterates over the note tuple values.
   *
   * @returns An iterator over note name, octave, MIDI key, and frequency.
   */
  public [Symbol.iterator](): IterableIterator<NoteName | Octave | MidiKey | Frequency> {
    return this.toTuple()[Symbol.iterator]();
  }
}
