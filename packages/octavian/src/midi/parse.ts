/**
 * Low-level MIDI byte parsing.
 *
 * {@link parseMidiMessage} decodes a raw status+data byte array into a typed
 * {@link MidiMessage} discriminated union. The MIDI specification defines the
 * status byte encoding:
 *
 *   high nibble  message type
 *   0x80         Note Off
 *   0x90         Note On  (velocity 0 is normalised to Note Off)
 *   0xB0         Control Change
 *   0xC0         Program Change
 *   0xE0         Pitch Bend
 *
 *   low nibble   channel (0..15)
 *
 * Pitch-bend data is 14-bit little-endian (LSB first, MSB second), centred at
 * 8192 (0 bend).
 */

import type {
  MidiMessage,
  NoteOnMessage,
  NoteOffMessage,
  ControlChangeMessage,
  ProgramChangeMessage,
  PitchBendMessage,
} from './types.js';
import { SUSTAIN_THRESHOLD, SUSTAIN_CONTROLLER } from './types.js';

// ---------------------------------------------------------------------------
// Status byte constants
// ---------------------------------------------------------------------------

const STATUS_NOTE_OFF = 0x80;
const STATUS_NOTE_ON = 0x90;
const STATUS_CONTROL_CHANGE = 0xb0;
const STATUS_PROGRAM_CHANGE = 0xc0;
const STATUS_PITCH_BEND = 0xe0;
const STATUS_TYPE_MASK = 0xf0;
const STATUS_CHANNEL_MASK = 0x0f;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function formatBytes(data: Uint8Array | readonly number[]): string {
  const hex = Array.from(data)
    .map((b) => `0x${b.toString(16).toUpperCase().padStart(2, '0')}`)
    .join(', ');
  return `[${hex}]`;
}

function requireLength(data: Uint8Array | readonly number[], minimum: number): void {
  if (data.length < minimum) {
    throw new TypeError(
      `MIDI message too short: expected at least ${minimum} bytes, received ${formatBytes(data)}.`,
    );
  }
}

/**
 * Validates that a byte is an integer within the given range.
 *
 * @param value The raw value to validate (may be undefined for out-of-bounds access).
 * @param field Human-readable field name used in error messages.
 * @param max The inclusive upper bound (0 is always the lower bound).
 * @returns The validated value.
 * @throws {TypeError} When `value` is not a number or not an integer.
 * @throws {RangeError} When `value` is out of the range 0..`max`.
 */
function validateByte(value: number | undefined, field: string, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new TypeError(`${field} must be an integer in 0..${max}, received ${String(value)}.`);
  }
  if (value < 0 || value > max) {
    throw new RangeError(`${field} must be an integer in 0..${max}, received ${value}.`);
  }
  return value;
}

// ---------------------------------------------------------------------------
// parseMidiMessage
// ---------------------------------------------------------------------------

/**
 * Parses a raw MIDI status+data byte array into a typed {@link MidiMessage}.
 *
 * MIDI conventions applied:
 * - A Note-On with velocity 0 is normalised to a {@link NoteOffMessage}.
 * - Pitch-bend data is a 14-bit little-endian pair (LSB, MSB), centred at 8192.
 * - Sustain pedal is CC 64; value >= 64 = on, value < 64 = off.
 *
 * @param data The raw MIDI bytes: `[statusByte, dataByte1, ...]`.
 * @returns The parsed message.
 * @throws {TypeError} When the message is too short, malformed, or the status
 *   nibble is not one of the five recognised channel-voice types.
 */
export function parseMidiMessage(data: Uint8Array | readonly number[]): MidiMessage {
  requireLength(data, 1);

  // Validate status byte range first (before masking), so out-of-range values
  // are rejected before type/channel extraction.
  const statusByte = validateByte(data[0], 'Status byte', 255);
  const type = statusByte & STATUS_TYPE_MASK;
  const channel = statusByte & STATUS_CHANNEL_MASK;

  if (type === STATUS_NOTE_OFF) {
    requireLength(data, 3);
    const note = validateByte(data[1], 'Note number', 127);
    const velocity = validateByte(data[2], 'Velocity', 127);
    const message: NoteOffMessage = { type: 'noteOff', channel, note, velocity };
    return message;
  }

  if (type === STATUS_NOTE_ON) {
    requireLength(data, 3);
    const note = validateByte(data[1], 'Note number', 127);
    const velocity = validateByte(data[2], 'Velocity', 127);

    // Per MIDI spec: Note-On with velocity 0 is equivalent to Note-Off.
    if (velocity === 0) {
      const message: NoteOffMessage = { type: 'noteOff', channel, note, velocity: 0 };
      return message;
    }

    const message: NoteOnMessage = { type: 'noteOn', channel, note, velocity };
    return message;
  }

  if (type === STATUS_CONTROL_CHANGE) {
    requireLength(data, 3);
    const controller = validateByte(data[1], 'Controller number', 127);
    const value = validateByte(data[2], 'Controller value', 127);
    const message: ControlChangeMessage = { type: 'controlChange', channel, controller, value };
    return message;
  }

  if (type === STATUS_PROGRAM_CHANGE) {
    requireLength(data, 2);
    const program = validateByte(data[1], 'Program number', 127);
    const message: ProgramChangeMessage = { type: 'programChange', channel, program };
    return message;
  }

  if (type === STATUS_PITCH_BEND) {
    requireLength(data, 3);
    const lsb = validateByte(data[1], 'Pitch-bend LSB', 127);
    const msb = validateByte(data[2], 'Pitch-bend MSB', 127);
    // 14-bit little-endian: value = (msb << 7) | lsb, range 0..16383, centre 8192.
    const value = (msb << 7) | lsb;
    const message: PitchBendMessage = { type: 'pitchBend', channel, value };
    return message;
  }

  throw new TypeError(`Unrecognised MIDI status byte in message ${formatBytes(data)}.`);
}

// Re-export so callers only need to import from this file.
export { SUSTAIN_CONTROLLER, SUSTAIN_THRESHOLD };
