/**
 * Browser Web MIDI adapter — subscribe to a caller-owned MIDIAccess and
 * receive parsed MIDI messages, note transitions, and chord changes.
 *
 * ALL browser globals come from the caller via options. Nothing at module
 * scope touches `navigator`, `window`, `MIDIAccess`, or any other browser
 * global — the module is safe to import in non-browser environments (Bun,
 * Node) without throwing.
 */

import type { Note } from '../note.js';
import type { Chord } from '../chord.js';
import {
  parseMidiMessage,
  createMidiState,
  applyMidiMessage,
  notesFromActiveMidiState,
  chordFromActiveMidiState,
  messageToNote,
} from '../midi/index.js';
import type { MidiState } from '../midi/state.js';
import type { MidiMessage } from '../midi/types.js';
import type {
  MIDIInputLike,
  MIDIMessageEventLike,
  OnChordCallback,
  OnMessageCallback,
  OnNoteCallback,
  WebMidiInputController,
  WebMidiInputOptions,
} from './types.js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Returns a stable string key for chord-change detection.
 * Combines root note name, octave, and suffix to identify the exact chord.
 */
function chordKey(chord: Chord): string {
  return `${chord.root.note}${chord.suffix}:${chord.inversionIndex}`;
}

/**
 * Fires the onChord callback when the current chord differs from the previous.
 *
 * Handles all transitions:
 * - null → chord (new chord detected)
 * - chord → different chord (chord changed)
 * - chord → null (all notes released / chord no longer identifiable)
 * - chord → same chord (suppressed — no fire)
 */
function maybeFireChordChange(
  current: Chord | null,
  previous: Chord | null,
  onChord: OnChordCallback,
): void {
  const currentKey = current === null ? null : chordKey(current);
  const previousKey = previous === null ? null : chordKey(previous);

  if (currentKey !== previousKey) {
    onChord(current);
  }
}

// Channel-voice status bytes occupy 0x80–0xEF. A valid first byte must be a
// status byte (high bit set, i.e. >= 0x80) below the system range (< 0xF0):
//   - bytes < 0x80 are data bytes (a stray leading data byte — running-status
//     continuation or corruption — that this adapter does not reassemble);
//   - bytes >= 0xF0 are system messages (SysEx, timing clock, active sensing).
// Both are out of scope; parseMidiMessage throws for them, so we skip them
// explicitly here rather than letting an exception escape the message handler.
const CHANNEL_VOICE_STATUS_MIN = 0x80;
const SYSTEM_MESSAGE_THRESHOLD = 0xf0;

/**
 * Processes a raw MIDI message event: parses the bytes, updates state, and
 * fires caller callbacks.
 *
 * Only channel-voice messages (status byte 0x80–0xEF) are dispatched.
 * Empty data, stray data bytes (< 0x80), and system messages (>= 0xF0)
 * are silently skipped.
 *
 * Returns the new state after applying the message.
 */
function processMessageEvent(
  event: MIDIMessageEventLike,
  state: MidiState,
  previousChord: Chord | null,
  accidentalPreference: 'sharps' | 'flats',
  onMessage: OnMessageCallback | undefined,
  onNote: OnNoteCallback | undefined,
  onChord: OnChordCallback | undefined,
): { state: MidiState; chord: Chord | null } {
  // Guard: skip anything that is not a channel-voice status byte. Empty data
  // (undefined first byte), stray data bytes (< 0x80), and system messages
  // (>= 0xF0) are all out of scope; parseMidiMessage would throw for them.
  const status = event.data[0];
  if (
    status === undefined ||
    status < CHANNEL_VOICE_STATUS_MIN ||
    status >= SYSTEM_MESSAGE_THRESHOLD
  ) {
    return { state, chord: previousChord };
  }

  const parsed: MidiMessage = parseMidiMessage(event.data);

  // Fire onMessage for every successfully-parsed message.
  onMessage?.(parsed);

  // Advance the active-note state.
  const nextState = applyMidiMessage(state, parsed);

  // Fire onNote for note-bearing messages.
  if (onNote !== undefined) {
    const note: Note | null = messageToNote(parsed, { accidentalPreference });
    if (note !== null) {
      onNote(note, parsed);
    }
  }

  // Fire onChord when the chord changes.
  if (onChord !== undefined) {
    const currentChord: Chord | null = chordFromActiveMidiState(nextState, {
      accidentalPreference,
    });
    maybeFireChordChange(currentChord, previousChord, onChord);
    return { state: nextState, chord: currentChord };
  }

  return { state: nextState, chord: previousChord };
}

// ---------------------------------------------------------------------------
// createWebMidiInput
// ---------------------------------------------------------------------------

/**
 * Creates a Web MIDI input controller that subscribes to all inputs on the
 * provided `midiAccess` object.
 *
 * At creation time the controller iterates `midiAccess.inputs.values()` and
 * attaches an `onmidimessage` handler to every port. Incoming messages are
 * parsed with the MIDI helpers from `octavian/midi`, folded into an
 * active-note state, and dispatched to the caller-supplied callbacks.
 *
 * The controller is safe to import in non-browser environments — no browser
 * globals are referenced at module scope. All runtime objects come from
 * the caller via `options`.
 *
 * @example
 * ```ts
 * const access = await navigator.requestMIDIAccess();
 * const controller = createWebMidiInput({
 *   midiAccess: access,
 *   onNote: (note, msg) => console.log(msg.type, note.name),
 *   onChord: (chord) => console.log(chord?.name ?? 'no chord'),
 * });
 *
 * // Later:
 * controller.stop();
 * ```
 *
 * @param options Configuration including the MIDIAccess object and callbacks.
 * @returns A {@link WebMidiInputController} for querying state and stopping.
 */
export function createWebMidiInput(options: WebMidiInputOptions): WebMidiInputController {
  const { midiAccess, onMessage, onNote, onChord } = options;
  const accidentalPreference: 'sharps' | 'flats' = options.accidentalPreference ?? 'sharps';

  // Active-note state — updated on every incoming message.
  let state: MidiState = createMidiState();

  // Last chord seen — used for change-detection in onChord.
  let lastChord: Chord | null = null;

  // Capture inputs at creation time, each paired with the handler it had before
  // we bound ours, so teardown can RESTORE the caller's prior handler rather
  // than clobbering it — the MIDIAccess is caller-owned.
  //
  // Ownership model (v1): ONE controller per MIDIInput. Binding two controllers
  // to the same input concurrently, and hot-plug (ports added after creation),
  // are out of scope. A stopped controller is always inert (the `stopped` guard
  // below) and never clobbers a handler that is not ours (the teardown check).
  const boundInputs: Array<{
    input: MIDIInputLike;
    previous: ((event: MIDIMessageEventLike) => void) | null;
  }> = [];

  let stopped = false;

  // The single handler shared across all bound inputs. Inert once stopped, so a
  // late message delivered to a stale reference cannot reach a torn-down state.
  const handleMessage = (event: MIDIMessageEventLike): void => {
    if (stopped) return;
    const result = processMessageEvent(
      event,
      state,
      lastChord,
      accidentalPreference,
      onMessage,
      onNote,
      onChord,
    );
    state = result.state;
    lastChord = result.chord;
  };

  // Bind to every input available at creation time, remembering its prior handler.
  for (const input of midiAccess.inputs.values()) {
    boundInputs.push({ input, previous: input.onmidimessage });
    input.onmidimessage = handleMessage;
  }

  // Teardown: restore each input's prior handler — but only where ours is still
  // attached. If the caller (or anyone) replaced the handler after we bound,
  // leave their handler in place rather than clobbering it with a stale capture.
  function stop(): void {
    if (stopped) return;
    stopped = true;
    for (const { input, previous } of boundInputs) {
      if (input.onmidimessage === handleMessage) {
        input.onmidimessage = previous;
      }
    }
  }

  return {
    getNotes(): readonly Note[] {
      return notesFromActiveMidiState(state, { accidentalPreference });
    },

    getChord(): Chord | null {
      return chordFromActiveMidiState(state, { accidentalPreference });
    },

    stop,
    dispose: stop,
  };
}
