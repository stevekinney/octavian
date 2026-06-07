import {
  createChromaticIndex,
  createMidiKey,
  type ChromaticIndex,
  type MidiKey,
  type Octave,
} from './branded-types.js';
import { Chord } from './chord.js';
import { Note, type NoteLike } from './note.js';
import { Scale } from './scale.js';

/**
 * Chromatic indexes that correspond to black keys on a standard piano keyboard.
 * C# D# F# G# A#: 1, 3, 6, 8, 10
 */
const BLACK_KEY_CHROMATIC_INDEXES: ReadonlySet<ChromaticIndex> = new Set<ChromaticIndex>([
  createChromaticIndex(1),
  createChromaticIndex(3),
  createChromaticIndex(6),
  createChromaticIndex(8),
  createChromaticIndex(10),
]);

/**
 * Number of white keys below each chromatic index within an octave.
 * Used to compute cumulative white-key counts.
 */
const WHITE_KEY_OFFSET_IN_OCTAVE: readonly number[] = Object.freeze([
  0, // C  (index 0) → 0 white keys before it in octave
  1, // C# (index 1) → after C
  1, // D  (index 2) → 1 white key before
  2, // D# (index 3) → after D
  2, // E  (index 4) → 2 white keys before
  3, // F  (index 5) → 3 white keys before
  4, // F# (index 6) → after F
  4, // G  (index 7) → 4 white keys before
  5, // G# (index 8) → after G
  5, // A  (index 9) → 5 white keys before
  6, // A# (index 10)→ after A
  6, // B  (index 11)→ 6 white keys before
]);

/**
 * A key on a piano keyboard, describing its note, MIDI number, position, and color.
 * White keys include `whiteKeyIndex` counting from the start of the range.
 * Black keys omit `whiteKeyIndex` (exactOptionalPropertyTypes).
 */
export type PianoKey = {
  readonly note: Note;
  readonly midi: MidiKey;
  readonly chromaticIndex: ChromaticIndex;
  readonly octave: Octave;
  readonly color: 'white' | 'black';
  readonly whiteKeyIndex?: number;
};

/**
 * A range of MIDI keys defining a keyboard span.
 */
export type KeyboardRange = {
  readonly from: MidiKey;
  readonly to: MidiKey;
};

/**
 * Options shared by keyboard helper functions.
 */
export type KeyboardOptions = {
  /**
   * Whether to prefer flats or sharps when spelling black keys. Defaults to `'sharps'`.
   */
  readonly accidentalPreference?: 'sharps' | 'flats';
};

/**
 * The position of a key within a keyboard range.
 */
export type KeyboardPosition = {
  /** Zero-based index within the keyboard range (counting all keys). */
  readonly index: number;
  /** Zero-based index counting only white keys from the range start. Absent on black keys. */
  readonly whiteKeyIndex?: number;
  /** The key at this position. */
  readonly key: PianoKey;
};

/**
 * A group of highlighted key positions sharing the same pitch class.
 */
export type KeyboardHighlight = {
  /** The pitch class being highlighted. */
  readonly chromaticIndex: ChromaticIndex;
  /** All matching key positions within the range. */
  readonly positions: readonly KeyboardPosition[];
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function isBlackKey(chromaticIndex: ChromaticIndex): boolean {
  return BLACK_KEY_CHROMATIC_INDEXES.has(chromaticIndex);
}

/**
 * Counts cumulative white keys from MIDI 0 up to (not including) the given MIDI number.
 */
function cumulativeWhiteKeysBefore(midi: number): number {
  const octave = Math.floor(midi / 12);
  const index = midi % 12;
  // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
  return octave * 7 + WHITE_KEY_OFFSET_IN_OCTAVE[index]!;
}

function buildPianoKey(
  midi: number,
  accidentalPreference: 'sharps' | 'flats' = 'sharps',
  whiteKeyIndex?: number,
): PianoKey {
  const midiKey = createMidiKey(midi);
  const note = Note.fromMidi(midi, accidentalPreference);
  const chromaticIndexInOctave = createChromaticIndex(midi % 12);
  const color: 'white' | 'black' = isBlackKey(chromaticIndexInOctave) ? 'black' : 'white';

  const base = {
    note,
    midi: midiKey,
    chromaticIndex: note.chromaticIndex,
    octave: note.octave,
    color,
  } as const;

  if (color === 'white' && whiteKeyIndex !== undefined) {
    return { ...base, whiteKeyIndex };
  }

  return base;
}

function resolveToMidi(noteOrMidi: NoteLike | number): number {
  if (typeof noteOrMidi === 'number') {
    return noteOrMidi;
  }

  return Number(Note.create(noteOrMidi).midi);
}

function rangeToMidiPair(range: KeyboardRange): { readonly low: number; readonly high: number } {
  return { low: Number(range.from), high: Number(range.to) };
}

function buildKeyboardRange(from: NoteLike | number, to: NoteLike | number): KeyboardRange {
  const low = resolveToMidi(from);
  const high = resolveToMidi(to);

  if (low > high) {
    throw new RangeError(`Keyboard range start (${low}) must not exceed range end (${high}).`);
  }

  return {
    from: createMidiKey(low),
    to: createMidiKey(high),
  };
}

// ---------------------------------------------------------------------------
// Named range constants
// ---------------------------------------------------------------------------

/**
 * Standard 88-key piano range: A0 (MIDI 21) to C8 (MIDI 108).
 */
export const KEYBOARD_88: KeyboardRange = Object.freeze(buildKeyboardRange(21, 108));

/**
 * Standard 76-key keyboard range: E1 (MIDI 28) to G7 (MIDI 103).
 */
export const KEYBOARD_76: KeyboardRange = Object.freeze(buildKeyboardRange(28, 103));

/**
 * Standard 61-key keyboard range: C2 (MIDI 36) to C7 (MIDI 96).
 */
export const KEYBOARD_61: KeyboardRange = Object.freeze(buildKeyboardRange(36, 96));

/**
 * Standard 49-key keyboard range: C2 (MIDI 36) to C6 (MIDI 84).
 */
export const KEYBOARD_49: KeyboardRange = Object.freeze(buildKeyboardRange(36, 84));

/**
 * Standard 25-key keyboard range: C3 (MIDI 48) to C5 (MIDI 72).
 */
export const KEYBOARD_25: KeyboardRange = Object.freeze(buildKeyboardRange(48, 72));

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Creates a {@link KeyboardRange} from any combination of note names, MIDI numbers, or Note values.
 *
 * @param from The low end of the range.
 * @param to The high end of the range.
 * @returns The keyboard range.
 * @throws {RangeError} When `from` is higher than `to`, or MIDI values are out of range.
 */
export function keyboardRange(from: NoteLike | number, to: NoteLike | number): KeyboardRange {
  return buildKeyboardRange(from, to);
}

/**
 * Returns an ordered array of {@link PianoKey} objects for every key in the given range.
 *
 * Keys are returned in ascending MIDI order. White keys carry a `whiteKeyIndex` counting
 * from the start of the range.
 *
 * @param range The MIDI range to generate keys for.
 * @param options Keyboard options.
 * @returns The piano keys in the range, low to high.
 */
export function keyboardKeysForRange(
  range: KeyboardRange,
  options: KeyboardOptions = {},
): readonly PianoKey[] {
  const { accidentalPreference = 'sharps' } = options;
  const { low, high } = rangeToMidiPair(range);
  const whiteKeysBeforeStart = cumulativeWhiteKeysBefore(low);
  const keys: PianoKey[] = [];

  for (let midi = low; midi <= high; midi += 1) {
    const chromaticIndexInOctave = createChromaticIndex(midi % 12);
    const isWhite = !isBlackKey(chromaticIndexInOctave);
    const whiteKeyIndex = isWhite
      ? cumulativeWhiteKeysBefore(midi) - whiteKeysBeforeStart
      : undefined;

    keys.push(buildPianoKey(midi, accidentalPreference, whiteKeyIndex));
  }

  return Object.freeze(keys);
}

/**
 * Returns the {@link PianoKey} for a single note or MIDI number.
 *
 * Because there is no range, `whiteKeyIndex` is not set on the returned key.
 * To get a key with `whiteKeyIndex`, use {@link keyboardKeysForRange} instead.
 *
 * The spelling of the returned `note` is normalized via `accidentalPreference` (default `'sharps'`),
 * not preserved from the input. For example, both `'Db4'` and `'C#4'` return a key whose
 * `note` spells the pitch as `C#4` unless `{ accidentalPreference: 'flats' }` is passed.
 *
 * @param noteOrMidi The note or MIDI number to look up.
 * @param options Keyboard options.
 * @returns The piano key.
 * @throws {RangeError} When the MIDI number is out of range 0..127.
 * @throws {TypeError} When `noteOrMidi` is not a valid note-like value.
 */
export function pianoKeyFor(
  noteOrMidi: NoteLike | number,
  options: KeyboardOptions = {},
): PianoKey {
  const { accidentalPreference = 'sharps' } = options;
  const midi = resolveToMidi(noteOrMidi);

  return buildPianoKey(midi, accidentalPreference);
}

/**
 * Returns the {@link KeyboardPosition} of a note within a range, or `null` when out of range.
 *
 * @param noteOrMidi The note or MIDI number to locate.
 * @param range The keyboard range to search within.
 * @param options Keyboard options.
 * @returns The position within the range, or `null` when out of range.
 * @throws {RangeError} When the MIDI number is out of range 0..127.
 * @throws {TypeError} When `noteOrMidi` is not a valid note-like value.
 */
export function keyboardPositionFor(
  noteOrMidi: NoteLike | number,
  range: KeyboardRange,
  options: KeyboardOptions = {},
): KeyboardPosition | null {
  const midi = resolveToMidi(noteOrMidi);
  const { low, high } = rangeToMidiPair(range);

  if (midi < low || midi > high) {
    return null;
  }

  const { accidentalPreference = 'sharps' } = options;
  const index = midi - low;
  const whiteKeysBeforeStart = cumulativeWhiteKeysBefore(low);
  const chromaticIndexInOctave = createChromaticIndex(midi % 12);
  const isWhite = !isBlackKey(chromaticIndexInOctave);
  const whiteKeyIndex = isWhite
    ? cumulativeWhiteKeysBefore(midi) - whiteKeysBeforeStart
    : undefined;

  const key = buildPianoKey(midi, accidentalPreference, whiteKeyIndex);

  if (isWhite && whiteKeyIndex !== undefined) {
    return { index, whiteKeyIndex, key };
  }

  return { index, key };
}

/**
 * A value that can be highlighted on the keyboard: a Note, a Scale, a Chord, or a raw pitch-class number.
 */
export type HighlightTarget = Scale | Chord | NoteLike | number;

function chromaticIndexesForTarget(target: HighlightTarget): readonly ChromaticIndex[] {
  if (target instanceof Scale) {
    return Object.freeze(target.notes.map((note) => note.chromaticIndex));
  }

  if (target instanceof Chord) {
    return Object.freeze(target.notes.map((note) => note.chromaticIndex));
  }

  if (typeof target === 'number') {
    // Treat as a pitch-class number. Normalize into 0..11 first: JS `%` is
    // sign-preserving (e.g. `-1 % 12 === -1`), so a bare modulo would throw
    // for negative inputs. `((n % 12) + 12) % 12` maps any integer to 0..11.
    return Object.freeze([createChromaticIndex(((target % 12) + 12) % 12)]);
  }

  // NoteLike / Note
  const note = Note.create(target);

  return Object.freeze([note.chromaticIndex]);
}

/**
 * Maps a chord, scale, note, or pitch class to highlighted key positions within a range.
 *
 * Groups are returned in ascending chromatic-index order; groups with no keys in range
 * are omitted. Each group lists all keyboard positions sharing that pitch class.
 *
 * @param target The musical value to highlight.
 * @param range The keyboard range to search within.
 * @param options Keyboard options.
 * @returns The highlight groups in ascending pitch-class order.
 */
export function highlightGroupsForChordOrScale(
  target: HighlightTarget,
  range: KeyboardRange,
  options: KeyboardOptions = {},
): readonly KeyboardHighlight[] {
  const indexes = chromaticIndexesForTarget(target);
  const uniqueIndexes = [...new Set(indexes)].toSorted((left, right) => left - right);
  const keys = keyboardKeysForRange(range, options);
  const { low } = rangeToMidiPair(range);

  const groups: KeyboardHighlight[] = [];

  for (const chromaticIndex of uniqueIndexes) {
    const positions: KeyboardPosition[] = [];

    for (const key of keys) {
      if (key.chromaticIndex !== chromaticIndex) {
        continue;
      }

      const index = Number(key.midi) - low;
      const position: KeyboardPosition =
        key.whiteKeyIndex !== undefined
          ? { index, whiteKeyIndex: key.whiteKeyIndex, key }
          : { index, key };

      positions.push(position);
    }

    if (positions.length > 0) {
      groups.push({ chromaticIndex, positions: Object.freeze(positions) });
    }
  }

  return Object.freeze(groups);
}
