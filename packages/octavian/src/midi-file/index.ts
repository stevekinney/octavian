/**
 * Standard MIDI File (SMF) serialization and parsing for octavian sequences.
 *
 * Import as `octavian/midi-file` (this is a subpath export, not part of the
 * root barrel at `octavian`). The root `src/index.ts` MUST NOT re-export from
 * this module. Public surface: `sequenceToMidiFile`, `parseMidiFile`, and
 * `midiFileToSequence`.
 */

export { sequenceToMidiFile } from './encode.js';
export { parseMidiFile, midiFileToSequence } from './decode.js';

export type {
  MidiNoteOnEvent,
  MidiNoteOffEvent,
  MidiTempoEvent,
  MidiTimeSignatureEvent,
  MidiEndOfTrackEvent,
  MidiUnknownMetaEvent,
  MidiTrackEvent,
  MidiFileDocument,
  SequenceToMidiOptions,
  MidiFileToSequenceOptions,
} from './types.js';
