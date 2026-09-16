/**
 * Browser Web MIDI adapter for octavian.
 *
 * Import as `octavian/web-midi` (this is a subpath export, not part of the
 * root barrel at `octavian`). The root `src/index.ts` MUST NOT re-export
 * from this module.
 *
 * Provides:
 * - {@link createWebMidiInput} — subscribe to a caller-owned MIDIAccess object,
 *   receive parsed MIDI messages, note transitions, and chord changes, and
 *   query the current active-note state.
 *
 * Import path: `octavian/web-midi`
 *
 * The module top level does NOT reference any browser global. All runtime Web
 * MIDI objects are provided by the caller via `options.midiAccess`. The module
 * is safe to import in non-browser environments (Bun, Node) without throwing.
 */

// Values first, then types.

export { createWebMidiInput } from './web-midi-input.js';

export type {
  MIDIAccessLike,
  MIDIInputLike,
  MIDIInputsLike,
  MIDIMessageEventLike,
  OnMessageCallback,
  OnNoteCallback,
  OnChordCallback,
  WebMidiInputOptions,
  WebMidiInputController,
} from './types.js';
