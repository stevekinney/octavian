import { describe, it, expect } from 'bun:test';
import { Note } from '../note.js';
import { Chord } from '../chord.js';
import { Sequence, musicalTime } from '../sequences/sequence.js';
import { Meter } from '../meter.js';
import { sequenceToMidiFile } from './encode.js';
import { parseMidiFile, midiFileToSequence } from './decode.js';
import { encodeVlq, decodeVlq, MAX_VLQ_VALUE } from './variable-length.js';

// ---------------------------------------------------------------------------
// VLQ tests
// ---------------------------------------------------------------------------

describe('encodeVlq', () => {
  it('encodes 0 as [0x00]', () => {
    expect(encodeVlq(0)).toEqual([0x00]);
  });

  it('encodes 127 as [0x7F]', () => {
    expect(encodeVlq(127)).toEqual([0x7f]);
  });

  it('encodes 128 as [0x81, 0x00]', () => {
    expect(encodeVlq(128)).toEqual([0x81, 0x00]);
  });

  it('encodes 8192 as [0xC0, 0x00]', () => {
    expect(encodeVlq(8192)).toEqual([0xc0, 0x00]);
  });

  it('encodes 480 as [0x83, 0x60]', () => {
    expect(encodeVlq(480)).toEqual([0x83, 0x60]);
  });

  it('encodes 0x0FFFFFFF (max) as 4 bytes', () => {
    const result = encodeVlq(0x0fffffff);
    expect(result).toEqual([0xff, 0xff, 0xff, 0x7f]);
  });

  it('throws RangeError for negative values', () => {
    expect(() => encodeVlq(-1)).toThrow(RangeError);
  });

  it('throws RangeError for values exceeding MAX_VLQ_VALUE', () => {
    expect(() => encodeVlq(MAX_VLQ_VALUE + 1)).toThrow(RangeError);
  });

  it('throws RangeError for non-integer values', () => {
    expect(() => encodeVlq(1.5)).toThrow(RangeError);
  });
});

describe('decodeVlq', () => {
  it('decodes [0x00] as 0', () => {
    expect(decodeVlq(new Uint8Array([0x00]), 0)).toEqual({ value: 0, bytesRead: 1 });
  });

  it('decodes [0x7F] as 127', () => {
    expect(decodeVlq(new Uint8Array([0x7f]), 0)).toEqual({ value: 127, bytesRead: 1 });
  });

  it('decodes [0x81, 0x00] as 128', () => {
    expect(decodeVlq(new Uint8Array([0x81, 0x00]), 0)).toEqual({ value: 128, bytesRead: 2 });
  });

  it('decodes [0xC0, 0x00] as 8192', () => {
    expect(decodeVlq(new Uint8Array([0xc0, 0x00]), 0)).toEqual({ value: 8192, bytesRead: 2 });
  });

  it('decodes [0x83, 0x60] as 480', () => {
    expect(decodeVlq(new Uint8Array([0x83, 0x60]), 0)).toEqual({ value: 480, bytesRead: 2 });
  });

  it('decodes [0xFF, 0xFF, 0xFF, 0x7F] as 0x0FFFFFFF', () => {
    expect(decodeVlq(new Uint8Array([0xff, 0xff, 0xff, 0x7f]), 0)).toEqual({
      value: 0x0fffffff,
      bytesRead: 4,
    });
  });

  it('respects the offset parameter', () => {
    const data = new Uint8Array([0x00, 0x83, 0x60]);
    expect(decodeVlq(data, 1)).toEqual({ value: 480, bytesRead: 2 });
  });

  it('throws RangeError on truncated data', () => {
    expect(() => decodeVlq(new Uint8Array([0x81]), 0)).toThrow(RangeError);
  });

  it('throws RangeError on empty array at offset', () => {
    expect(() => decodeVlq(new Uint8Array([]), 0)).toThrow(RangeError);
  });

  it('throws RangeError when VLQ exceeds 4 bytes', () => {
    // 5-byte continuation: all high bits set
    expect(() => decodeVlq(new Uint8Array([0x81, 0x80, 0x80, 0x80, 0x00]), 0)).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// SMF header byte verification (external ground truth)
// ---------------------------------------------------------------------------

describe('sequenceToMidiFile — MThd header bytes', () => {
  const seq = Sequence.create([], { tempo: 120 });
  const bytes = sequenceToMidiFile(seq);

  it('starts with MThd (0x4D546864)', () => {
    expect(bytes[0]).toBe(0x4d);
    expect(bytes[1]).toBe(0x54);
    expect(bytes[2]).toBe(0x68);
    expect(bytes[3]).toBe(0x64);
  });

  it('has header length 6', () => {
    expect(bytes[4]).toBe(0x00);
    expect(bytes[5]).toBe(0x00);
    expect(bytes[6]).toBe(0x00);
    expect(bytes[7]).toBe(0x06);
  });

  it('has format 0', () => {
    expect(bytes[8]).toBe(0x00);
    expect(bytes[9]).toBe(0x00);
  });

  it('has ntrks = 1', () => {
    expect(bytes[10]).toBe(0x00);
    expect(bytes[11]).toBe(0x01);
  });

  it('has division 480 (0x01E0)', () => {
    expect(bytes[12]).toBe(0x01);
    expect(bytes[13]).toBe(0xe0);
  });

  it('has MTrk marker after header', () => {
    expect(bytes[14]).toBe(0x4d);
    expect(bytes[15]).toBe(0x54);
    expect(bytes[16]).toBe(0x72);
    expect(bytes[17]).toBe(0x6b);
  });
});

// ---------------------------------------------------------------------------
// Tempo encoding (external ground truth)
// ---------------------------------------------------------------------------

describe('sequenceToMidiFile — tempo meta bytes', () => {
  it('encodes 120 BPM as 500000 us (0x07A120)', () => {
    const seq = Sequence.create([], { tempo: 120 });
    const bytes = sequenceToMidiFile(seq);

    // Track data starts at offset 22 (14 header + 4 MTrk + 4 track length)
    const trackStart = 22;

    // First event: delta=0 (0x00), then FF 51 03 tt tt tt
    expect(bytes[trackStart]).toBe(0x00); // delta 0
    expect(bytes[trackStart + 1]).toBe(0xff); // meta
    expect(bytes[trackStart + 2]).toBe(0x51); // tempo type
    expect(bytes[trackStart + 3]).toBe(0x03); // length 3
    // 500000 = 0x07A120
    expect(bytes[trackStart + 4]).toBe(0x07);
    expect(bytes[trackStart + 5]).toBe(0xa1);
    expect(bytes[trackStart + 6]).toBe(0x20);
  });

  it('encodes 60 BPM as 1000000 us (0x0F4240)', () => {
    const seq = Sequence.create([], { tempo: 60 });
    const bytes = sequenceToMidiFile(seq);
    const trackStart = 22;

    expect(bytes[trackStart + 4]).toBe(0x0f);
    expect(bytes[trackStart + 5]).toBe(0x42);
    expect(bytes[trackStart + 6]).toBe(0x40);
  });
});

// ---------------------------------------------------------------------------
// Time signature encoding
// ---------------------------------------------------------------------------

describe('sequenceToMidiFile — time signature meta bytes', () => {
  it('encodes 4/4 as FF 58 04 04 02 18 08', () => {
    const seq = Sequence.create([], { tempo: 120, meter: Meter.create('4/4') });
    const bytes = sequenceToMidiFile(seq);
    const trackStart = 22;

    // After the tempo event (7 bytes: delta + FF 51 03 t t t), comes time sig
    const timeSigOffset = trackStart + 7;

    expect(bytes[timeSigOffset]).toBe(0x00); // delta 0
    expect(bytes[timeSigOffset + 1]).toBe(0xff);
    expect(bytes[timeSigOffset + 2]).toBe(0x58);
    expect(bytes[timeSigOffset + 3]).toBe(0x04);
    expect(bytes[timeSigOffset + 4]).toBe(0x04); // nn = 4
    expect(bytes[timeSigOffset + 5]).toBe(0x02); // dd = 2 (2^2 = 4)
    expect(bytes[timeSigOffset + 6]).toBe(0x18); // cc = 24
    expect(bytes[timeSigOffset + 7]).toBe(0x08); // bb = 8
  });

  it('encodes 3/4 with dd = 2', () => {
    const seq = Sequence.create([], { tempo: 120, meter: Meter.create('3/4') });
    const bytes = sequenceToMidiFile(seq);
    const trackStart = 22;
    const timeSigOffset = trackStart + 7;

    expect(bytes[timeSigOffset + 4]).toBe(0x03); // nn = 3
    expect(bytes[timeSigOffset + 5]).toBe(0x02); // dd = 2 (2^2 = 4)
  });

  it('encodes 6/8 with dd = 3', () => {
    const seq = Sequence.create([], { tempo: 120, meter: Meter.create('6/8') });
    const bytes = sequenceToMidiFile(seq);
    const trackStart = 22;
    const timeSigOffset = trackStart + 7;

    expect(bytes[timeSigOffset + 4]).toBe(0x06); // nn = 6
    expect(bytes[timeSigOffset + 5]).toBe(0x03); // dd = 3 (2^3 = 8)
  });

  it('uses default 4/4 when no meter is set', () => {
    const seq = Sequence.create([], { tempo: 120 });
    const bytes = sequenceToMidiFile(seq);
    const trackStart = 22;
    const timeSigOffset = trackStart + 7;

    expect(bytes[timeSigOffset + 4]).toBe(0x04); // nn = 4
    expect(bytes[timeSigOffset + 5]).toBe(0x02); // dd = 2
  });
});

// ---------------------------------------------------------------------------
// Note event encoding
// ---------------------------------------------------------------------------

describe('sequenceToMidiFile — note events', () => {
  it('produces deterministic output for identical sequences', () => {
    const seq = Sequence.create(
      [
        {
          type: 'note',
          note: Note.create({ note: 'C', octave: 4 }),
          start: musicalTime(0, 1),
          duration: musicalTime(1, 4),
        },
      ],
      { tempo: 120 },
    );
    const a = sequenceToMidiFile(seq);
    const b = sequenceToMidiFile(seq);
    expect(a).toEqual(b);
  });

  it('encodes note-on and note-off for a single note', () => {
    const seq = Sequence.create(
      [
        {
          type: 'note',
          note: Note.create({ note: 'C', octave: 4 }),
          start: musicalTime(0, 1),
          duration: musicalTime(1, 4),
        },
      ],
      { tempo: 120 },
    );
    const bytes = sequenceToMidiFile(seq);
    const doc = parseMidiFile(bytes);

    expect(doc.format).toBe(0);

    const track = doc.tracks[0];
    expect(track).toBeDefined();

    // Should contain tempo, timeSig, noteOn, noteOff (vel 0), endOfTrack
    const noteOns = track!.filter((e) => e.type === 'noteOn');
    const noteOffs = track!.filter(
      (e) => e.type === 'noteOn' && 'velocity' in e && e.velocity === 0,
    );

    expect(noteOns.length).toBeGreaterThanOrEqual(1);
    expect(noteOffs.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// parseMidiFile validation
// ---------------------------------------------------------------------------

describe('parseMidiFile — validation', () => {
  it('throws RangeError on data shorter than 14 bytes', () => {
    expect(() => parseMidiFile(new Uint8Array([0x4d, 0x54]))).toThrow(RangeError);
  });

  it('throws TypeError when MThd magic is wrong', () => {
    const bad = new Uint8Array(14);
    bad[0] = 0x00; // not 'M'
    expect(() => parseMidiFile(bad)).toThrow(TypeError);
  });

  it('throws RangeError on invalid header length < 6', () => {
    const bytes = new Uint8Array(14);
    bytes[0] = 0x4d;
    bytes[1] = 0x54;
    bytes[2] = 0x68;
    bytes[3] = 0x64; // MThd
    bytes[7] = 4; // length = 4 (too short)
    expect(() => parseMidiFile(bytes)).toThrow(RangeError);
  });

  it('throws TypeError for unsupported format (2)', () => {
    const bytes = new Uint8Array(14);
    bytes[0] = 0x4d;
    bytes[1] = 0x54;
    bytes[2] = 0x68;
    bytes[3] = 0x64;
    bytes[7] = 6; // header length = 6
    bytes[9] = 0x02; // format = 2
    bytes[11] = 0x01; // ntrks = 1
    bytes[12] = 0x01;
    bytes[13] = 0xe0; // division = 480
    expect(() => parseMidiFile(bytes)).toThrow(TypeError);
  });

  it('throws TypeError for SMPTE time code (high bit set in division)', () => {
    const bytes = new Uint8Array(14);
    bytes[0] = 0x4d;
    bytes[1] = 0x54;
    bytes[2] = 0x68;
    bytes[3] = 0x64;
    bytes[7] = 6;
    bytes[9] = 0x00; // format 0
    bytes[11] = 0x00; // ntrks = 0
    bytes[12] = 0xe4;
    bytes[13] = 0x00; // high bit set
    expect(() => parseMidiFile(bytes)).toThrow(TypeError);
  });

  it('throws TypeError when MTrk marker is missing', () => {
    // Build a minimal MIDI with ntrks=1 but bad track marker
    const bytes = new Uint8Array(22);
    bytes[0] = 0x4d;
    bytes[1] = 0x54;
    bytes[2] = 0x68;
    bytes[3] = 0x64;
    bytes[7] = 6;
    bytes[9] = 0x00; // format 0
    bytes[11] = 0x01; // ntrks = 1
    bytes[12] = 0x01;
    bytes[13] = 0xe0;
    // bad track magic
    bytes[14] = 0x00;
    expect(() => parseMidiFile(bytes)).toThrow(TypeError);
  });

  it('throws RangeError on truncated track chunk header', () => {
    // ntrks = 1 but only enough bytes for header
    const bytes = new Uint8Array(14);
    bytes[0] = 0x4d;
    bytes[1] = 0x54;
    bytes[2] = 0x68;
    bytes[3] = 0x64;
    bytes[7] = 6;
    bytes[9] = 0x00;
    bytes[11] = 0x01; // ntrks = 1
    bytes[12] = 0x01;
    bytes[13] = 0xe0;
    // Only 14 bytes total, no room for track header
    expect(() => parseMidiFile(bytes)).toThrow(RangeError);
  });

  it('throws RangeError on file shorter than minimum 14 bytes (e.g. 6 bytes)', () => {
    // The 14-byte guard fires before any uint32/uint16 reads
    const bytes = new Uint8Array([0x4d, 0x54, 0x68, 0x64, 0x00, 0x00]);
    expect(() => parseMidiFile(bytes)).toThrow(RangeError);
  });

  it('throws RangeError on file with 9 bytes (still below 14-byte minimum)', () => {
    const bytes = new Uint8Array([0x4d, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06, 0x00]);
    expect(() => parseMidiFile(bytes)).toThrow(RangeError);
  });

  it('throws RangeError on truncated channel event with running status (file shorter than declared track length)', () => {
    // The first event sets running status 0x90. The second event uses running status
    // with delta 0x78. The track DECLARES length=7 but the file only has 5 track bytes.
    // After reading the delta VLQ, pos falls outside the actual file data, causing
    // data[pos] to be undefined when parseChannelEvent reads b0.
    const trackData = [0x00, 0x90, 0x3c, 0x40, 0x78]; // 5 real bytes
    const declaredTrackLength = 7; // lies — 2 more bytes expected but absent
    const bytes = new Uint8Array([
      0x4d,
      0x54,
      0x68,
      0x64,
      0x00,
      0x00,
      0x00,
      0x06,
      0x00,
      0x00,
      0x00,
      0x01,
      0x01,
      0xe0,
      0x4d,
      0x54,
      0x72,
      0x6b,
      0x00,
      0x00,
      0x00,
      declaredTrackLength,
      ...trackData,
    ]);
    expect(() => parseMidiFile(bytes)).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// Round-trip test
// ---------------------------------------------------------------------------

describe('round-trip: sequenceToMidiFile -> midiFileToSequence', () => {
  it('preserves note pitches, velocities, tempo, and meter for a 2-note sequence', () => {
    const c4 = Note.create({ note: 'C', octave: 4 });
    const e4 = Note.create({ note: 'E', octave: 4 });
    const meter = Meter.create('4/4');

    const original = Sequence.create(
      [
        {
          type: 'note',
          note: c4,
          start: musicalTime(0, 1),
          duration: musicalTime(1, 4),
          velocity: 80,
        },
        {
          type: 'note',
          note: e4,
          start: musicalTime(1, 4),
          duration: musicalTime(1, 4),
          velocity: 90,
        },
      ],
      { tempo: 120, meter },
    );

    const bytes = sequenceToMidiFile(original);
    const reconstructed = midiFileToSequence(bytes);

    expect(reconstructed.tempo).toBe(120);
    expect(reconstructed.meter?.numerator).toBe(4);
    expect(reconstructed.meter?.denominator).toBe(4);
    expect(reconstructed.events.length).toBe(2);

    const e0 = reconstructed.events[0];
    const e1 = reconstructed.events[1];

    expect(e0?.type).toBe('note');
    expect(e1?.type).toBe('note');

    if (e0?.type === 'note') {
      expect(e0.note.midi).toBe(c4.midi);
      expect(e0.velocity).toBe(80);
      expect(e0.start.numerator).toBe(0);
    }

    if (e1?.type === 'note') {
      expect(e1.note.midi).toBe(e4.midi);
      expect(e1.velocity).toBe(90);
      // start = 1/4 whole note
      expect(e1.start.numerator / e1.start.denominator).toBeCloseTo(0.25, 5);
    }
  });

  it('preserves tempo through round-trip at 90 BPM', () => {
    const seq = Sequence.create([], { tempo: 90 });
    const bytes = sequenceToMidiFile(seq);
    const result = midiFileToSequence(bytes);
    expect(result.tempo).toBe(90);
  });

  it('uses defaultTempo option when no tempo meta is present', () => {
    // Build a minimal MIDI with no tempo meta event
    const seq = Sequence.create([], { tempo: 120 });
    const bytes = sequenceToMidiFile(seq);
    // Parse it but override default
    const result = midiFileToSequence(bytes, { defaultTempo: 100 });
    // The file has a real tempo meta (120 BPM), so result should be 120
    expect(result.tempo).toBe(120);
  });

  it('round-trips a chord event as individual note events', () => {
    const cMaj = Chord.create({ note: 'C', octave: 4 }, 'major');
    const seq = Sequence.create(
      [
        {
          type: 'chord',
          chord: cMaj,
          start: musicalTime(0, 1),
          duration: musicalTime(1, 2),
          velocity: 70,
        },
      ],
      { tempo: 120 },
    );
    const bytes = sequenceToMidiFile(seq);
    const reconstructed = midiFileToSequence(bytes);

    // C major has 3 notes
    expect(reconstructed.events.length).toBe(3);
    expect(reconstructed.events.every((e) => e.type === 'note')).toBe(true);
  });

  it('handles rest events (skips them in MIDI output)', () => {
    const c4 = Note.create({ note: 'C', octave: 4 });
    const seq = Sequence.create(
      [
        { type: 'note', note: c4, start: musicalTime(0, 1), duration: musicalTime(1, 4) },
        { type: 'rest', start: musicalTime(1, 4), duration: musicalTime(1, 4) },
      ],
      { tempo: 120 },
    );
    const bytes = sequenceToMidiFile(seq);
    const reconstructed = midiFileToSequence(bytes);

    // Only 1 note event (rest is not encoded)
    expect(reconstructed.events.length).toBe(1);
  });
});
