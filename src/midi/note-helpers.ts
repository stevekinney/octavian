/**
 * Helpers for converting MIDI messages to music-theory {@link Note} objects.
 */

import { Note } from '../note.js';
import type { AccidentalPreference } from '../key-signatures.js';
import type { MidiMessage } from './types.js';

// ---------------------------------------------------------------------------
// messageToNote options
// ---------------------------------------------------------------------------

/**
 * Options for {@link messageToNote}.
 */
export type MessageToNoteOptions = {
  /**
   * Whether to prefer sharps or flats when spelling the note.
   * Defaults to `'sharps'`.
   */
  readonly accidentalPreference?: AccidentalPreference;
};

// ---------------------------------------------------------------------------
// messageToNote
// ---------------------------------------------------------------------------

/**
 * Converts a Note-On or Note-Off message to the corresponding {@link Note}.
 *
 * Returns `null` for Control Change, Program Change, and Pitch Bend messages,
 * which carry no note pitch.
 *
 * @param message The parsed MIDI message.
 * @param options Optional spelling preference for accidentals.
 * @returns The corresponding note, or `null` when the message type is not note-bearing.
 */
export function messageToNote(message: MidiMessage, options?: MessageToNoteOptions): Note | null {
  if (message.type !== 'noteOn' && message.type !== 'noteOff') {
    return null;
  }

  const preference = options?.accidentalPreference ?? 'sharps';
  return Note.fromMidi(message.note, preference);
}
