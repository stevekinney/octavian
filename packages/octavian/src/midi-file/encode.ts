/**
 * Encodes a {@link Sequence} to a Standard MIDI File (SMF) byte array.
 */

import type { Sequence } from '../sequences/sequence.js';
import type { MusicEvent, NoteEvent, ChordEvent } from '../sequences/types.js';
import { encodeVlq } from './variable-length.js';
import type { SequenceToMidiOptions } from './types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_TICKS_PER_QUARTER = 480;
const DEFAULT_CHANNEL = 0;
const DEFAULT_VELOCITY = 64;

/** MThd chunk ID bytes */
const MTHD = [0x4d, 0x54, 0x68, 0x64];
/** MTrk chunk ID bytes */
const MTRK = [0x4d, 0x54, 0x72, 0x6b];

// ---------------------------------------------------------------------------
// Low-level byte helpers
// ---------------------------------------------------------------------------

function writeUint32(value: number): readonly number[] {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

function writeUint16(value: number): readonly number[] {
  return [(value >>> 8) & 0xff, value & 0xff];
}

// ---------------------------------------------------------------------------
// Time conversion
// ---------------------------------------------------------------------------

/**
 * Converts a whole-note fraction to integer ticks.
 *
 * A whole note = 4 quarter notes, and division is ticks per quarter.
 * ticks = fraction * 4 * division, rounded to nearest integer.
 */
function rationalToTicks(numerator: number, denominator: number, division: number): number {
  return Math.round((numerator / denominator) * 4 * division);
}

// ---------------------------------------------------------------------------
// Meta event builders
// ---------------------------------------------------------------------------

function validateTempoForEncoding(bpm: number): number {
  // bpm normally comes from sequence.tempo, but Sequence's constructor is
  // protected — a subclass could supply a non-finite tempo, and `NaN` slips
  // through the range check below (NaN comparisons are always false). Reject it
  // explicitly so we never emit nonsense (00 00 00) tempo bytes.
  if (!Number.isFinite(bpm) || bpm <= 0) {
    throw new RangeError(`Tempo must be a finite positive number, received ${bpm}.`);
  }

  // Guard the SMF encoding range: microseconds per quarter must fit in a 24-bit field.
  const us = Math.round(60_000_000 / bpm);
  if (us < 1 || us > 0xffffff) {
    throw new RangeError(
      `Tempo ${bpm} BPM yields ${us} microseconds per quarter, which is outside the valid SMF range 1..16777215.`,
    );
  }
  return us;
}

function buildTempoEvent(deltaTicks: number, bpm: number): readonly number[] {
  const us = validateTempoForEncoding(bpm);
  return [
    ...encodeVlq(deltaTicks),
    0xff,
    0x51,
    0x03,
    (us >>> 16) & 0xff,
    (us >>> 8) & 0xff,
    us & 0xff,
  ];
}

function buildTimeSignatureEvent(
  deltaTicks: number,
  numerator: number,
  denominator: number,
): readonly number[] {
  // dd is the power-of-2 exponent of the denominator (e.g. 4 -> 2, 8 -> 3)
  const dd = Math.round(Math.log2(denominator));
  return [
    ...encodeVlq(deltaTicks),
    0xff,
    0x58,
    0x04,
    numerator,
    dd,
    0x18, // 24 MIDI clocks per metronome click (standard)
    0x08, // 8 thirty-second notes per MIDI quarter (standard)
  ];
}

function buildEndOfTrackEvent(deltaTicks: number): readonly number[] {
  return [...encodeVlq(deltaTicks), 0xff, 0x2f, 0x00];
}

// ---------------------------------------------------------------------------
// Note event pair collection
// ---------------------------------------------------------------------------

type NoteEventPair = {
  readonly onTick: number;
  readonly offTick: number;
  readonly noteNumber: number;
  readonly velocity: number;
};

function validateEventVelocity(velocity: number): void {
  if (velocity === 0) {
    throw new RangeError(
      `Note event velocity must be 1..127 for MIDI conversion (0 is interpreted as note-off), received 0.`,
    );
  }
}

function collectNoteEventPairs(event: NoteEvent, division: number): readonly NoteEventPair[] {
  const onTick = rationalToTicks(event.start.numerator, event.start.denominator, division);
  const durationTicks = rationalToTicks(
    event.duration.numerator,
    event.duration.denominator,
    division,
  );
  const offTick = onTick + durationTicks;
  const noteNumber = Number(event.note.midi);
  const velocity = event.velocity ?? DEFAULT_VELOCITY;
  validateEventVelocity(velocity);

  return [{ onTick, offTick, noteNumber, velocity }];
}

function collectChordNoteEventPairs(event: ChordEvent, division: number): readonly NoteEventPair[] {
  const onTick = rationalToTicks(event.start.numerator, event.start.denominator, division);
  const durationTicks = rationalToTicks(
    event.duration.numerator,
    event.duration.denominator,
    division,
  );
  const offTick = onTick + durationTicks;
  const velocity = event.velocity ?? DEFAULT_VELOCITY;
  validateEventVelocity(velocity);

  return event.chord.notes.map((note) => ({
    onTick,
    offTick,
    noteNumber: Number(note.midi),
    velocity,
  }));
}

// ---------------------------------------------------------------------------
// Track bytes builder
// ---------------------------------------------------------------------------

type TickEvent = {
  readonly tick: number;
  readonly isNoteOn: boolean;
  readonly noteNumber: number;
  readonly velocity: number;
};

function buildTickEvents(events: readonly MusicEvent[], division: number): readonly TickEvent[] {
  const tickEvents: TickEvent[] = [];

  for (const event of events) {
    let pairs: readonly NoteEventPair[];

    if (event.type === 'note') {
      pairs = collectNoteEventPairs(event, division);
    } else if (event.type === 'chord') {
      pairs = collectChordNoteEventPairs(event, division);
    } else {
      // rest — no MIDI events
      continue;
    }

    for (const pair of pairs) {
      tickEvents.push({
        tick: pair.onTick,
        isNoteOn: true,
        noteNumber: pair.noteNumber,
        velocity: pair.velocity,
      });
      // Use note-on with velocity 0 for note-off (consistent with spec note #31)
      tickEvents.push({
        tick: pair.offTick,
        isNoteOn: false,
        noteNumber: pair.noteNumber,
        velocity: 0,
      });
    }
  }

  // Sort by tick; note-offs before note-ons at same tick for clean output
  tickEvents.sort((a, b) => {
    if (a.tick !== b.tick) return a.tick - b.tick;
    if (!a.isNoteOn && b.isNoteOn) return -1;
    if (a.isNoteOn && !b.isNoteOn) return 1;
    return a.noteNumber - b.noteNumber;
  });

  return tickEvents;
}

function buildTrackBytes(
  events: readonly MusicEvent[],
  tempo: number,
  meter: { readonly numerator: number; readonly denominator: number } | null,
  division: number,
  channel: number,
): readonly number[] {
  const bytes: number[] = [];

  // Tempo meta at tick 0
  bytes.push(...buildTempoEvent(0, tempo));

  // Time signature meta at tick 0
  if (meter !== null) {
    bytes.push(...buildTimeSignatureEvent(0, meter.numerator, meter.denominator));
  } else {
    bytes.push(...buildTimeSignatureEvent(0, 4, 4));
  }

  const tickEvents = buildTickEvents(events, division);
  let currentTick = 0;

  for (const te of tickEvents) {
    const delta = te.tick - currentTick;
    currentTick = te.tick;
    // Always use 0x90 | ch: note-off is note-on with velocity 0 per SMF spec note #31
    const statusByte = 0x90 | (channel & 0x0f);
    bytes.push(...encodeVlq(delta), statusByte, te.noteNumber, te.velocity);
  }

  // End of track
  bytes.push(...buildEndOfTrackEvent(0));

  return bytes;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

function validateDivision(division: number): void {
  if (!Number.isInteger(division) || division < 1 || division > 0x7fff) {
    throw new RangeError(`ticksPerQuarter must be an integer in 1..32767, received ${division}.`);
  }
}

function validateChannel(channel: number): void {
  if (!Number.isInteger(channel) || channel < 0 || channel > 15) {
    throw new RangeError(`channel must be an integer in 0..15, received ${channel}.`);
  }
}

function validateOptions(options: SequenceToMidiOptions | undefined): {
  readonly division: number;
  readonly channel: number;
} {
  const division = options?.ticksPerQuarter ?? DEFAULT_TICKS_PER_QUARTER;
  const channel = options?.channel ?? DEFAULT_CHANNEL;
  validateDivision(division);
  validateChannel(channel);
  return { division, channel };
}

/**
 * Serializes an octavian {@link Sequence} to a valid Standard MIDI File byte array.
 *
 * Produces a Type 0 SMF (single track) with:
 * - A tempo meta event (FF 51 03 ...) derived from `sequence.tempo`
 * - A time signature meta event (FF 58 04 ...) derived from `sequence.meter` (defaults to 4/4)
 * - Note-on/off pairs for every note and chord event (note-off encoded as note-on with velocity 0)
 * - End-of-track marker (FF 2F 00)
 *
 * @param sequence The sequence to serialize.
 * @param options Optional serialization settings.
 * @returns The SMF bytes.
 */
export function sequenceToMidiFile(
  sequence: Sequence,
  options?: SequenceToMidiOptions,
): Uint8Array {
  const { division, channel } = validateOptions(options);

  const meter =
    sequence.meter !== null
      ? { numerator: sequence.meter.numerator, denominator: sequence.meter.denominator }
      : null;

  const trackBytes = buildTrackBytes(sequence.events, sequence.tempo, meter, division, channel);

  const output: number[] = [
    // MThd
    ...MTHD,
    // header length = 6
    ...writeUint32(6),
    // format = 0
    ...writeUint16(0),
    // ntrks = 1
    ...writeUint16(1),
    // division (ticks per quarter, high bit 0)
    ...writeUint16(division),
    // MTrk
    ...MTRK,
    // track byte length
    ...writeUint32(trackBytes.length),
    // track data
    ...trackBytes,
  ];

  return new Uint8Array(output);
}
