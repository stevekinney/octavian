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
  let cursor = pos + 1;

  const { value: metaLength, bytesRead: mlBytes } = decodeVlq(data, cursor);
  cursor += mlBytes;

  if (metaType === 0x2f) {
    // End of track — emit the event so the parsed track is a faithful,
    // exhaustive record of the MidiTrackEvent union.
    return {
      pos: cursor + metaLength,
      done: true,
      event: { type: 'endOfTrack', deltaTicks },
    };
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
  const b0 = data[pos];
  const b1 = data[pos + 1];
  const b2 = data[pos + 2];

  if (b0 === undefined || b1 === undefined || b2 === undefined) {
    throw new RangeError(`Truncated tempo meta at offset ${pos}.`);
  }

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
  const b0 = data[pos];
  const b1 = data[pos + 1];
  const b2 = data[pos + 2];
  const b3 = data[pos + 3];

  if (b0 === undefined || b1 === undefined || b2 === undefined || b3 === undefined) {
    throw new RangeError(`Truncated time signature meta at offset ${pos}.`);
  }

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
    const { value: deltaTicks, bytesRead } = decodeVlq(data, pos);
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
    } else if ((firstByte & 0x80) !== 0) {
      // Status byte present — update running status
      runningStatus = firstByte;
      pos++;
      pos = parseChannelEvent(data, pos, deltaTicks, runningStatus, events);
    } else {
      // No status byte — use running status
      if (runningStatus === 0) {
        throw new TypeError(`Running status used before any status byte at offset ${pos}.`);
      }

      pos = parseChannelEvent(data, pos, deltaTicks, runningStatus, events);
    }
  }

  return events;
}

function parseChannelEvent(
  data: Uint8Array,
  pos: number,
  deltaTicks: number,
  status: number,
  events: MidiTrackEvent[],
): number {
  const eventType = (status >> 4) & 0x0f;
  const channel = status & 0x0f;

  const b0 = data[pos];
  const b1 = data[pos + 1];

  if (b0 === undefined) {
    throw new RangeError(`Truncated channel event at offset ${pos}.`);
  }

  if (eventType === 0x09) {
    // Note-on
    if (b1 === undefined) {
      throw new RangeError(`Truncated note-on event at offset ${pos}.`);
    }

    events.push({ type: 'noteOn', deltaTicks, channel, noteNumber: b0, velocity: b1 });

    return pos + 2;
  } else if (eventType === 0x08) {
    // Note-off
    if (b1 === undefined) {
      throw new RangeError(`Truncated note-off event at offset ${pos}.`);
    }

    events.push({ type: 'noteOff', deltaTicks, channel, noteNumber: b0, velocity: b1 });

    return pos + 2;
  } else {
    // Other channel events — skip based on event type
    const dataBytes = channelEventDataLength(eventType);
    return pos + dataBytes;
  }
}

function channelEventDataLength(eventType: number): number {
  // 4 = program change (1 data byte), 5 = channel pressure (1 data byte)
  // All other channel events have 2 data bytes.
  if (eventType === 0x0c || eventType === 0x0d) return 1;

  return 2;
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

  const tracks: (readonly MidiTrackEvent[])[] = [];
  let pos = 8 + headerLength;

  for (let t = 0; t < ntrks; t++) {
    if (pos + 8 > data.length) {
      throw new RangeError(`Truncated track chunk header at offset ${pos}.`);
    }

    if (!checkFourCC(data, pos, MTRK_BYTES)) {
      throw new TypeError(`Expected 'MTrk' at offset ${pos}.`);
    }

    const trackLength = readUint32(data, pos + 4);
    pos += 8;

    const trackEvents = parseTrackEvents(data, pos, trackLength);
    tracks.push(trackEvents);
    pos += trackLength;
  }

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

type ActiveNoteMap = Map<number, { readonly onTick: number; readonly velocity: number }>;

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
  const active = activeNotes.get(event.noteNumber);

  if (active !== undefined) {
    activeNotes.delete(event.noteNumber);
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
      activeNotes.set(event.noteNumber, { onTick: absoluteTick, velocity: event.velocity });
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
