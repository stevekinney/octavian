/**
 * Web MIDI message helpers — pure MIDI parsing, note conversion, and active-note
 * state model.
 *
 * Import as `octavian/midi` (this is a subpath export, not part of the root
 * barrel at `octavian`). The root `src/index.ts` MUST NOT re-export from
 * this module.
 *
 * Import path: `octavian/midi`
 */

// Values first, then types.

export { parseMidiMessage } from './parse.js';

export { messageToNote } from './note-helpers.js';

export {
  createMidiState,
  applyMidiMessage,
  notesFromActiveMidiState,
  chordFromActiveMidiState,
} from './state.js';

export { sequenceToMidiMessages } from './sequence-converter.js';

export { SUSTAIN_CONTROLLER, SUSTAIN_THRESHOLD } from './types.js';

export type {
  MidiMessage,
  NoteOnMessage,
  NoteOffMessage,
  ControlChangeMessage,
  ProgramChangeMessage,
  PitchBendMessage,
} from './types.js';

export type { MessageToNoteOptions } from './note-helpers.js';

export type { MidiState, ActiveMidiStateOptions } from './state.js';

export type { SequenceToMidiMessagesOptions, TimedMidiMessage } from './sequence-converter.js';
