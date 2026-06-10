/**
 * Renderer-neutral notation primitives for octavian.
 *
 * Import as `octavian/notation` (this is a subpath export, not part of the
 * root barrel at `octavian`). The root `src/index.ts` MUST NOT re-export
 * from this module.
 *
 * Provides:
 * - {@link staffPositionFor} — diatonic staff position for a note in a clef.
 * - {@link accidentalForDisplay} — accidental glyph decision given a key signature.
 * - {@link toNotationEvent} — build a notation event from a Note, Chord, or rest.
 * - {@link serializeNotationEvent} — render-neutral JSON serialization.
 *
 * Import path: `octavian/notation`
 */

// Values
export { staffPositionFor } from './staff-position.js';
export { accidentalForDisplay } from './accidental-display.js';
export { toNotationEvent, serializeNotationEvent } from './notation-event.js';

// Types
export type {
  StaffPosition,
  AccidentalDisplay,
  NotationEvent,
  NotationNoteEvent,
  NotationChordEvent,
  NotationRestEvent,
  NotationEventOptions,
  Clef,
  KeySignatureInformation,
} from './types.js';
export type {
  NotationInput,
  SerializedNotationEvent,
  SerializedNotationNoteEvent,
  SerializedNotationChordEvent,
  SerializedNotationRestEvent,
} from './notation-event.js';
