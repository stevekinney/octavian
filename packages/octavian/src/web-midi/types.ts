/**
 * Structural interfaces for Web MIDI API objects used by {@link createWebMidiInput}.
 *
 * tsconfig `lib` is `["ESNext"]` — real `MIDIAccess`, `MIDIInput`, and
 * `MIDIMessageEvent` are not known type names here. These minimal interfaces
 * describe exactly the members this module calls. Any Web MIDI object that
 * satisfies the shapes can be passed in.
 *
 * Signatures are MDN-accurate. Only members actually used by this module are
 * declared — every extra member would be unverified surface.
 */

import type { Note } from '../note.js';
import type { Chord } from '../chord.js';
import type { MidiMessage } from '../midi/types.js';

// ---------------------------------------------------------------------------
// Web MIDI structural interfaces
// ---------------------------------------------------------------------------

/**
 * A single Web MIDI input port.
 *
 * The adapter binds and unbinds by assigning the `onmidimessage` property
 * directly (MDN's primary surface; equivalent to addEventListener('midimessage')).
 */
export type MIDIInputLike = {
  /** Handler invoked for each incoming MIDI message event, or null when unbound. */
  onmidimessage: ((event: MIDIMessageEventLike) => void) | null;
};

/**
 * A Web MIDI message event.
 *
 * Per the Web MIDI spec, `data` is a non-null `Uint8Array`. The adapter still
 * skips any event whose data is empty or whose first byte is not a channel-voice
 * status byte.
 */
export type MIDIMessageEventLike = {
  /** Raw MIDI bytes (the message's status + data bytes). */
  readonly data: Uint8Array;
};

/**
 * A read-only Map-like collection of MIDI inputs keyed by port id.
 *
 * MDN: `MIDIInputMap` is a read-only Map<string, MIDIInput>. The adapter only
 * iterates `values()` — no key access is needed.
 */
export type MIDIInputsLike = {
  /** Returns an iterator over all current MIDI inputs. */
  values(): IterableIterator<MIDIInputLike>;
};

/**
 * A Web MIDI access object returned by `navigator.requestMIDIAccess()`.
 *
 * The caller owns permissions and construction; the adapter only reads
 * `midiAccess.inputs` to enumerate and bind ports.
 */
export type MIDIAccessLike = {
  /** The available MIDI input ports. */
  readonly inputs: MIDIInputsLike;
};

// ---------------------------------------------------------------------------
// Callback types
// ---------------------------------------------------------------------------

/**
 * Callback invoked for every successfully-parsed MIDI message.
 */
export type OnMessageCallback = (message: MidiMessage) => void;

/**
 * Callback invoked when a note-on or note-off event is received.
 *
 * Both the resolved {@link Note} and the originating {@link MidiMessage} are
 * provided so the consumer can distinguish press from release via `message.type`.
 */
export type OnNoteCallback = (note: Note, message: MidiMessage) => void;

/**
 * Callback invoked when the detected chord changes.
 *
 * Fires when the chord transitions: null → chord, chord → different chord, or
 * chord → null (all notes released). Does NOT fire when the chord is unchanged.
 * Receives the new chord, or null when no chord is detectable.
 */
export type OnChordCallback = (chord: Chord | null) => void;

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/**
 * Options for {@link createWebMidiInput}.
 */
export type WebMidiInputOptions = {
  /** The Web MIDI access object whose inputs will be subscribed to. */
  readonly midiAccess: MIDIAccessLike;

  /**
   * Invoked for every successfully-parsed MIDI message arriving on any input.
   * Optional.
   */
  readonly onMessage?: OnMessageCallback;

  /**
   * Invoked on note-on and note-off transitions with the resolved note and
   * the originating message. Optional.
   */
  readonly onNote?: OnNoteCallback;

  /**
   * Invoked when the detected chord changes (including to null). Optional.
   */
  readonly onChord?: OnChordCallback;

  /**
   * Accidental preference for spelling note names. Defaults to `'sharps'`.
   */
  readonly accidentalPreference?: 'sharps' | 'flats';
};

// ---------------------------------------------------------------------------
// Controller return type
// ---------------------------------------------------------------------------

/**
 * The controller returned by {@link createWebMidiInput}.
 *
 * Exposes queryable state and teardown. `stop` and `dispose` are the same
 * function — use whichever fits your coding style.
 */
export type WebMidiInputController = {
  /**
   * Returns the currently-sounding notes (held + sustained).
   * Reads live state; call at any time.
   */
  getNotes(): readonly Note[];

  /**
   * Returns the currently-detectable chord, or null when fewer than 2 distinct
   * pitch classes are sounding or the pitch set does not match a known chord.
   */
  getChord(): Chord | null;

  /**
   * Detaches the MIDI message handler from every input bound at creation time.
   * Safe to call more than once. After stop(), further messages are ignored.
   */
  stop(): void;

  /**
   * Alias for {@link stop}. Detaches handlers from all bound inputs.
   */
  dispose(): void;
};
