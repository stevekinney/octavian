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
