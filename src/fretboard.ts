import { createChromaticIndex, type ChromaticIndex } from './branded-types.js';
import { Chord } from './chord.js';
import { Note, type NoteLike } from './note.js';
import { Scale } from './scale.js';

/**
 * A stringed-instrument tuning, defined by its open-string pitches.
 *
 * Strings are ordered **low-to-high pitch**: `strings[0]` is the lowest-pitched
 * string and `strings[strings.length - 1]` is the highest. This matches the
 * conventional tablature reading direction (left = lowest string).
 *
 * Each element must be a value accepted by {@link Note.create}: a note name with
 * octave such as `'E2'`, a {@link Note} instance, or any other {@link NoteLike}.
 * The field is typed as `readonly string[]` so that string literals like `'E2'`
 * can be assigned directly; invalid entries are caught at runtime by `Note.create`.
 *
 * The optional `name` field is a human-readable label for the tuning (e.g. `'Standard'`).
 */
export type StringInstrumentTuning = {
  readonly strings: readonly string[];
  readonly name?: string;
};

/**
 * The position of a note on a stringed-instrument fretboard.
 */
export type FretPosition = {
  /** Zero-based string index; `0` is the lowest-pitched string. */
  readonly stringIndex: number;
  /** Fret number; `0` means the open string. */
  readonly fret: number;
  /** The sounding note at this position. */
  readonly note: Note;
};

/**
 * Options controlling the fret range searched by position-finder functions.
 */
export type FretboardOptions = {
  /** Lowest fret to include (inclusive). Defaults to `0`. */
  readonly minFret?: number;
  /** Highest fret to include (inclusive). Defaults to `12`. */
  readonly maxFret?: number;
};

// ---------------------------------------------------------------------------
// Standard tunings
// ---------------------------------------------------------------------------

/**
 * Standard guitar tuning: E2 A2 D3 G3 B3 E4 (low-to-high).
 */
export const STANDARD_GUITAR_TUNING: StringInstrumentTuning = Object.freeze({
  name: 'Standard Guitar',
  strings: Object.freeze(['E2', 'A2', 'D3', 'G3', 'B3', 'E4']),
});

/**
 * Standard bass guitar tuning: E1 A1 D2 G2 (low-to-high).
 */
export const STANDARD_BASS_TUNING: StringInstrumentTuning = Object.freeze({
  name: 'Standard Bass',
  strings: Object.freeze(['E1', 'A1', 'D2', 'G2']),
});

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function validateFret(fret: number): void {
  if (!Number.isInteger(fret) || fret < 0) {
    throw new RangeError(`Expected a non-negative integer fret number, received ${fret}.`);
  }
}

function validateStringIndex(tuning: StringInstrumentTuning, stringIndex: number): void {
  if (!Number.isInteger(stringIndex) || stringIndex < 0) {
    throw new RangeError(`Expected a non-negative integer string index, received ${stringIndex}.`);
  }

  const openNote = tuning.strings[stringIndex];
  if (openNote === undefined) {
    throw new RangeError(
      `String index ${stringIndex} is out of range for a ${tuning.strings.length}-string instrument.`,
    );
  }
}

function validateFretRange(minFret: number, maxFret: number): void {
  if (!Number.isInteger(minFret) || minFret < 0) {
    throw new RangeError(`Expected a non-negative integer minFret, received ${minFret}.`);
  }

  if (!Number.isInteger(maxFret) || maxFret < 0) {
    throw new RangeError(`Expected a non-negative integer maxFret, received ${maxFret}.`);
  }

  if (minFret > maxFret) {
    throw new RangeError(
      `Expected minFret (${minFret}) to be less than or equal to maxFret (${maxFret}).`,
    );
  }
}

// ---------------------------------------------------------------------------
// Core position builder
// ---------------------------------------------------------------------------

function collectPositions(
  tuning: StringInstrumentTuning,
  predicate: (note: Note) => boolean,
  options: FretboardOptions,
): readonly FretPosition[] {
  const minFret = options.minFret ?? 0;
  const maxFret = options.maxFret ?? 12;
  validateFretRange(minFret, maxFret);

  const positions: FretPosition[] = [];

  for (let stringIndex = 0; stringIndex < tuning.strings.length; stringIndex += 1) {
    // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
    const openString = tuning.strings[stringIndex]!;
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
    const openNote = Note.create(openString as NoteLike);
    const openMidi = Number(openNote.midi);

    for (let fret = minFret; fret <= maxFret; fret += 1) {
      // Skip positions that would exceed the MIDI range (0..127).
      if (openMidi + fret > 127) {
        break;
      }

      const note = openNote.transposeBy(fret);

      if (predicate(note)) {
        positions.push({ stringIndex, fret, note });
      }
    }
  }

  return Object.freeze(positions);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the note produced by a string at a given fret.
 *
 * @param tuning The instrument tuning.
 * @param stringIndex The zero-based string index (`0` = lowest string).
 * @param fret The fret number (`0` = open string).
 * @returns The sounding note.
 * @throws {RangeError} When `stringIndex` is out of range or `fret` is negative.
 */
export function noteAtFret(
  tuning: StringInstrumentTuning,
  stringIndex: number,
  fret: number,
): Note {
  validateStringIndex(tuning, stringIndex);
  validateFret(fret);

  // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
  const openString = tuning.strings[stringIndex]!;
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
  const openNote = Note.create(openString as NoteLike);

  if (Number(openNote.midi) + fret > 127) {
    throw new RangeError(
      `Fret ${fret} on string ${stringIndex} exceeds the maximum MIDI value of 127.`,
    );
  }

  return openNote.transposeBy(fret);
}

/**
 * Returns all fret positions that match a note or pitch class within a fret range.
 *
 * When `noteOrPitchClass` is a `number`, it is treated as a pitch-class index (`0..11`)
 * and every fret whose note shares that pitch class is included (octave-insensitive).
 *
 * When `noteOrPitchClass` is a {@link NoteLike}, the match is by exact MIDI pitch
 * (octave-sensitive) but enharmonic-insensitive: `'Db3'` and `'C#3'` both match
 * a position whose sounding note is MIDI 49.
 *
 * Results are ordered by string index (ascending), then by fret (ascending).
 *
 * @param tuning The instrument tuning.
 * @param noteOrPitchClass The target note (exact pitch) or pitch-class index (`0..11`).
 * @param options Optional fret range. Defaults to frets `0..12` (inclusive).
 * @returns All matching fret positions within the range.
 * @throws {RangeError} When a numeric pitch class is not in `0..11`, or the range is invalid.
 */
export function fretPositionsFor(
  tuning: StringInstrumentTuning,
  noteOrPitchClass: NoteLike | number,
  options: FretboardOptions = {},
): readonly FretPosition[] {
  if (typeof noteOrPitchClass === 'number') {
    const pitchClass: ChromaticIndex = createChromaticIndex(noteOrPitchClass);
    return collectPositions(tuning, (note) => note.chromaticIndex === pitchClass, options);
  }

  const target = Note.create(noteOrPitchClass);

  return collectPositions(tuning, (note) => note.midi === target.midi, options);
}

/**
 * Returns all fret positions whose pitch class belongs to a scale, within a fret range.
 *
 * Results are ordered by string index (ascending), then by fret (ascending).
 *
 * @param tuning The instrument tuning.
 * @param scale The scale to match against (pitch-class membership).
 * @param options Optional fret range. Defaults to frets `0..12` (inclusive).
 * @returns All fret positions whose note is a member of the scale.
 */
export function scalePositionsFor(
  tuning: StringInstrumentTuning,
  scale: Scale,
  options: FretboardOptions = {},
): readonly FretPosition[] {
  return collectPositions(tuning, (note) => scale.has(note), options);
}

/**
 * Returns all fret positions whose pitch class belongs to a chord, within a fret range.
 *
 * Results are ordered by string index (ascending), then by fret (ascending).
 *
 * @param tuning The instrument tuning.
 * @param chord The chord to match against (pitch-class membership).
 * @param options Optional fret range. Defaults to frets `0..12` (inclusive).
 * @returns All fret positions whose note is a member of the chord.
 */
export function chordPositionsFor(
  tuning: StringInstrumentTuning,
  chord: Chord,
  options: FretboardOptions = {},
): readonly FretPosition[] {
  return collectPositions(tuning, (note) => chord.has(note), options);
}
