/**
 * Parses a Standard MIDI File (SMF) byte array and reconstructs a {@link Sequence}.
 */

import { Note } from '../note.js';
import { Sequence } from '../sequences/sequence.js';
import { Meter } from '../meter.js';
import { createRational } from '../rational.js';
import type { NoteEvent, MusicEvent } from '../sequences/types.js';
import { decodeVlq } from './variable-length.js';
import type { MidiFileDocument, MidiTrackEvent, MidiFileToSequenceOptions } from './types.js';

// ---------------------------------------------------------------------------
// Header parsing
// ---------------------------------------------------------------------------

function readUint32(data: Uint8Array, offset: number): number {
  // Callers must ensure data has at least offset+4 bytes; see length guard in parseMidiFile.
  // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
  return (
    ((data[offset]! << 24) |
      (data[offset + 1]! << 16) |
      (data[offset + 2]! << 8) |
      data[offset + 3]!) >>>
    0
  );
}

function readUint16(data: Uint8Array, offset: number): number {
  // Callers must ensure data has at least offset+2 bytes; see length guard in parseMidiFile.
  // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
  return ((data[offset]! << 8) | data[offset + 1]!) >>> 0;
}

function checkFourCC(data: Uint8Array, offset: number, expected: readonly number[]): boolean {
  for (let i = 0; i < 4; i++) {
    if (data[offset + i] !== expected[i]) return false;
  }

  return true;
}

const MTHD_BYTES = [0x4d, 0x54, 0x68, 0x64];
const MTRK_BYTES = [0x4d, 0x54, 0x72, 0x6b];

// ---------------------------------------------------------------------------
// Meta event parsing (extracted to keep parseTrackEvents under complexity 10)
// ---------------------------------------------------------------------------

type ParseMetaResult = {
  /** New position after consuming the meta event data. */
  readonly pos: number;
  /** Whether the end-of-track marker was found (caller should break). */
  readonly done: boolean;
  /** The parsed event to push. */
  readonly event: MidiTrackEvent;
};

/**
 * Decodes a meta event's length VLQ, ensuring the length field itself stays
 * within the track. A meta event whose length byte is missing (the track ends
 * right after `FF <type>`), or whose multi-byte VLQ runs past the track end,
 * must be rejected rather than borrowing bytes from the next chunk.
 *
 * @returns The decoded `metaLength` and the cursor positioned at the payload.
 * @throws {RangeError} When the length field lies outside the track.
 */
function decodeMetaLength(
  data: Uint8Array,
  cursor: number,
  end: number,
): { readonly metaLength: number; readonly cursor: number } {
  // Bound the decode at the track end so a length VLQ whose bytes run past the
  // track (a missing length byte, or a multi-byte VLQ overrunning the boundary)
  // throws before reading a byte that belongs to the next chunk.
  const { value: metaLength, bytesRead } = decodeVlq(data, cursor, end);

  return { metaLength, cursor: cursor + bytesRead };
}

function parseMetaEvent(
  data: Uint8Array,
  pos: number,
  end: number,
  deltaTicks: number,
): ParseMetaResult {
  // pos currently points at the byte after 0xFF
  if (pos >= end) {
    throw new RangeError(`Truncated meta event at offset ${pos}.`);
  }

  // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
  const metaType = data[pos]!;
  const { metaLength, cursor } = decodeMetaLength(data, pos + 1, end);

  if (metaType === 0x2f) {
    // End of track — metaLength must be 0 per SMF spec.
    if (metaLength !== 0) {
      throw new RangeError(`End-of-track meta event must have length 0, received ${metaLength}.`);
    }
    return {
      pos: cursor,
      done: true,
      event: { type: 'endOfTrack', deltaTicks },
    };
  }

  // Bounds check: the declared payload must fit within the track boundary.
  if (cursor + metaLength > end) {
    throw new RangeError(
      `Meta event payload (length ${metaLength}) at offset ${cursor} exceeds track boundary ${end}.`,
    );
  }

  if (metaType === 0x51 && metaLength === 3) {
    return parseTempoMeta(data, cursor, metaLength, deltaTicks);
  }

  if (metaType === 0x58 && metaLength === 4) {
    return parseTimeSignatureMeta(data, cursor, metaLength, deltaTicks);
  }

  // Unknown meta
  const metaData = data.slice(cursor, cursor + metaLength);
  return {
    pos: cursor + metaLength,
    done: false,
    event: { type: 'unknownMeta', deltaTicks, metaType, data: metaData },
  };
}

function parseTempoMeta(
  data: Uint8Array,
  pos: number,
  metaLength: number,
  deltaTicks: number,
): ParseMetaResult {
  // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
  const b0 = data[pos]!;
  // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
  const b1 = data[pos + 1]!;
  // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
  const b2 = data[pos + 2]!;

  const microsecondsPerQuarter = (b0 << 16) | (b1 << 8) | b2;
  return {
    pos: pos + metaLength,
    done: false,
    event: { type: 'tempo', deltaTicks, microsecondsPerQuarter },
  };
}

function parseTimeSignatureMeta(
  data: Uint8Array,
  pos: number,
  metaLength: number,
  deltaTicks: number,
): ParseMetaResult {
  // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
  const b0 = data[pos]!;
  // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
  const b1 = data[pos + 1]!;
  // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
  const b2 = data[pos + 2]!;
  // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
  const b3 = data[pos + 3]!;

  return {
    pos: pos + metaLength,
    done: false,
    event: {
      type: 'timeSignature',
      deltaTicks,
      numerator: b0,
      denominator: Math.pow(2, b1),
      clocksPerClick: b2,
      thirtySecondNotesPerQuarter: b3,
    },
  };
}

// ---------------------------------------------------------------------------
// Track event parsing
// ---------------------------------------------------------------------------

function parseTrackEvents(
  data: Uint8Array,
  offset: number,
  length: number,
): readonly MidiTrackEvent[] {
  const end = offset + length;
  const events: MidiTrackEvent[] = [];
  let pos = offset;
  let runningStatus = 0;

  while (pos < end) {
    const { value: deltaTicks, bytesRead } = decodeVlq(data, pos, end);
    pos += bytesRead;

    if (pos >= end) {
      throw new RangeError(`Truncated track data after delta time at offset ${pos}.`);
    }

    // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
    const firstByte = data[pos]!;

    if (firstByte === 0xff) {
      pos++;
      const result = parseMetaEvent(data, pos, end, deltaTicks);
      pos = result.pos;
      runningStatus = 0;

      events.push(result.event);

      if (result.done) break;
    } else if (firstByte >= 0xf0) {
      // SysEx (0xF0, 0xF7) and other system messages are not supported.
      // Silently mis-parsing them as channel events would desync the parser.
      throw new TypeError(
        `Unsupported system status byte 0x${firstByte.toString(16).toUpperCase()} at offset ${pos}; SysEx and system messages are not supported.`,
      );
    } else if ((firstByte & 0x80) !== 0) {
      // Status byte present — update running status
      runningStatus = firstByte;
      pos++;
      pos = parseChannelEvent(data, pos, end, deltaTicks, runningStatus, events);
    } else {
      // No status byte — use running status
      if (runningStatus === 0) {
        throw new TypeError(`Running status used before any status byte at offset ${pos}.`);
      }

      pos = parseChannelEvent(data, pos, end, deltaTicks, runningStatus, events);
    }
  }

  return events;
}

function validateDataByte(value: number, offset: number): void {
  if (value > 0x7f) {
    throw new RangeError(
      `Invalid MIDI data byte 0x${value.toString(16).toUpperCase()} at offset ${offset}; data bytes must be 0..127.`,
    );
  }
}

function parseChannelEvent(
  data: Uint8Array,
  pos: number,
  end: number,
  deltaTicks: number,
  status: number,
  events: MidiTrackEvent[],
): number {
  const eventType = (status >> 4) & 0x0f;
  const channel = status & 0x0f;

  const needed = channelEventDataLength(eventType);

  if (pos + needed > end) {
    throw new RangeError(`Truncated channel event at offset ${pos}.`);
  }

  // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
  const b0 = data[pos]!;
  validateDataByte(b0, pos);

  if (eventType === 0x09) {
    // Note-on
    // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
    const b1 = data[pos + 1]!;
    validateDataByte(b1, pos + 1);
    events.push({ type: 'noteOn', deltaTicks, channel, noteNumber: b0, velocity: b1 });
    return pos + 2;
  } else if (eventType === 0x08) {
    // Note-off
    // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
    const b1 = data[pos + 1]!;
    validateDataByte(b1, pos + 1);
    events.push({ type: 'noteOff', deltaTicks, channel, noteNumber: b0, velocity: b1 });
    return pos + 2;
  } else {
    // Other channel events — skip, validating all data bytes
    for (let i = 1; i < needed; i++) {
      // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
      validateDataByte(data[pos + i]!, pos + i);
    }
    return pos + needed;
  }
}

function channelEventDataLength(eventType: number): number {
  // 4 = program change (1 data byte), 5 = channel pressure (1 data byte)
  // All other channel events have 2 data bytes.
  if (eventType === 0x0c || eventType === 0x0d) return 1;

  return 2;
}

// ---------------------------------------------------------------------------
// Track chunk loop (extracted to keep parseMidiFile under complexity 10)
// ---------------------------------------------------------------------------

function parseTracks(
  data: Uint8Array,
  ntrks: number,
  startPos: number,
): { readonly tracks: (readonly MidiTrackEvent[])[]; readonly pos: number } {
  const tracks: (readonly MidiTrackEvent[])[] = [];
  let pos = startPos;

  for (let t = 0; t < ntrks; t++) {
    if (pos + 8 > data.length) {
      throw new RangeError(`Truncated track chunk header at offset ${pos}.`);
    }

    if (!checkFourCC(data, pos, MTRK_BYTES)) {
      throw new TypeError(`Expected 'MTrk' at offset ${pos}.`);
    }

    const trackLength = readUint32(data, pos + 4);
    pos += 8;

    if (pos + trackLength > data.length) {
      throw new RangeError(
        `Track ${t} declares length ${trackLength} at offset ${pos} but file only has ${data.length - pos} bytes remaining.`,
      );
    }

    tracks.push(parseTrackEvents(data, pos, trackLength));
    pos += trackLength;
  }

  return { tracks, pos };
}

// ---------------------------------------------------------------------------
// Public: parseMidiFile
// ---------------------------------------------------------------------------

/**
 * Parses a Standard MIDI File byte array into a structured document.
 *
 * @param data The raw SMF bytes.
 * @returns The parsed MIDI file document.
 * @throws {TypeError} When the data does not start with a valid MThd header.
 * @throws {RangeError} When the data is truncated or contains an out-of-range value.
 */
export function parseMidiFile(data: Uint8Array): MidiFileDocument {
  if (data.length < 14) {
    throw new RangeError(
      `MIDI file too short: expected at least 14 bytes, received ${data.length}.`,
    );
  }

  if (!checkFourCC(data, 0, MTHD_BYTES)) {
    throw new TypeError(`Invalid MIDI file: expected 'MThd' at offset 0.`);
  }

  const headerLength = readUint32(data, 4);

  if (headerLength < 6) {
    throw new RangeError(
      `Invalid MThd header length: expected at least 6, received ${headerLength}.`,
    );
  }

  const rawFormat = readUint16(data, 8);

  if (rawFormat !== 0 && rawFormat !== 1) {
    throw new TypeError(
      `Unsupported MIDI file format ${rawFormat}; only format 0 and 1 are supported.`,
    );
  }

  // rawFormat is validated to be 0 or 1 by the check above; cast narrows the type.
  // oxlint-disable-next-line typescript-eslint/no-unnecessary-type-assertion
  const format = rawFormat as 0 | 1;
  const ntrks = readUint16(data, 10);
  const division = readUint16(data, 12);

  if ((division & 0x8000) !== 0) {
    throw new TypeError(
      `SMPTE time code division is not supported (high bit set in division field).`,
    );
  }

  const { tracks, pos: _finalPos } = parseTracks(data, ntrks, 8 + headerLength);

  return { format, ticksPerQuarter: division, tracks };
}

// ---------------------------------------------------------------------------
// Public: midiFileToSequence
// ---------------------------------------------------------------------------

/**
 * Converts a Standard MIDI File byte array to a {@link Sequence}.
 *
 * Uses the last tempo meta event for BPM (multi-tempo files are reduced to
 * the final value). Uses the last time signature meta event for meter.
 * Note events are collected by matching note-on and
 * note-off pairs (treating note-on velocity 0 as note-off).
 *
 * @param data The raw SMF bytes.
 * @param options Optional conversion settings.
 * @returns The reconstructed sequence.
 * @throws {TypeError} When the data is not a valid SMF file.
 * @throws {RangeError} When the data is truncated or contains out-of-range values.
 */
export function midiFileToSequence(
  data: Uint8Array,
  options?: MidiFileToSequenceOptions,
): Sequence {
  const doc = parseMidiFile(data);
  const defaultTempo = options?.defaultTempo ?? 120;

  let tempoMicros = Math.round(60_000_000 / defaultTempo);
  let meterNumerator: number | null = null;
  let meterDenominator: number | null = null;

  const musicEvents: MusicEvent[] = [];

  for (const track of doc.tracks) {
    processTrack(
      track,
      doc.ticksPerQuarter,
      musicEvents,
      (micros) => {
        tempoMicros = micros;
      },
      (num, den) => {
        meterNumerator = num;
        meterDenominator = den;
      },
    );
  }

  musicEvents.sort((a, b) => {
    const aVal = a.start.numerator / a.start.denominator;
    const bVal = b.start.numerator / b.start.denominator;
    return aVal - bVal;
  });

  const bpm = Math.round(60_000_000 / tempoMicros);

  let meter: Meter | undefined;

  if (meterNumerator !== null && meterDenominator !== null) {
    try {
      meter = Meter.create(meterNumerator, meterDenominator);
    } catch {
      // If meter construction fails (e.g. non-power-of-2 denominator), omit it
    }
  }

  const sequenceOptions = meter !== undefined ? { tempo: bpm, meter } : { tempo: bpm };

  return Sequence.create(musicEvents, sequenceOptions);
}

/**
 * Key for the active-note map: channel * 128 + noteNumber.
 * This uniquely identifies a pitch-on-channel combination since noteNumber ≤ 127.
 */
function activeNoteKey(channel: number, noteNumber: number): number {
  return channel * 128 + noteNumber;
}

/**
 * FIFO queue of pending note-on onsets for a single (channel, noteNumber) key.
 * note-on pushes; note-off pops the oldest onset so overlapping notes pair correctly.
 */
type ActiveNoteQueue = Array<{ readonly onTick: number; readonly velocity: number }>;
type ActiveNoteMap = Map<number, ActiveNoteQueue>;

function isNoteOff(event: MidiTrackEvent): boolean {
  if (event.type === 'noteOff') return true;
  if (event.type === 'noteOn' && event.velocity === 0) return true;
  return false;
}

function resolveNoteOff(
  event: MidiTrackEvent,
  absoluteTick: number,
  activeNotes: ActiveNoteMap,
  ticksPerQuarter: number,
  musicEvents: MusicEvent[],
): void {
  if (event.type !== 'noteOn' && event.type !== 'noteOff') return;
  const key = activeNoteKey(event.channel, event.noteNumber);
  const queue = activeNotes.get(key);

  if (queue !== undefined && queue.length > 0) {
    // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
    const active = queue.shift()!;
    if (queue.length === 0) activeNotes.delete(key);
    const noteEvent = buildNoteEvent(
      event.noteNumber,
      active.onTick,
      absoluteTick,
      active.velocity,
      ticksPerQuarter,
    );
    if (noteEvent !== null) musicEvents.push(noteEvent);
  }
}

function processTrack(
  track: readonly MidiTrackEvent[],
  ticksPerQuarter: number,
  musicEvents: MusicEvent[],
  onTempo: (micros: number) => void,
  onMeter: (numerator: number, denominator: number) => void,
): void {
  let absoluteTick = 0;
  const activeNotes: ActiveNoteMap = new Map();

  for (const event of track) {
    absoluteTick += event.deltaTicks;

    if (event.type === 'tempo') {
      onTempo(event.microsecondsPerQuarter);
    } else if (event.type === 'timeSignature') {
      onMeter(event.numerator, event.denominator);
    } else if (event.type === 'noteOn' && event.velocity > 0) {
      const key = activeNoteKey(event.channel, event.noteNumber);
      const queue = activeNotes.get(key);
      if (queue !== undefined) {
        queue.push({ onTick: absoluteTick, velocity: event.velocity });
      } else {
        activeNotes.set(key, [{ onTick: absoluteTick, velocity: event.velocity }]);
      }
    } else if (isNoteOff(event)) {
      resolveNoteOff(event, absoluteTick, activeNotes, ticksPerQuarter, musicEvents);
    }
  }
}

function buildNoteEvent(
  noteNumber: number,
  onTick: number,
  offTick: number,
  velocity: number,
  ticksPerQuarter: number,
): NoteEvent | null {
  if (offTick <= onTick) return null;

  // Convert ticks to whole-note fractions.
  // 1 whole note = 4 quarters = 4 * ticksPerQuarter ticks
  const wholeTicks = 4 * ticksPerQuarter;
  const start = createRational(onTick, wholeTicks);
  const duration = createRational(offTick - onTick, wholeTicks);

  // MIDI note bytes are 0–127; Note.fromMidi accepts that full range.
  const note = Note.fromMidi(noteNumber);

  // velocity is always 1–127: callers only store note-on events where velocity > 0.
  return { type: 'note', note, start, duration, velocity };
}
