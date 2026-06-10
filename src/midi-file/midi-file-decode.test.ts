import { describe, it, expect } from 'bun:test';
import { Note } from '../note.js';
import { Sequence, musicalTime } from '../sequences/sequence.js';
import { sequenceToMidiFile } from './encode.js';
import { parseMidiFile, midiFileToSequence } from './decode.js';

// ---------------------------------------------------------------------------
// Helper shared by several tests in this file
// ---------------------------------------------------------------------------

function buildSimpleMidi(trackData: number[]): Uint8Array {
  // prettier-ignore
  return new Uint8Array([
    0x4d, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06, // MThd chunk header
    0x00, 0x00, 0x00, 0x01, 0x01, 0xe0,               // format=0, tracks=1, division=480
    0x4d, 0x54, 0x72, 0x6b,                           // MTrk chunk header
    0x00, 0x00, 0x00, trackData.length,               // track length
    ...trackData,
  ]);
}

// ---------------------------------------------------------------------------
// midiFileToSequence edge cases
// ---------------------------------------------------------------------------

describe('midiFileToSequence — edge cases', () => {
  it('ignores unknown meta events (does not crash, isNoteOff returns false for them)', () => {
    // Track contains an unknown meta event (type 0x07) followed by end-of-track.
    // This exercises the isNoteOff(unknownMeta) → false path in processTrack.
    // prettier-ignore
    const trackData = [
      0x00, 0xff, 0x07, 0x03, 0x61, 0x62, 0x63, // unknown meta
      0x00, 0xff, 0x2f, 0x00,                    // end of track
    ];
    const bytes = buildSimpleMidi(trackData);
    const result = midiFileToSequence(bytes);
    expect(result.events.length).toBe(0);
  });

  it('uses defaultTempo when no tempo meta event is present in the file', () => {
    // Build a minimal MIDI file with only end-of-track — no tempo meta.
    // prettier-ignore
    const trackData = [
      0x00, 0xff, 0x2f, 0x00, // delta=0, end of track
    ];
    // prettier-ignore
    const bytes = new Uint8Array([
      0x4d, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06, // MThd
      0x00, 0x00, 0x00, 0x01, 0x01, 0xe0,              // format=0, tracks=1, division=480
      0x4d, 0x54, 0x72, 0x6b,                          // MTrk
      0x00, 0x00, 0x00, trackData.length,              // track length
      ...trackData,
    ]);
    const result = midiFileToSequence(bytes, { defaultTempo: 100 });
    expect(result.tempo).toBe(100);
  });

  it('handles running status parsing (end-of-track only track)', () => {
    // prettier-ignore
    const trackData = [
      0x00, 0xff, 0x2f, 0x00, // delta=0, end of track
    ];
    // prettier-ignore
    const bytes = new Uint8Array([
      0x4d, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06, // MThd
      0x00, 0x00, 0x00, 0x01, 0x01, 0xe0,              // format=0, tracks=1, division=480
      0x4d, 0x54, 0x72, 0x6b,                          // MTrk
      0x00, 0x00, 0x00, 0x04,                          // track length = 4
      ...trackData,
    ]);
    const result = midiFileToSequence(bytes);
    expect(result.events.length).toBe(0);
    expect(result.tempo).toBe(120);
  });

  it('handles running status with actual repeated note-on events', () => {
    // prettier-ignore
    const trackData = [
      0x00, 0x90, 0x3c, 0x40, // note-on C4 vel 64
      0x78, 0x3c, 0x00,       // delta=120, running status, C4, vel 0 = note-off
      0x00, 0xff, 0x2f, 0x00, // end of track
    ];
    // prettier-ignore
    const bytes = new Uint8Array([
      0x4d, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06, // MThd
      0x00, 0x00, 0x00, 0x01, 0x01, 0xe0,              // format=0, tracks=1, division=480
      0x4d, 0x54, 0x72, 0x6b,                          // MTrk
      0x00, 0x00, 0x00, trackData.length,              // track length
      ...trackData,
    ]);
    const result = midiFileToSequence(bytes);
    expect(result.events.length).toBe(1);
    expect(result.events[0]?.type).toBe('note');
    if (result.events[0]?.type === 'note') {
      expect(result.events[0].note.midi).toBe(60); // C4
    }
  });

  it('ignores note-off events with no matching note-on', () => {
    // prettier-ignore
    const trackData = [
      0x00, 0x80, 0x3c, 0x00, // note-off C4 with no prior note-on
      0x00, 0xff, 0x2f, 0x00, // end of track
    ];
    // prettier-ignore
    const bytes = new Uint8Array([
      0x4d, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06, // MThd
      0x00, 0x00, 0x00, 0x01, 0x01, 0xe0,              // format=0, tracks=1, division=480
      0x4d, 0x54, 0x72, 0x6b,                          // MTrk
      0x00, 0x00, 0x00, trackData.length,              // track length
      ...trackData,
    ]);
    const result = midiFileToSequence(bytes);
    expect(result.events.length).toBe(0);
  });

  it('skips note events where off <= on (zero duration)', () => {
    // prettier-ignore
    const trackData = [
      0x00, 0x90, 0x3c, 0x40, // note-on C4 at tick 0
      0x00, 0x80, 0x3c, 0x00, // note-off C4 at tick 0 (same tick)
      0x00, 0xff, 0x2f, 0x00, // end of track
    ];
    // prettier-ignore
    const bytes = new Uint8Array([
      0x4d, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06, // MThd
      0x00, 0x00, 0x00, 0x01, 0x01, 0xe0,              // format=0, tracks=1, division=480
      0x4d, 0x54, 0x72, 0x6b,                          // MTrk
      0x00, 0x00, 0x00, trackData.length,              // track length
      ...trackData,
    ]);
    const result = midiFileToSequence(bytes);
    expect(result.events.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// parseMidiFile — track event parsing edge cases
// ---------------------------------------------------------------------------

describe('parseMidiFile — track event parsing', () => {
  it('parses unknown meta events', () => {
    // prettier-ignore
    const trackData = [
      0x00, 0xff, 0x07, 0x03, 0x61, 0x62, 0x63, // type 0x07, length 3
      0x00, 0xff, 0x2f, 0x00,                    // end of track
    ];
    const doc = parseMidiFile(buildSimpleMidi(trackData));
    const track = doc.tracks[0]!;
    const unknown = track.find((e) => e.type === 'unknownMeta');
    expect(unknown).toBeDefined();
    if (unknown?.type === 'unknownMeta') {
      expect(unknown.metaType).toBe(0x07);
    }
  });

  it('emits the end-of-track meta event as the final track event', () => {
    // prettier-ignore
    const trackData = [
      0x00, 0x90, 0x3c, 0x40, // note-on C4
      0x60, 0x80, 0x3c, 0x40, // note-off C4
      0x00, 0xff, 0x2f, 0x00, // end of track
    ];
    const doc = parseMidiFile(buildSimpleMidi(trackData));
    const track = doc.tracks[0]!;
    const last = track[track.length - 1];
    expect(last?.type).toBe('endOfTrack');
  });

  it('parses note-off events (0x80)', () => {
    // prettier-ignore
    const trackData = [
      0x00, 0x90, 0x3c, 0x40, // note-on C4
      0x60, 0x80, 0x3c, 0x40, // note-off C4
      0x00, 0xff, 0x2f, 0x00, // end of track
    ];
    const doc = parseMidiFile(buildSimpleMidi(trackData));
    const track = doc.tracks[0]!;
    expect(track.find((e) => e.type === 'noteOff')).toBeDefined();
  });

  it('handles program change events (1 data byte)', () => {
    // prettier-ignore
    const trackData = [
      0x00, 0xc0, 0x00,       // program change
      0x00, 0xff, 0x2f, 0x00, // end of track
    ];
    const doc = parseMidiFile(buildSimpleMidi(trackData));
    expect(doc.tracks[0]).toBeDefined();
  });

  it('handles channel pressure events (1 data byte)', () => {
    // prettier-ignore
    const trackData = [
      0x00, 0xd0, 0x40,       // channel pressure
      0x00, 0xff, 0x2f, 0x00, // end of track
    ];
    const doc = parseMidiFile(buildSimpleMidi(trackData));
    expect(doc.tracks[0]).toBeDefined();
  });

  it('handles pitch bend events (2 data bytes)', () => {
    // prettier-ignore
    const trackData = [
      0x00, 0xe0, 0x00, 0x40, // pitch bend
      0x00, 0xff, 0x2f, 0x00, // end of track
    ];
    const doc = parseMidiFile(buildSimpleMidi(trackData));
    expect(doc.tracks[0]).toBeDefined();
  });

  it('throws RangeError on truncated meta event after type byte', () => {
    // prettier-ignore
    const truncated = new Uint8Array([
      0x4d, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06, // MThd
      0x00, 0x00, 0x00, 0x01, 0x01, 0xe0,              // format=0, tracks=1, division=480
      0x4d, 0x54, 0x72, 0x6b,                          // MTrk
      0x00, 0x00, 0x00, 0x01,                          // track length = 1
      0x00,                                            // delta 0, then no FF follows (truncated)
    ]);
    expect(() => parseMidiFile(truncated)).toThrow(RangeError);
  });

  it('throws TypeError when running status is used before any status byte', () => {
    // prettier-ignore
    const trackData = [
      0x3c, 0x40,             // data bytes with no prior status byte
      0x00, 0xff, 0x2f, 0x00, // end of track
    ];
    expect(() => parseMidiFile(buildSimpleMidi(trackData))).toThrow(TypeError);
  });

  it('throws RangeError on truncated note-on event (missing second data byte)', () => {
    // prettier-ignore
    const trackData = [
      0x00, 0x90, 0x3c, // note-on with only 1 data byte
    ];
    expect(() => parseMidiFile(buildSimpleMidi(trackData))).toThrow(RangeError);
  });

  it('throws RangeError when meta event is truncated (no VLQ for length)', () => {
    // prettier-ignore
    const truncated = new Uint8Array([
      0x4d, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06, // MThd
      0x00, 0x00, 0x00, 0x01, 0x01, 0xe0,              // format=0, tracks=1, division=480
      0x4d, 0x54, 0x72, 0x6b,                          // MTrk
      0x00, 0x00, 0x00, 0x02,                          // track length = 2
      0x00, 0xff,                                      // delta + FF, no meta type follows
    ]);
    expect(() => parseMidiFile(truncated)).toThrow(RangeError);
  });

  it('throws RangeError when a meta event length byte lies outside the track (FF 2F with a trailing file byte)', () => {
    // Track declares 3 bytes: delta(00) FF 2F — the length byte is missing from
    // the track. A trailing file byte (00) sits just past the track end; the
    // parser must NOT borrow it to satisfy the end-of-track length VLQ.
    // prettier-ignore
    const truncated = new Uint8Array([
      0x4d, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06, // MThd
      0x00, 0x00, 0x00, 0x01, 0x01, 0xe0,              // format=0, tracks=1, division=480
      0x4d, 0x54, 0x72, 0x6b,                          // MTrk
      0x00, 0x00, 0x00, 0x03,                          // track length = 3
      0x00, 0xff, 0x2f,                                // delta + FF 2F, length byte missing
      0x00,                                            // trailing file byte, outside the track
    ]);
    expect(() => parseMidiFile(truncated)).toThrow(RangeError);
  });

  it('throws RangeError when a multi-byte meta length VLQ extends past the track boundary', () => {
    // Track declares 4 bytes: delta(00) FF 01(type) 81(VLQ continuation byte).
    // The length VLQ starts inside the track but its second byte falls on the
    // trailing file byte (00), outside the track — the parser must reject it.
    // prettier-ignore
    const truncated = new Uint8Array([
      0x4d, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06, // MThd
      0x00, 0x00, 0x00, 0x01, 0x01, 0xe0,              // format=0, tracks=1, division=480
      0x4d, 0x54, 0x72, 0x6b,                          // MTrk
      0x00, 0x00, 0x00, 0x04,                          // track length = 4
      0x00, 0xff, 0x01, 0x81,                          // delta + FF 01 + VLQ start (needs a 2nd byte)
      0x00,                                            // trailing file byte, outside the track
    ]);
    expect(() => parseMidiFile(truncated)).toThrow(RangeError);
  });

  it('throws RangeError on truncated tempo meta', () => {
    // prettier-ignore
    const trackData = [
      0x00, 0xff, 0x51, 0x03, 0x07, 0xa1, // missing last byte
    ];
    expect(() => parseMidiFile(buildSimpleMidi(trackData))).toThrow(RangeError);
  });

  it('throws RangeError on truncated time signature meta', () => {
    // prettier-ignore
    const trackData = [
      0x00, 0xff, 0x58, 0x04, 0x04, 0x02, 0x18, // missing last byte
    ];
    expect(() => parseMidiFile(buildSimpleMidi(trackData))).toThrow(RangeError);
  });

  it('throws RangeError on truncated channel event (missing second data byte for note-off)', () => {
    // prettier-ignore
    const trackData = [
      0x00, 0x80, 0x3c, // note-off with only 1 data byte
    ];
    expect(() => parseMidiFile(buildSimpleMidi(trackData))).toThrow(RangeError);
  });

  it('throws RangeError on truncated data after delta time', () => {
    // prettier-ignore
    const trackData = [
      0x00, // valid delta, but no event byte
    ];
    expect(() => parseMidiFile(buildSimpleMidi(trackData))).toThrow(RangeError);
  });

  it('throws RangeError on truncated channel event with running status (file shorter than declared)', () => {
    // First event sets running status 0x90. Second uses running status with delta 0x78.
    // Track DECLARES length=7 but the file only has 5 track bytes.
    const trackData = [0x00, 0x90, 0x3c, 0x40, 0x78]; // 5 real bytes
    // prettier-ignore
    const bytes = new Uint8Array([
      0x4d, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06, // MThd
      0x00, 0x00, 0x00, 0x01, 0x01, 0xe0,              // format=0, tracks=1, division=480
      0x4d, 0x54, 0x72, 0x6b,                          // MTrk
      0x00, 0x00, 0x00, 7,                             // declared as 7 but only 5 follow
      ...trackData,
    ]);
    expect(() => parseMidiFile(bytes)).toThrow(RangeError);
  });

  it('throws RangeError when declared track length exceeds the file size', () => {
    // prettier-ignore
    const bytes = new Uint8Array([
      0x4d, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06, // MThd
      0x00, 0x00, 0x00, 0x01, 0x01, 0xe0,              // format=0, tracks=1, division=480
      0x4d, 0x54, 0x72, 0x6b,                          // MTrk
      0x00, 0x00, 0x00, 0xff,                          // declares 255-byte track, but no bytes follow
    ]);
    expect(() => parseMidiFile(bytes)).toThrow(RangeError);
  });

  it('throws RangeError when end-of-track meta has non-zero length', () => {
    // FF 2F 01 00: end-of-track with metaLength=1 (invalid; must be 0)
    // prettier-ignore
    const trackData = [
      0x00, 0xff, 0x2f, 0x01, 0x00, // end-of-track with illegal payload byte
    ];
    expect(() => parseMidiFile(buildSimpleMidi(trackData))).toThrow(RangeError);
  });

  it('throws RangeError when meta payload exceeds track boundary', () => {
    // Unknown meta (type 0x07) declaring length=10 but only 3 bytes remain in track.
    // prettier-ignore
    const trackData = [
      0x00, 0xff, 0x07, 0x0a, 0x61, 0x62, 0x63, // length=10, only 3 payload bytes present
    ];
    expect(() => parseMidiFile(buildSimpleMidi(trackData))).toThrow(RangeError);
  });

  it('throws RangeError when a channel data byte is >= 0x80 (status-like, malformed stream)', () => {
    // Note-on C4 with velocity 0x80 — velocity byte >= 0x80 is invalid per SMF spec.
    // prettier-ignore
    const trackData = [
      0x00, 0x90, 0x3c, 0x80, // note-on, noteNumber=0x3c, velocity=0x80 (invalid)
      0x00, 0xff, 0x2f, 0x00,
    ];
    expect(() => parseMidiFile(buildSimpleMidi(trackData))).toThrow(RangeError);
  });

  it('throws RangeError when a note-on note number byte is >= 0x80', () => {
    // prettier-ignore
    const trackData = [
      0x00, 0x90, 0x80, 0x40, // note-on, noteNumber=0x80 (invalid), velocity=64
      0x00, 0xff, 0x2f, 0x00,
    ];
    expect(() => parseMidiFile(buildSimpleMidi(trackData))).toThrow(RangeError);
  });

  it('throws RangeError when a skipped-event data byte is >= 0x80 (pitch bend)', () => {
    // Pitch bend (0xE0) with second data byte = 0x80 — invalid data byte.
    // prettier-ignore
    const trackData = [
      0x00, 0xe0, 0x00, 0x80, // pitch bend, LSB=0x00, MSB=0x80 (invalid)
      0x00, 0xff, 0x2f, 0x00,
    ];
    expect(() => parseMidiFile(buildSimpleMidi(trackData))).toThrow(RangeError);
  });

  it('throws RangeError on truncated skipped channel event (pitch bend, 2 bytes needed, 1 present)', () => {
    // Pitch bend (0xE0) needs 2 data bytes; only 1 present before track end.
    // prettier-ignore
    const trackData = [
      0x00, 0xe0, 0x00, // pitch bend with only 1 data byte in track
    ];
    expect(() => parseMidiFile(buildSimpleMidi(trackData))).toThrow(RangeError);
  });

  it('program-change advances byte pointer correctly (following noteOn decodes)', () => {
    // Program change (0xC0) consumes exactly 1 data byte.
    // A noteOn immediately after must decode correctly, proving the byte pointer advanced right.
    // prettier-ignore
    const trackData = [
      0x00, 0xc0, 0x28,             // delta=0, program change ch0, program=40
      0x00, 0x90, 0x3c, 0x40,       // delta=0, note-on ch0, C4 (0x3c=60), vel=64
      0x60, 0x90, 0x3c, 0x00,       // delta=96, note-on vel=0 (note-off), C4
      0x00, 0xff, 0x2f, 0x00,       // end of track
    ];
    const doc = parseMidiFile(buildSimpleMidi(trackData));
    const track = doc.tracks[0]!;
    const noteOn = track.find((e) => e.type === 'noteOn' && e.velocity > 0);
    expect(noteOn).toBeDefined();
    if (noteOn?.type === 'noteOn') {
      expect(noteOn.noteNumber).toBe(0x3c);
      expect(noteOn.velocity).toBe(0x40);
      expect(noteOn.deltaTicks).toBe(0);
    }
  });

  it('channel-pressure advances byte pointer correctly (following noteOn decodes)', () => {
    // Channel pressure (0xD0) consumes exactly 1 data byte.
    // prettier-ignore
    const trackData = [
      0x00, 0xd0, 0x40,             // delta=0, channel pressure ch0, value=64
      0x00, 0x90, 0x3c, 0x40,       // delta=0, note-on ch0, C4, vel=64
      0x60, 0x90, 0x3c, 0x00,       // delta=96, note-off C4
      0x00, 0xff, 0x2f, 0x00,       // end of track
    ];
    const doc = parseMidiFile(buildSimpleMidi(trackData));
    const track = doc.tracks[0]!;
    const noteOn = track.find((e) => e.type === 'noteOn' && e.velocity > 0);
    expect(noteOn).toBeDefined();
    if (noteOn?.type === 'noteOn') {
      expect(noteOn.noteNumber).toBe(0x3c);
      expect(noteOn.velocity).toBe(0x40);
      expect(noteOn.deltaTicks).toBe(0);
    }
  });

  it('pitch-bend advances byte pointer correctly (following noteOn decodes)', () => {
    // Pitch bend (0xE0) consumes exactly 2 data bytes.
    // prettier-ignore
    const trackData = [
      0x00, 0xe0, 0x00, 0x40,       // delta=0, pitch bend ch0, LSB=0, MSB=64
      0x00, 0x90, 0x3c, 0x40,       // delta=0, note-on ch0, C4, vel=64
      0x60, 0x90, 0x3c, 0x00,       // delta=96, note-off C4
      0x00, 0xff, 0x2f, 0x00,       // end of track
    ];
    const doc = parseMidiFile(buildSimpleMidi(trackData));
    const track = doc.tracks[0]!;
    const noteOn = track.find((e) => e.type === 'noteOn' && e.velocity > 0);
    expect(noteOn).toBeDefined();
    if (noteOn?.type === 'noteOn') {
      expect(noteOn.noteNumber).toBe(0x3c);
      expect(noteOn.velocity).toBe(0x40);
      expect(noteOn.deltaTicks).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Custom ticksPerQuarter option
// ---------------------------------------------------------------------------

describe('sequenceToMidiFile — custom ticksPerQuarter', () => {
  it('uses custom ticksPerQuarter in the division field', () => {
    const seq = Sequence.create([], { tempo: 120 });
    const bytes = sequenceToMidiFile(seq, { ticksPerQuarter: 960 });
    expect(bytes[12]).toBe(0x03);
    expect(bytes[13]).toBe(0xc0);
  });

  it('round-trips with custom ticksPerQuarter', () => {
    const c4 = Note.create({ note: 'C', octave: 4 });
    const seq = Sequence.create(
      [
        {
          type: 'note',
          note: c4,
          start: musicalTime(0, 1),
          duration: musicalTime(1, 4),
          velocity: 60,
        },
      ],
      { tempo: 120 },
    );
    const bytes = sequenceToMidiFile(seq, { ticksPerQuarter: 960 });
    const result = midiFileToSequence(bytes);
    expect(result.events.length).toBe(1);
    expect(result.events[0]?.type).toBe('note');
  });
});

// ---------------------------------------------------------------------------
// midiFileToSequence — invalid meter in file (catch branch)
// ---------------------------------------------------------------------------

describe('midiFileToSequence — invalid meter denominator', () => {
  it('omits meter when the SMF time signature has an unsupported denominator exponent', () => {
    // dd=7 means denominator = 2^7 = 128, which is not a valid Meter denominator.
    // Meter.create should throw, and the catch block should silently omit the meter.
    // prettier-ignore
    const trackData = [
      0x00, 0xff, 0x58, 0x04, 0x04, 0x07, 0x18, 0x08, // time sig: 4/128 (invalid)
      0x00, 0xff, 0x2f, 0x00,                          // end of track
    ];
    // prettier-ignore
    const bytes = new Uint8Array([
      0x4d, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06, // MThd
      0x00, 0x00, 0x00, 0x01, 0x01, 0xe0,              // format=0, tracks=1, division=480
      0x4d, 0x54, 0x72, 0x6b,                          // MTrk
      0x00, 0x00, 0x00, trackData.length,              // track length
      ...trackData,
    ]);
    const result = midiFileToSequence(bytes);
    expect(result.meter).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Custom channel option
// ---------------------------------------------------------------------------

describe('sequenceToMidiFile — custom channel', () => {
  it('uses custom MIDI channel for note events', () => {
    const c4 = Note.create({ note: 'C', octave: 4 });
    const seq = Sequence.create(
      [{ type: 'note', note: c4, start: musicalTime(0, 1), duration: musicalTime(1, 4) }],
      { tempo: 120 },
    );
    const bytes = sequenceToMidiFile(seq, { channel: 3 });
    const doc = parseMidiFile(bytes);
    const track = doc.tracks[0]!;
    const noteOn = track.find((e) => e.type === 'noteOn');
    expect(noteOn).toBeDefined();
    if (noteOn?.type === 'noteOn') {
      expect(noteOn.channel).toBe(3);
    }
  });
});

// ---------------------------------------------------------------------------
// sequenceToMidiFile — option validation
// ---------------------------------------------------------------------------

describe('sequenceToMidiFile — option validation', () => {
  const seq = Sequence.create([], { tempo: 120 });

  it('throws RangeError for ticksPerQuarter = 0', () => {
    expect(() => sequenceToMidiFile(seq, { ticksPerQuarter: 0 })).toThrow(RangeError);
  });

  it('throws RangeError for negative ticksPerQuarter', () => {
    expect(() => sequenceToMidiFile(seq, { ticksPerQuarter: -1 })).toThrow(RangeError);
  });

  it('throws RangeError for fractional ticksPerQuarter', () => {
    expect(() => sequenceToMidiFile(seq, { ticksPerQuarter: 480.5 })).toThrow(RangeError);
  });

  it('throws RangeError for ticksPerQuarter = 32768 (exceeds 0x7fff)', () => {
    expect(() => sequenceToMidiFile(seq, { ticksPerQuarter: 32768 })).toThrow(RangeError);
  });

  it('accepts ticksPerQuarter = 32767 (0x7fff maximum)', () => {
    expect(() => sequenceToMidiFile(seq, { ticksPerQuarter: 32767 })).not.toThrow();
  });

  it('throws RangeError for channel = 16', () => {
    expect(() => sequenceToMidiFile(seq, { channel: 16 })).toThrow(RangeError);
  });

  it('throws RangeError for negative channel', () => {
    expect(() => sequenceToMidiFile(seq, { channel: -1 })).toThrow(RangeError);
  });

  it('throws RangeError for fractional channel', () => {
    expect(() => sequenceToMidiFile(seq, { channel: 1.5 })).toThrow(RangeError);
  });

  it('throws RangeError when tempo yields microseconds exceeding 0xffffff (very slow BPM)', () => {
    const slowSeq = Sequence.create([], { tempo: 0.001 });
    expect(() => sequenceToMidiFile(slowSeq)).toThrow(RangeError);
  });

  it('throws RangeError for a non-finite tempo (NaN) supplied via a subclass', () => {
    // Sequence.create validates tempo, but the constructor is protected, so a
    // subclass can inject a non-finite tempo. NaN slips through the SMF range
    // check (NaN comparisons are always false) and must be rejected explicitly.
    class NaNTempoSequence extends Sequence {
      constructor() {
        super([], NaN, null);
      }
    }
    expect(() => sequenceToMidiFile(new NaNTempoSequence())).toThrow(RangeError);
  });
});
