/**
 * Converts an octavian {@link Sequence} into timed MIDI messages.
 *
 * {@link sequenceToMidiMessages} uses `Sequence.toAbsoluteSeconds()` to
 * convert musical time to real time, then emits Note-On and Note-Off pairs
 * for every Note and Chord event. Rest events produce no messages.
 *
 * The output is a flat array sorted by `timeSeconds` ascending. Simultaneous
 * events (same `timeSeconds`) preserve the input order (Note-On before
 * Note-Off when they coincide).
 */

import type { MidiMessage } from './types.js';
import type { Sequence } from '../sequences/sequence.js';
import type { TimedMusicEvent } from '../sequences/types.js';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/**
 * Options for {@link sequenceToMidiMessages}.
 */
export type SequenceToMidiMessagesOptions = {
  /**
   * Default MIDI channel for all emitted messages (0..15). Defaults to `0`.
   */
  readonly channel?: number;

  /**
   * Default velocity for events that carry no explicit velocity. Defaults to `64`.
   */
  readonly defaultVelocity?: number;
};

// ---------------------------------------------------------------------------
// Output type
// ---------------------------------------------------------------------------

/**
 * A MIDI message paired with its absolute time in seconds.
 */
export type TimedMidiMessage = {
  /** The MIDI message. */
  readonly message: MidiMessage;
  /** Absolute offset from the sequence start, in seconds. */
  readonly timeSeconds: number;
};

// ---------------------------------------------------------------------------
// sequenceToMidiMessages
// ---------------------------------------------------------------------------

function noteOnOff(
  noteNumber: number,
  velocity: number,
  channel: number,
  startSeconds: number,
  endSeconds: number,
): readonly TimedMidiMessage[] {
  const on: TimedMidiMessage = {
    message: { type: 'noteOn', channel, note: noteNumber, velocity },
    timeSeconds: startSeconds,
  };
  const off: TimedMidiMessage = {
    message: { type: 'noteOff', channel, note: noteNumber, velocity: 0 },
    timeSeconds: endSeconds,
  };
  return [on, off];
}

function processEvent(
  event: TimedMusicEvent,
  channel: number,
  defaultVelocity: number,
): readonly TimedMidiMessage[] {
  const endSeconds = event.startSeconds + event.durationSeconds;

  if (event.type === 'note') {
    const velocity = event.velocity ?? defaultVelocity;
    if (velocity === 0) {
      throw new RangeError(
        `Note event velocity must be 1..127 for MIDI conversion (0 is interpreted as note-off), received 0.`,
      );
    }
    return noteOnOff(event.note.midi, velocity, channel, event.startSeconds, endSeconds);
  }

  if (event.type === 'chord') {
    const velocity = event.velocity ?? defaultVelocity;
    if (velocity === 0) {
      throw new RangeError(
        `Note event velocity must be 1..127 for MIDI conversion (0 is interpreted as note-off), received 0.`,
      );
    }
    const messages: TimedMidiMessage[] = [];
    for (const note of event.chord.notes) {
      const pairs = noteOnOff(note.midi, velocity, channel, event.startSeconds, endSeconds);
      for (const pair of pairs) {
        messages.push(pair);
      }
    }
    return messages;
  }

  // Rest: no MIDI messages.
  return [];
}

function validateChannel(channel: number): void {
  if (!Number.isInteger(channel) || channel < 0 || channel > 15) {
    throw new RangeError(`channel must be an integer in 0..15, received ${channel}.`);
  }
}

function validateDefaultVelocity(velocity: number): void {
  if (!Number.isInteger(velocity) || velocity < 1 || velocity > 127) {
    throw new RangeError(`defaultVelocity must be an integer in 1..127, received ${velocity}.`);
  }
}

/**
 * Validates options and returns resolved channel and defaultVelocity.
 *
 * @throws {RangeError} When channel is not an integer in 0..15.
 * @throws {RangeError} When defaultVelocity is not an integer in 1..127.
 */
function validateSequenceToMidiOptions(options: SequenceToMidiMessagesOptions | undefined): {
  readonly channel: number;
  readonly defaultVelocity: number;
} {
  const channel = options?.channel ?? 0;
  const defaultVelocity = options?.defaultVelocity ?? 64;

  if (options?.channel !== undefined) validateChannel(channel);
  if (options?.defaultVelocity !== undefined) validateDefaultVelocity(defaultVelocity);

  return { channel, defaultVelocity };
}

export function sequenceToMidiMessages(
  sequence: Sequence,
  options?: SequenceToMidiMessagesOptions,
): readonly TimedMidiMessage[] {
  const { channel, defaultVelocity } = validateSequenceToMidiOptions(options);

  const timedEvents = sequence.toAbsoluteSeconds();
  const result: TimedMidiMessage[] = [];

  for (const event of timedEvents) {
    const messages = processEvent(event, channel, defaultVelocity);
    for (const msg of messages) {
      result.push(msg);
    }
  }

  return Object.freeze(result.toSorted((a, b) => a.timeSeconds - b.timeSeconds));
}
