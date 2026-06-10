/**
 * Domain types for the notation subpath module.
 *
 * These types are renderer-neutral: they describe the musical and visual
 * properties of a notation event without specifying how it is drawn.
 */

import type { Clef } from '../clef.js';
import type { Natural, NoteName } from '../note-spellings.js';
import type { KeySignatureInformation } from '../key-signature-catalog.js';
import type { Rational } from '../rational.js';

// ---------------------------------------------------------------------------
// Re-export upstream types needed by consumers of this module
// ---------------------------------------------------------------------------

export type { Clef, KeySignatureInformation };

// ---------------------------------------------------------------------------
// StaffPosition
// ---------------------------------------------------------------------------

/**
 * A diatonic staff position for a note relative to a given clef.
 *
 * - `clef`: the clef context for this position.
 * - `step`: the note's natural letter (the "step" in diatonic space).
 * - `octave`: the octave of the note.
 * - `lineOrSpace`: integer diatonic distance from the bottom line of the
 *   staff (0 = bottom line, 1 = first space, 2 = second line, …, 8 = top
 *   line). Negative values are below the staff; values > 8 are above.
 * - `ledgerLines`: the number of ledger lines needed (0 when on-staff).
 *   Positive values are valid for both above and below (direction is
 *   determined by the sign of `lineOrSpace`).
 */
export type StaffPosition = {
  readonly clef: Clef;
  readonly step: Natural;
  readonly octave: number;
  readonly lineOrSpace: number;
  readonly ledgerLines: number;
};

// ---------------------------------------------------------------------------
// AccidentalDisplay
// ---------------------------------------------------------------------------

/**
 * The accidental glyph a renderer must draw for a note in context.
 *
 * `null` means no accidental is drawn (the key signature already implies the
 * correct spelling for this note).
 */
export type AccidentalDisplay =
  | 'sharp'
  | 'flat'
  | 'natural'
  | 'double-sharp'
  | 'double-flat'
  | 'triple-sharp'
  | 'triple-flat';

// ---------------------------------------------------------------------------
// NotationEvent
// ---------------------------------------------------------------------------

/**
 * A notation note event — a single sounding pitch with staff context.
 */
export type NotationNoteEvent = {
  /** Discriminant. */
  readonly type: 'note';
  /** The note name (letter + accidental). */
  readonly noteName: NoteName;
  /** The octave. */
  readonly octave: number;
  /** The accidental glyph to draw, or `null` if the key signature implies the correct spelling. */
  readonly accidentalDisplay: AccidentalDisplay | null;
  /** The note's position on the staff. */
  readonly staffPosition: StaffPosition;
  /** Optional duration as a whole-note fraction. */
  readonly duration?: Rational;
};

/**
 * A notation chord event — multiple simultaneous pitches with staff context.
 */
export type NotationChordEvent = {
  /** Discriminant. */
  readonly type: 'chord';
  /** The notes in the chord, each with staff context. */
  readonly notes: readonly NotationNoteEvent[];
  /** Optional duration as a whole-note fraction. */
  readonly duration?: Rational;
};

/**
 * A notation rest event.
 */
export type NotationRestEvent = {
  /** Discriminant. */
  readonly type: 'rest';
  /** Optional duration as a whole-note fraction. */
  readonly duration?: Rational;
};

/**
 * A renderer-neutral notation event that carries spelled pitch(es), optional
 * duration, and staff context.
 */
export type NotationEvent = NotationNoteEvent | NotationChordEvent | NotationRestEvent;

// ---------------------------------------------------------------------------
// Options for toNotationEvent
// ---------------------------------------------------------------------------

/**
 * Options for {@link toNotationEvent}.
 */
export type NotationEventOptions = {
  /** The clef context. Defaults to `'treble'`. */
  readonly clef?: Clef;
  /** The key signature context. When absent, C major (no accidentals) is assumed. */
  readonly keySignature?: KeySignatureInformation;
  /** Optional duration as a whole-note fraction. */
  readonly duration?: Rational;
};
