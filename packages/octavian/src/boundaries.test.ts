import { describe, expect, it } from 'bun:test';

import { createFrequency, createSemitones } from './branded-types.ts';
import { applyInterval, Note } from './note.ts';
import { ACCIDENTALS, NATURALS, type NoteName } from './note-spellings.ts';
import { isNoteName } from './music-utilities.ts';

describe('MIDI range boundaries', () => {
  it('Note.fromMidi handles the lowest valid MIDI value', () => {
    expect(Note.fromMidi(0).toString()).toBe('C-1');
  });

  it('Note.fromMidi handles the highest valid MIDI value', () => {
    expect(Note.fromMidi(127).toString()).toBe('G9');
  });

  it('Note.fromMidi throws RangeError for -1', () => {
    expect(() => Note.fromMidi(-1)).toThrow(RangeError);
  });

  it('Note.fromMidi throws RangeError for 128', () => {
    expect(() => Note.fromMidi(128)).toThrow(RangeError);
  });

  it('Note constructed at MIDI 0 (C-1) is valid', () => {
    const note = Note.create('C-1');
    expect(Number(note.midi)).toBe(0);
  });

  it('Note constructed at MIDI 127 (G9) is valid', () => {
    const note = Note.create('G9');
    expect(Number(note.midi)).toBe(127);
  });
});

describe('frequency boundaries', () => {
  it('Note.nearestTo resolves the lowest practical frequency near MIDI 0', () => {
    // MIDI 0 ≈ 8.175 Hz at standard tuning
    const note = Note.nearestTo(8.175);
    expect(Number(note.midi)).toBe(0);
  });

  it('Note.nearestTo resolves the highest practical frequency near MIDI 127', () => {
    // MIDI 127 ≈ 12543.85 Hz at standard tuning
    const note = Note.nearestTo(12543.85);
    expect(Number(note.midi)).toBe(127);
  });

  it('createFrequency throws RangeError for NaN', () => {
    expect(() => createFrequency(NaN)).toThrow(RangeError);
  });

  it('createFrequency throws RangeError for Infinity', () => {
    expect(() => createFrequency(Infinity)).toThrow(RangeError);
  });

  it('createFrequency throws RangeError for -Infinity', () => {
    expect(() => createFrequency(-Infinity)).toThrow(RangeError);
  });

  it('createFrequency throws RangeError for 0', () => {
    expect(() => createFrequency(0)).toThrow(RangeError);
  });

  it('createFrequency throws RangeError for negative values', () => {
    expect(() => createFrequency(-1)).toThrow(RangeError);
  });
});

describe('enharmonic and octave-crossing spellings', () => {
  it('B#3 is in the next octave (MIDI 60 = C4)', () => {
    expect(Number(Note.create('B#3').midi)).toBe(60);
  });

  it('B#3 simplifies to C4', () => {
    expect(Note.create('B#3').simplify().toString()).toBe('C4');
  });

  it('Cb4 is in the previous octave (MIDI 59 = B3)', () => {
    expect(Number(Note.create('Cb4').midi)).toBe(59);
  });

  it('E#4 and F4 share the same MIDI value', () => {
    expect(Number(Note.create('E#4').midi)).toBe(Number(Note.create('F4').midi));
  });

  it('Fb4 and E4 share the same MIDI value', () => {
    expect(Number(Note.create('Fb4').midi)).toBe(Number(Note.create('E4').midi));
  });

  it('F##4 and G4 share the same MIDI value', () => {
    expect(Number(Note.create('F##4').midi)).toBe(Number(Note.create('G4').midi));
  });

  it('Gbb4 and F4 share the same MIDI value', () => {
    expect(Number(Note.create('Gbb4').midi)).toBe(Number(Note.create('F4').midi));
  });

  it('B#9 throws RangeError because it resolves to MIDI 132', () => {
    expect(() => Note.create('B#9')).toThrow(RangeError);
  });

  it('Cb-1 throws RangeError because it resolves to MIDI -1', () => {
    expect(() => Note.create('Cb-1')).toThrow(RangeError);
  });
});

describe('octave boundary cases for Note.up and Note.down', () => {
  it('Note.up throws RangeError when the result exceeds octave 9', () => {
    // G9 is the highest valid note (MIDI 127); going up one octave requires octave 10
    expect(() => Note.create('G9').up()).toThrow(RangeError);
  });

  it('Note.down throws RangeError when the result goes below octave -1', () => {
    // C-1 is MIDI 0; going down one octave requires octave -2
    expect(() => Note.create('C-1').down()).toThrow(RangeError);
  });
});

describe('createSemitones edge cases', () => {
  it('createSemitones(0) returns 0', () => {
    expect(createSemitones(0)).toBe(0);
  });

  it('createSemitones(-127) works for large negative integers', () => {
    expect(createSemitones(-127)).toBe(-127);
  });

  it('createSemitones(1.5) throws RangeError for non-integers', () => {
    expect(() => createSemitones(1.5)).toThrow(RangeError);
  });
});

describe('applyInterval boundaries', () => {
  it('applyInterval from F#9 by minorSecond reaches G9 (MIDI 127)', () => {
    // F#9 = MIDI 126; minorSecond = +1 semitone; result = G9 = MIDI 127
    const result = applyInterval(Note.create('F#9'), 'minorSecond');
    expect(Number(result.midi)).toBe(127);
  });

  it('applyInterval from G9 by minorSecond throws RangeError (MIDI 128 out of range)', () => {
    // G9 = MIDI 127; minorSecond = +1 semitone; result would be MIDI 128 which is invalid
    expect(() => applyInterval(Note.create('G9'), 'minorSecond')).toThrow(RangeError);
  });
});

describe('note name construction matrix', () => {
  it.each(NATURALS.flatMap((natural) => ACCIDENTALS.map((accidental) => [natural, accidental])))(
    'Note name %s%s at octave 4 either constructs validly or throws RangeError',
    (natural, accidental) => {
      const candidate = `${natural}${accidental}`;
      if (!isNoteName(candidate)) return;
      const noteName: NoteName = candidate;
      try {
        const note = Note.create(`${noteName}4`);
        expect(Number(note.midi)).toBeGreaterThanOrEqual(0);
        expect(Number(note.midi)).toBeLessThanOrEqual(127);
      } catch (error) {
        expect(error).toBeInstanceOf(RangeError);
      }
    },
  );
});
