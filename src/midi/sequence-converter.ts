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
    return noteOnOff(event.note.midi, velocity, channel, event.startSeconds, endSeconds);
  }

  if (event.type === 'chord') {
    const velocity = event.velocity ?? defaultVelocity;
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

/**
 * Converts an octavian {@link Sequence} into an array of timed MIDI messages.
 *
 * Each note and chord event yields Note-On and Note-Off message pairs.
 * Rest events are silently skipped. The result is sorted by `timeSeconds`
 * ascending; ties preserve the note-on-before-note-off ordering within
 * a single event.
 *
 * @param sequence The sequence to convert.
 * @param options Channel and default velocity overrides.
 * @returns Sorted array of timed MIDI messages.
 */
export function sequenceToMidiMessages(
  sequence: Sequence,
  options?: SequenceToMidiMessagesOptions,
): readonly TimedMidiMessage[] {
  const channel = options?.channel ?? 0;
  const defaultVelocity = options?.defaultVelocity ?? 64;

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
