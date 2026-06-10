/**
 * Staff position calculation for notation rendering.
 *
 * Computes where a note sits on the staff given its natural letter and octave.
 * Accidentals (sharps/flats) do NOT affect staff position — C, C#, and Cb
 * all occupy the same line or space.
 */

import type { Clef } from '../clef.js';
import type { Natural } from '../note-spellings.js';
import { NATURALS, naturalFromNoteName } from '../note-spellings.js';
import { Note, type NoteLike } from '../note.js';
import type { StaffPosition } from './types.js';

// ---------------------------------------------------------------------------
// Clef reference points
// ---------------------------------------------------------------------------

/**
 * The reference point for a clef: the note on the bottom line of the staff
 * (position 0 in diatonic space). Used to compute `lineOrSpace` for any note.
 */
type ClefReference = {
  readonly natural: Natural;
  readonly octave: number;
};

const CLEF_REFERENCES: Record<Clef, ClefReference> = {
  treble: { natural: 'E', octave: 4 },
  bass: { natural: 'G', octave: 2 },
  alto: { natural: 'F', octave: 3 },
  tenor: { natural: 'D', octave: 3 },
  soprano: { natural: 'C', octave: 4 },
  'mezzo-soprano': { natural: 'A', octave: 3 },
  baritone: { natural: 'E', octave: 2 },
  percussion: { natural: 'E', octave: 4 },
};

// ---------------------------------------------------------------------------
// Diatonic helpers
// ---------------------------------------------------------------------------

/**
 * Returns the index of a natural letter in NATURALS (0 = C, …, 6 = B).
 *
 * `Natural` is the exact union of letters in `NATURALS`, so indexOf always
 * returns a valid 0..6 index.
 */
function naturalIndex(natural: Natural): number {
  return NATURALS.indexOf(natural);
}

/**
 * Computes the diatonic steps between two notes (note B relative to note A).
 *
 * Result is positive when B is above A, negative when below.
 *
 * @param aNatural - Natural letter of reference note A.
 * @param aOctave  - Octave of reference note A.
 * @param bNatural - Natural letter of note B.
 * @param bOctave  - Octave of note B.
 */
function diatonicSteps(
  aNatural: Natural,
  aOctave: number,
  bNatural: Natural,
  bOctave: number,
): number {
  return naturalIndex(bNatural) - naturalIndex(aNatural) + (bOctave - aOctave) * NATURALS.length;
}

// ---------------------------------------------------------------------------
// Ledger line count
// ---------------------------------------------------------------------------

/**
 * The staff spans positions 0 (bottom line) through 8 (top line).
 */
const STAFF_BOTTOM = 0;

/** Top staff line position. */
const STAFF_TOP = 8;

/**
 * Computes how many ledger lines are needed for a given `lineOrSpace` value.
 *
 * - 0 when the note is on the staff (0 ≤ pos ≤ 8).
 * - Below: ledger lines are drawn at even positions -2, -4, -6, …
 * - Above: ledger lines are drawn at even positions 10, 12, 14, …
 */
function ledgerLinesForPosition(lineOrSpace: number): number {
  if (lineOrSpace >= STAFF_BOTTOM && lineOrSpace <= STAFF_TOP) {
    return 0;
  }
  if (lineOrSpace < STAFF_BOTTOM) {
    return Math.ceil(-lineOrSpace / 2);
  }
  return Math.ceil((lineOrSpace - STAFF_TOP) / 2);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Computes the diatonic staff position of a note for the given clef.
 *
 * Staff position depends on the note letter (step) and octave only — the
 * accidental (C, C#, Cb) does NOT affect position.
 *
 * @param note - Any note-like value accepted by {@link Note.create}.
 * @param clef - The clef context.
 * @returns The {@link StaffPosition} for the note.
 * @throws {TypeError} When `clef` is not a supported value.
 */
export function staffPositionFor(note: NoteLike, clef: Clef): StaffPosition {
  const resolved = Note.create(note);
  const step = naturalFromNoteName(resolved.note);
  const octave = Number(resolved.octave);

  const reference = CLEF_REFERENCES[clef];
  if (!reference) {
    throw new TypeError(`Unsupported clef: ${clef}.`);
  }

  const lineOrSpace = diatonicSteps(reference.natural, reference.octave, step, octave);
  const ledgerLines = ledgerLinesForPosition(lineOrSpace);

  return { clef, step, octave, lineOrSpace, ledgerLines };
}
