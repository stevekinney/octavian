import { Note, type NoteLike } from './note.js';
import type { Interval } from './intervals.js';

// ---------------------------------------------------------------------------
// Direction type
// ---------------------------------------------------------------------------

/**
 * The melodic direction between two consecutive notes.
 */
export type MelodicDirection = 'up' | 'down' | 'same';

// ---------------------------------------------------------------------------
// ContourComparison
// ---------------------------------------------------------------------------

/**
 * The result of comparing two melodies for contour equivalence.
 */
export type ContourComparison = {
  /**
   * `true` when both melodies have the same semitone-interval shape,
   * regardless of starting pitch (transposition-invariant).
   */
  readonly isEquivalent: boolean;
  /** The signed semitone contour of melody `a`. */
  readonly contourA: readonly number[];
  /** The signed semitone contour of melody `b`. */
  readonly contourB: readonly number[];
};

// ---------------------------------------------------------------------------
// MotifOccurrence
// ---------------------------------------------------------------------------

/**
 * A located occurrence of a motif within a melody.
 */
export type MotifOccurrence = {
  /** The zero-based index of the first note of this occurrence in the melody. */
  readonly startIndex: number;
  /**
   * The match type: `'exact'` when all semitone intervals match precisely,
   * `'contour'` when only direction (up/down/same) matches.
   */
  readonly matchType: 'exact' | 'contour';
};

// ---------------------------------------------------------------------------
// FindMotifOptions
// ---------------------------------------------------------------------------

/**
 * Options for {@link findMotifOccurrences}.
 */
export type FindMotifOptions = {
  /**
   * When `'exact'` (default), only exact semitone matches are returned.
   * When `'contour'`, only contour-shape (up/down/same) matches are returned.
   * When `'both'`, exact occurrences are tagged `'exact'` and direction-only
   * occurrences are tagged `'contour'`; exact matches are not double-reported.
   */
  readonly matchType?: 'exact' | 'contour' | 'both';
};

// ---------------------------------------------------------------------------
// CompareMelodicContourOptions
// ---------------------------------------------------------------------------

/**
 * Options for {@link compareMelodicContour}.
 */
export type CompareMelodicContourOptions = {
  /**
   * When `true`, comparison is direction-only (up/down/same) rather than
   * exact semitone intervals. Defaults to `false`.
   */
  readonly contourOnly?: boolean;
};

// ---------------------------------------------------------------------------
// SerializedMelody
// ---------------------------------------------------------------------------

/**
 * A JSON-serializable snapshot of a Melody.
 */
export type SerializedMelody = {
  readonly notes: readonly { readonly note: string; readonly octave: number }[];
};

// ---------------------------------------------------------------------------
// Module-scoped factory — populated by Melody's static {} block
// ---------------------------------------------------------------------------

let createMelody: (notes: readonly Note[]) => Melody;

// ---------------------------------------------------------------------------
// Semitone-to-interval mapping
// Covers 0..21 semitones (unison through major thirteenth, the widest named
// interval in the INTERVALS catalog). Spans beyond 21 throw — callers needing
// arbitrarily wide leaps use semitoneContour() (raw signed semitones) instead.
// ---------------------------------------------------------------------------

const SEMITONE_TO_INTERVAL: Readonly<Record<number, Interval>> = {
  0: 'perfectUnison',
  1: 'minorSecond',
  2: 'majorSecond',
  3: 'minorThird',
  4: 'majorThird',
  5: 'perfectFourth',
  6: 'augmentedFourth',
  7: 'perfectFifth',
  8: 'minorSixth',
  9: 'majorSixth',
  10: 'minorSeventh',
  11: 'majorSeventh',
  12: 'perfectOctave',
  13: 'minorNinth',
  14: 'majorNinth',
  15: 'minorTenth',
  16: 'majorTenth',
  17: 'perfectEleventh',
  18: 'augmentedEleventh',
  19: 'perfectTwelfth',
  20: 'minorThirteenth',
  21: 'majorThirteenth',
};

/**
 * Maps an absolute semitone count to the most common interval name.
 * Supports 0..21 semitones (unison through major thirteenth).
 *
 * @throws {RangeError} When `semitones` is not in the range 0..21.
 */
function semitonesToIntervalName(semitones: number): Interval {
  const found = SEMITONE_TO_INTERVAL[semitones];
  if (found !== undefined) return found;
  throw new RangeError(
    `intervals() supports up to 21 semitones (majorThirteenth); received ${semitones}. Use semitoneContour() for larger spans.`,
  );
}

// ---------------------------------------------------------------------------
// Internal contour helpers (used by Melody methods and standalone functions)
// ---------------------------------------------------------------------------

function semitonesBetween(a: Note, b: Note): number {
  return Number(b.midi) - Number(a.midi);
}

function directionOf(semitones: number): MelodicDirection {
  if (semitones > 0) return 'up';
  if (semitones < 0) return 'down';
  return 'same';
}

function buildSemitoneContour(notes: readonly Note[]): readonly number[] {
  if (notes.length < 2) return [];
  const result: number[] = [];
  for (let i = 1; i < notes.length; i++) {
    // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
    result.push(semitonesBetween(notes[i - 1]!, notes[i]!));
  }
  return result;
}

function contoursMatchExact(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
    if (a[i]! !== b[i]!) return false;
  }
  return true;
}

function contoursMatchDirection(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
    if (directionOf(a[i]!) !== directionOf(b[i]!)) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Melody value object
// ---------------------------------------------------------------------------

/**
 * An immutable sequence of notes representing a melody.
 *
 * Intervals between notes are directed (signed): upward motion produces
 * positive semitone values; downward motion produces negative values.
 *
 * **Inversion semantics**: `invert(axis)` mirrors every note around the axis
 * pitch by reflecting its signed semitone distance. A note `d` semitones
 * above the axis becomes `d` semitones below it. For example, inverting
 * `[C4, D4, E4]` around `C4` gives `[C4, Bb3, Ab3]`.
 */
export class Melody {
  readonly #notes: readonly Note[];

  /**
   * @internal Use {@link Melody.create} instead.
   */
  protected constructor(notes: readonly Note[]) {
    this.#notes = Object.freeze([...notes]);
  }

  static {
    createMelody = (notes: readonly Note[]) => new Melody(notes);
  }

  /**
   * Creates a Melody from a sequence of note-like values.
   *
   * @param notes The notes to include in the melody.
   * @returns The created melody.
   * @throws {TypeError} When any element cannot be normalized to a Note.
   */
  public static create(notes: readonly NoteLike[]): Melody {
    return createMelody(notes.map((n) => Note.create(n)));
  }

  /**
   * Deserializes a Melody from a plain object.
   *
   * @param serialized The serialized melody to restore.
   * @returns The restored melody.
   * @throws {TypeError} When the serialized value does not match the expected shape.
   */
  public static fromJSON(serialized: unknown): Melody {
    if (
      typeof serialized !== 'object' ||
      serialized === null ||
      !('notes' in serialized) ||
      !Array.isArray((serialized as { notes: unknown }).notes)
    ) {
      throw new TypeError('Serialized melody does not match expected shape.');
    }
    const raw = (serialized as { notes: unknown[] }).notes;
    const notes = raw.map((entry, index) => {
      if (
        typeof entry !== 'object' ||
        entry === null ||
        !('note' in entry) ||
        !('octave' in entry)
      ) {
        throw new TypeError(`Serialized melody does not match expected shape at notes[${index}].`);
      }
      return Note.create(entry as NoteLike);
    });
    return createMelody(notes);
  }

  /**
   * The notes in this melody, in order.
   */
  public get notes(): readonly Note[] {
    return this.#notes;
  }

  /**
   * The number of notes in this melody.
   */
  public get length(): number {
    return this.#notes.length;
  }

  /**
   * Returns the absolute interval name between each pair of consecutive notes.
   *
   * Each name reflects the absolute (unsigned) distance regardless of direction.
   * Use {@link semitoneContour} for the signed directed view.
   *
   * Named intervals span unison through a major thirteenth (0..21 semitones). A
   * single consecutive leap wider than 21 semitones (e.g. a two-octave jump such
   * as C4→C6) has no named interval and throws; use {@link semitoneContour} for
   * melodies with leaps that wide. Octave-crossing melodies whose individual
   * steps stay within a major thirteenth are fully supported.
   *
   * @returns The consecutive interval names.
   * @throws {RangeError} When a consecutive leap exceeds 21 semitones.
   */
  public intervals(): readonly Interval[] {
    if (this.#notes.length < 2) return [];
    const result: Interval[] = [];
    for (let i = 1; i < this.#notes.length; i++) {
      // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
      const from = this.#notes[i - 1]!;
      // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
      const to = this.#notes[i]!;
      const delta = semitonesBetween(from, to);
      result.push(semitonesToIntervalName(Math.abs(delta)));
    }
    return result;
  }

  /**
   * Returns the signed semitone distance between each pair of consecutive notes.
   *
   * Positive values indicate upward motion; negative values indicate downward
   * motion; zero indicates a unison or repeated pitch.
   *
   * @returns The signed semitone steps.
   */
  public semitoneContour(): readonly number[] {
    return buildSemitoneContour(this.#notes);
  }

  /**
   * Returns the direction of each consecutive step.
   *
   * @returns `'up'`, `'down'`, or `'same'` for each consecutive pair.
   */
  public directionContour(): readonly MelodicDirection[] {
    return buildSemitoneContour(this.#notes).map(directionOf);
  }

  /**
   * Transposes the melody by a named interval or semitone distance.
   *
   * @param interval The interval or semitone count to apply to every note.
   * @returns The transposed melody.
   */
  public transpose(interval: Interval | number): Melody {
    return createMelody(this.#notes.map((n) => n.transpose(interval)));
  }

  /**
   * Inverts the melody around an axis pitch.
   *
   * Each note is reflected by its signed semitone distance from the axis:
   * a note `d` semitones above the axis maps to `d` semitones below it.
   * For example, inverting `[C4, D4, E4]` around `C4` gives `[C4, Bb3, Ab3]`.
   *
   * Inverted notes use flat spelling so that descending motion is spelled
   * as flats rather than sharps (Bb3, Ab3 instead of A#3, G#3).
   *
   * @param axis The pitch to invert around.
   * @returns The inverted melody.
   * @throws {RangeError} When any inverted MIDI value falls outside 0..127.
   */
  public invert(axis: NoteLike): Melody {
    const axisNote = Note.create(axis);
    const axisMidi = Number(axisNote.midi);
    const inverted = this.#notes.map((n) => {
      const delta = Number(n.midi) - axisMidi;
      return Note.fromMidi(axisMidi - delta, 'flats');
    });
    return createMelody(inverted);
  }

  /**
   * Returns the retrograde (reverse) of this melody.
   *
   * @returns The reversed melody.
   */
  public retrograde(): Melody {
    return createMelody(this.#notes.toReversed());
  }

  /**
   * Returns `true` when this melody contains no notes.
   *
   * @returns `true` when the melody is empty.
   */
  public isEmpty(): boolean {
    return this.#notes.length === 0;
  }

  /**
   * Serializes the melody to a JSON-safe snapshot.
   *
   * @returns The serialized melody.
   */
  public toJSON(): SerializedMelody {
    return {
      notes: this.#notes.map((n) => ({ note: n.note, octave: n.octave })),
    };
  }

  /**
   * Returns the note names separated by spaces.
   *
   * @returns A space-joined string of note names with octaves.
   */
  public toString(): string {
    return this.#notes.map((n) => n.toString()).join(' ');
  }

  /**
   * Iterates over the notes in the melody.
   *
   * @returns An iterator over the notes.
   */
  public [Symbol.iterator](): IterableIterator<Note> {
    return (this.#notes as Note[])[Symbol.iterator]();
  }
}

// ---------------------------------------------------------------------------
// Standalone analysis functions
// ---------------------------------------------------------------------------

/**
 * Compares two melodies for transposition-invariant contour equivalence.
 *
 * Two melodies are equivalent when their sequences of signed semitone steps
 * match exactly, regardless of starting pitch. For example, `[C4, E4, G4]`
 * and `[G4, B4, D5]` are equivalent because both have the contour `[+4, +3]`.
 *
 * When `options.contourOnly` is `true`, only the direction shape (up/down/same)
 * is compared rather than exact semitone distances.
 *
 * @param a The first melody.
 * @param b The second melody.
 * @param options Comparison options.
 * @returns The comparison result including both contours and the equivalence flag.
 */
export function compareMelodicContour(
  a: Melody,
  b: Melody,
  options?: CompareMelodicContourOptions,
): ContourComparison {
  const contourA = a.semitoneContour();
  const contourB = b.semitoneContour();
  const contourOnly = options?.contourOnly ?? false;
  const isEquivalent = contourOnly
    ? contoursMatchDirection(contourA, contourB)
    : contoursMatchExact(contourA, contourB);
  return { isEquivalent, contourA, contourB };
}

function matchWindow(
  windowContour: readonly number[],
  motifContour: readonly number[],
  matchType: 'exact' | 'contour' | 'both',
  startIndex: number,
): MotifOccurrence | null {
  const isExact = contoursMatchExact(windowContour, motifContour);
  if ((matchType === 'exact' || matchType === 'both') && isExact) {
    return { startIndex, matchType: 'exact' };
  }
  if (matchType === 'contour' || matchType === 'both') {
    if (contoursMatchDirection(windowContour, motifContour)) {
      return { startIndex, matchType: 'contour' };
    }
  }
  return null;
}

/**
 * Finds all occurrences of a motif within a melody, including overlapping ones.
 *
 * The motif must have at least two notes (to define at least one interval).
 * A motif with fewer than two notes always returns an empty array.
 *
 * Match types:
 * - `'exact'` (default): all semitone intervals must match exactly.
 * - `'contour'`: only direction (up/down/same) must match.
 * - `'both'`: exact matches are tagged `'exact'`; positions that match by
 *   direction but not exact semitones are tagged `'contour'`. A position
 *   that is an exact match is not also reported as a contour match.
 *
 * @param melody The melody to search within.
 * @param motif The motif to search for.
 * @param options Search options.
 * @returns All matching occurrences sorted by start index.
 */
export function findMotifOccurrences(
  melody: Melody,
  motif: Melody,
  options?: FindMotifOptions,
): readonly MotifOccurrence[] {
  const matchType = options?.matchType ?? 'exact';
  const motifContour = motif.semitoneContour();
  const melodyNotes = melody.notes;
  const motifLength = motif.length;

  // A motif with fewer than 2 notes defines no interval shape to match.
  if (motifLength < 2 || melodyNotes.length < motifLength) return [];

  const results: MotifOccurrence[] = [];
  for (let i = 0; i <= melodyNotes.length - motifLength; i++) {
    const windowContour = buildSemitoneContour(melodyNotes.slice(i, i + motifLength));
    const match = matchWindow(windowContour, motifContour, matchType, i);
    if (match !== null) results.push(match);
  }
  return results;
}
