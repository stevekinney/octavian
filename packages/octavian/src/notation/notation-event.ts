/**
 * Notation event construction.
 *
 * `toNotationEvent` converts a Note, Chord, or rest descriptor into a
 * renderer-neutral {@link NotationEvent} that carries spelled pitches, staff
 * positions, accidental decisions, and optional duration. All fields are plain
 * primitives or plain objects, so the result is directly JSON-serializable via
 * `JSON.stringify`.
 */

import { Note, type NoteLike } from '../note.js';
import { Chord } from '../chord.js';
import { keySignatureFor } from '../key-signature-catalog.js';
import { staffPositionFor } from './staff-position.js';
import { accidentalForDisplay } from './accidental-display.js';
import type {
  NotationEvent,
  NotationNoteEvent,
  NotationEventOptions,
  AccidentalDisplay,
  StaffPosition,
} from './types.js';
import type { KeySignatureInformation } from '../key-signature-catalog.js';
import type { Clef } from '../clef.js';
import type { Rational } from '../rational.js';

// ---------------------------------------------------------------------------
// Default key signature (C major — no accidentals)
// ---------------------------------------------------------------------------

const C_MAJOR: KeySignatureInformation = keySignatureFor('C', 'major');

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Builds a single {@link NotationNoteEvent} for a Note value with context.
 */
function buildNoteEvent(
  note: Note,
  clef: Clef,
  keySignature: KeySignatureInformation,
  duration: Rational | undefined,
): NotationNoteEvent {
  const staffPosition: StaffPosition = staffPositionFor(note, clef);
  const accidentalDisplay: AccidentalDisplay | null = accidentalForDisplay(note, keySignature);
  const base = {
    type: 'note' as const,
    noteName: note.note,
    octave: Number(note.octave),
    accidentalDisplay,
    staffPosition,
  };
  if (duration !== undefined) {
    return { ...base, duration };
  }
  return base;
}

// ---------------------------------------------------------------------------
// Public API: toNotationEvent
// ---------------------------------------------------------------------------

/**
 * A value that can be converted to a {@link NotationEvent}.
 *
 * - A {@link Note} or {@link NoteLike} string/object → note event.
 * - A {@link Chord} → chord event (each note gets its own staff position).
 * - `'rest'` → rest event.
 */
export type NotationInput = NoteLike | Chord | 'rest';

/**
 * Converts a Note, Chord, or rest into a renderer-neutral {@link NotationEvent}.
 *
 * @param value   - A note-like value, a {@link Chord}, or the string `'rest'`.
 * @param options - Context: clef, key signature, and optional duration.
 * @returns The corresponding {@link NotationEvent}.
 * @throws {TypeError} When `value` is not a recognized input type.
 */
export function toNotationEvent(
  value: NotationInput,
  options: NotationEventOptions = {},
): NotationEvent {
  const clef: Clef = options.clef ?? 'treble';
  const keySignature: KeySignatureInformation = options.keySignature ?? C_MAJOR;
  const duration: Rational | undefined = options.duration;

  if (value === 'rest') {
    if (duration !== undefined) {
      return { type: 'rest', duration };
    }
    return { type: 'rest' };
  }

  if (value instanceof Chord) {
    const noteEvents: NotationNoteEvent[] = value.notes.map((note) =>
      buildNoteEvent(note, clef, keySignature, duration),
    );
    if (duration !== undefined) {
      return { type: 'chord', notes: noteEvents, duration };
    }
    return { type: 'chord', notes: noteEvents };
  }

  // Treat as NoteLike
  const note = Note.create(value);
  return buildNoteEvent(note, clef, keySignature, duration);
}
