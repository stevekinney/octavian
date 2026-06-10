/**
 * Notation event construction and serialization.
 *
 * `toNotationEvent` converts a Note, Chord, or rest descriptor into a
 * renderer-neutral {@link NotationEvent} that carries spelled pitches, staff
 * positions, accidental decisions, and optional duration.
 *
 * `serializeNotationEvent` converts a {@link NotationEvent} to a plain JSON
 * object — safe to `JSON.stringify` and round-trip back via
 * `deserializeNotationEvent`.
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

// ---------------------------------------------------------------------------
// Public API: serializeNotationEvent / deserializeNotationEvent
// ---------------------------------------------------------------------------

/**
 * A JSON-serializable snapshot of a {@link NotationNoteEvent}.
 */
export type SerializedNotationNoteEvent = {
  readonly type: 'note';
  readonly noteName: string;
  readonly octave: number;
  readonly accidentalDisplay: AccidentalDisplay | null;
  readonly staffPosition: {
    readonly clef: Clef;
    readonly step: string;
    readonly octave: number;
    readonly lineOrSpace: number;
    readonly ledgerLines: number;
  };
  readonly duration?: Rational;
};

/**
 * A JSON-serializable snapshot of a {@link NotationChordEvent}.
 */
export type SerializedNotationChordEvent = {
  readonly type: 'chord';
  readonly notes: readonly SerializedNotationNoteEvent[];
  readonly duration?: Rational;
};

/**
 * A JSON-serializable snapshot of a {@link NotationRestEvent}.
 */
export type SerializedNotationRestEvent = {
  readonly type: 'rest';
  readonly duration?: Rational;
};

/**
 * A JSON-serializable snapshot of any {@link NotationEvent}.
 */
export type SerializedNotationEvent =
  | SerializedNotationNoteEvent
  | SerializedNotationChordEvent
  | SerializedNotationRestEvent;

/**
 * Serializes a {@link NotationNoteEvent} to a plain JSON-safe object.
 */
function serializeNoteEvent(event: NotationNoteEvent): SerializedNotationNoteEvent {
  const base = {
    type: 'note' as const,
    noteName: event.noteName,
    octave: event.octave,
    accidentalDisplay: event.accidentalDisplay,
    staffPosition: {
      clef: event.staffPosition.clef,
      step: event.staffPosition.step,
      octave: event.staffPosition.octave,
      lineOrSpace: event.staffPosition.lineOrSpace,
      ledgerLines: event.staffPosition.ledgerLines,
    },
  };
  if (event.duration !== undefined) {
    return { ...base, duration: event.duration };
  }
  return base;
}

/**
 * Converts a {@link NotationEvent} to a renderer-neutral JSON object that
 * preserves spelling, duration, clef, and key-signature accidental decisions.
 *
 * @param event - The notation event to serialize.
 * @returns A plain serializable snapshot.
 * @throws {TypeError} When the event discriminant is not recognized.
 */
export function serializeNotationEvent(event: NotationEvent): SerializedNotationEvent {
  switch (event.type) {
    case 'note':
      return serializeNoteEvent(event);
    case 'chord': {
      const base = {
        type: 'chord' as const,
        notes: event.notes.map(serializeNoteEvent),
      };
      if (event.duration !== undefined) {
        return { ...base, duration: event.duration };
      }
      return base;
    }
    case 'rest': {
      if (event.duration !== undefined) {
        return { type: 'rest', duration: event.duration };
      }
      return { type: 'rest' };
    }
    default:
      throw new TypeError(
        // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
        `Unknown notation event type: ${String((event as { type: unknown }).type)}.`,
      );
  }
}
