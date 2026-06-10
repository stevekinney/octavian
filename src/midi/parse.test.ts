/**
 * Tests for parseMidiMessage and messageToNote.
 *
 * Ground truth values are asserted against the MIDI specification byte values,
 * not self-consistent recomputations.
 */

import { describe, it, expect } from 'bun:test';
import { parseMidiMessage } from './parse.js';
import { messageToNote } from './note-helpers.js';
import { SUSTAIN_CONTROLLER, SUSTAIN_THRESHOLD } from './types.js';

// ---------------------------------------------------------------------------
// parseMidiMessage — Note On
// ---------------------------------------------------------------------------

describe('parseMidiMessage — Note On', () => {
  it('parses [0x90, 60, 100] as noteOn ch0 note60 vel100', () => {
    const msg = parseMidiMessage([0x90, 60, 100]);
    expect(msg.type).toBe('noteOn');
    if (msg.type !== 'noteOn') throw new Error('narrowing');
    expect(msg.channel).toBe(0);
    expect(msg.note).toBe(60);
    expect(msg.velocity).toBe(100);
  });

  it('parses Note-On on channel 3 correctly', () => {
    const msg = parseMidiMessage([0x93, 48, 80]);
    expect(msg.type).toBe('noteOn');
    if (msg.type !== 'noteOn') throw new Error('narrowing');
    expect(msg.channel).toBe(3);
    expect(msg.note).toBe(48);
    expect(msg.velocity).toBe(80);
  });

  it('normalises Note-On velocity=0 to noteOff (MIDI running-status convention)', () => {
    const msg = parseMidiMessage([0x90, 60, 0]);
    expect(msg.type).toBe('noteOff');
    if (msg.type !== 'noteOff') throw new Error('narrowing');
    expect(msg.channel).toBe(0);
    expect(msg.note).toBe(60);
    expect(msg.velocity).toBe(0);
  });

  it('accepts Uint8Array input', () => {
    const msg = parseMidiMessage(new Uint8Array([0x91, 64, 127]));
    expect(msg.type).toBe('noteOn');
    if (msg.type !== 'noteOn') throw new Error('narrowing');
    expect(msg.channel).toBe(1);
    expect(msg.note).toBe(64);
    expect(msg.velocity).toBe(127);
  });
});

// ---------------------------------------------------------------------------
// parseMidiMessage — Note Off
// ---------------------------------------------------------------------------

describe('parseMidiMessage — Note Off', () => {
  it('parses [0x80, 60, 64] as noteOff ch0 note60 vel64', () => {
    const msg = parseMidiMessage([0x80, 60, 64]);
    expect(msg.type).toBe('noteOff');
    if (msg.type !== 'noteOff') throw new Error('narrowing');
    expect(msg.channel).toBe(0);
    expect(msg.note).toBe(60);
    expect(msg.velocity).toBe(64);
  });

  it('parses Note-Off on channel 15', () => {
    const msg = parseMidiMessage([0x8f, 60, 0]);
    expect(msg.type).toBe('noteOff');
    if (msg.type !== 'noteOff') throw new Error('narrowing');
    expect(msg.channel).toBe(15);
  });
});

// ---------------------------------------------------------------------------
// parseMidiMessage — Control Change
// ---------------------------------------------------------------------------

describe('parseMidiMessage — Control Change', () => {
  it('parses [0xB0, 64, 127] as CC sustain on ch0', () => {
    const msg = parseMidiMessage([0xb0, 64, 127]);
    expect(msg.type).toBe('controlChange');
    if (msg.type !== 'controlChange') throw new Error('narrowing');
    expect(msg.channel).toBe(0);
    expect(msg.controller).toBe(64);
    expect(msg.value).toBe(127);
  });

  it('parses [0xB0, 64, 0] as CC sustain off ch0', () => {
    const msg = parseMidiMessage([0xb0, 64, 0]);
    expect(msg.type).toBe('controlChange');
    if (msg.type !== 'controlChange') throw new Error('narrowing');
    expect(msg.controller).toBe(64);
    expect(msg.value).toBe(0);
  });

  it('parses a generic CC on channel 5', () => {
    const msg = parseMidiMessage([0xb5, 7, 100]);
    expect(msg.type).toBe('controlChange');
    if (msg.type !== 'controlChange') throw new Error('narrowing');
    expect(msg.channel).toBe(5);
    expect(msg.controller).toBe(7);
    expect(msg.value).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// parseMidiMessage — Program Change
// ---------------------------------------------------------------------------

describe('parseMidiMessage — Program Change', () => {
  it('parses [0xC0, 42] as programChange ch0 program42', () => {
    const msg = parseMidiMessage([0xc0, 42]);
    expect(msg.type).toBe('programChange');
    if (msg.type !== 'programChange') throw new Error('narrowing');
    expect(msg.channel).toBe(0);
    expect(msg.program).toBe(42);
  });

  it('parses Program Change on channel 9 (drums)', () => {
    const msg = parseMidiMessage([0xc9, 0]);
    expect(msg.type).toBe('programChange');
    if (msg.type !== 'programChange') throw new Error('narrowing');
    expect(msg.channel).toBe(9);
    expect(msg.program).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// parseMidiMessage — Pitch Bend
// ---------------------------------------------------------------------------

describe('parseMidiMessage — Pitch Bend', () => {
  it('parses [0xE0, 0x00, 0x40] as pitchBend centre (8192)', () => {
    const msg = parseMidiMessage([0xe0, 0x00, 0x40]);
    expect(msg.type).toBe('pitchBend');
    if (msg.type !== 'pitchBend') throw new Error('narrowing');
    expect(msg.channel).toBe(0);
    // LSB=0x00, MSB=0x40 → (0x40 << 7) | 0x00 = 64*128 = 8192
    expect(msg.value).toBe(8192);
  });

  it('parses full-down bend [0xE0, 0x00, 0x00] as value 0', () => {
    const msg = parseMidiMessage([0xe0, 0x00, 0x00]);
    expect(msg.type).toBe('pitchBend');
    if (msg.type !== 'pitchBend') throw new Error('narrowing');
    expect(msg.value).toBe(0);
  });

  it('parses full-up bend [0xE0, 0x7F, 0x7F] as value 16383', () => {
    const msg = parseMidiMessage([0xe0, 0x7f, 0x7f]);
    expect(msg.type).toBe('pitchBend');
    if (msg.type !== 'pitchBend') throw new Error('narrowing');
    // (0x7F << 7) | 0x7F = 127*128 + 127 = 16383
    expect(msg.value).toBe(16383);
  });
});

// ---------------------------------------------------------------------------
// parseMidiMessage — Error cases
// ---------------------------------------------------------------------------

describe('parseMidiMessage — errors', () => {
  it('throws TypeError for an empty array', () => {
    expect(() => parseMidiMessage([])).toThrow(TypeError);
  });

  it('throws TypeError for an unrecognised status byte (e.g. 0xF0 SysEx)', () => {
    expect(() => parseMidiMessage([0xf0, 0x00])).toThrow(TypeError);
  });

  it('throws TypeError when Note-On is too short (1 byte)', () => {
    expect(() => parseMidiMessage([0x90])).toThrow(TypeError);
  });

  it('throws TypeError when Note-On is too short (2 bytes)', () => {
    expect(() => parseMidiMessage([0x90, 60])).toThrow(TypeError);
  });

  it('throws TypeError when Note-Off is too short', () => {
    expect(() => parseMidiMessage([0x80, 60])).toThrow(TypeError);
  });

  it('throws TypeError when Control Change is too short', () => {
    expect(() => parseMidiMessage([0xb0, 64])).toThrow(TypeError);
  });

  it('throws TypeError when Program Change is too short (1 byte)', () => {
    expect(() => parseMidiMessage([0xc0])).toThrow(TypeError);
  });

  it('throws TypeError when Pitch Bend is too short', () => {
    expect(() => parseMidiMessage([0xe0, 0x00])).toThrow(TypeError);
  });
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('MIDI constants', () => {
  it('SUSTAIN_CONTROLLER is 64', () => {
    expect(SUSTAIN_CONTROLLER).toBe(64);
  });

  it('SUSTAIN_THRESHOLD is 64', () => {
    expect(SUSTAIN_THRESHOLD).toBe(64);
  });
});

// ---------------------------------------------------------------------------
// messageToNote
// ---------------------------------------------------------------------------

describe('messageToNote', () => {
  it('converts a noteOn message to the correct Note', () => {
    const msg = parseMidiMessage([0x90, 60, 100]);
    const note = messageToNote(msg);
    expect(note).not.toBeNull();
    expect(note!.midi).toBe(60);
    // MIDI 60 = C4 (middle C)
    expect(note!.note).toBe('C');
    expect(note!.octave).toBe(4);
  });

  it('converts a noteOff message to the correct Note', () => {
    const msg = parseMidiMessage([0x80, 60, 64]);
    const note = messageToNote(msg);
    expect(note).not.toBeNull();
    expect(note!.midi).toBe(60);
  });

  it('returns null for controlChange messages', () => {
    const msg = parseMidiMessage([0xb0, 64, 127]);
    expect(messageToNote(msg)).toBeNull();
  });

  it('returns null for programChange messages', () => {
    const msg = parseMidiMessage([0xc0, 0]);
    expect(messageToNote(msg)).toBeNull();
  });

  it('returns null for pitchBend messages', () => {
    const msg = parseMidiMessage([0xe0, 0x00, 0x40]);
    expect(messageToNote(msg)).toBeNull();
  });

  it('respects accidentalPreference: flats for MIDI 61 gives Db', () => {
    const msg = parseMidiMessage([0x90, 61, 80]);
    const noteFlat = messageToNote(msg, { accidentalPreference: 'flats' });
    expect(noteFlat!.note).toBe('Db');
  });

  it('defaults to sharps for MIDI 61 gives C#', () => {
    const msg = parseMidiMessage([0x90, 61, 80]);
    const noteSharp = messageToNote(msg);
    expect(noteSharp!.note).toBe('C#');
  });

  it('converts Note-On vel=0 (normalised to noteOff) to the correct note', () => {
    const msg = parseMidiMessage([0x90, 60, 0]);
    expect(msg.type).toBe('noteOff');
    const note = messageToNote(msg);
    expect(note!.midi).toBe(60);
  });
});
