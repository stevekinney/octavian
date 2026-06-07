import { describe, expect, it } from 'bun:test';
import * as fc from 'fast-check';

import { createFrequency, createMidiKey, createOctave } from './branded-types.ts';
import {
  chromaticIndexToFrequency,
  frequencyToNearestMidi,
  isChordSuffix,
  isChordSymbol,
  isInterval,
  isNoteName,
  isNoteNameWithOctave,
  isScaleType,
  midiToFrequency,
  midiToNoteNameWithOctave,
  noteNameToMidi,
  parseNoteName,
  parseNoteNameWithOctave,
} from './music-utilities.ts';
import { STANDARD_TUNING } from './tuning.ts';

describe('isNoteName', () => {
  it('returns true for valid note names', () => {
    expect(isNoteName('C')).toBe(true);
    expect(isNoteName('F#')).toBe(true);
    expect(isNoteName('Bb')).toBe(true);
    expect(isNoteName('G##')).toBe(true);
  });

  it('returns false for invalid values', () => {
    expect(isNoteName('H')).toBe(false);
    expect(isNoteName('C4')).toBe(false);
    expect(isNoteName(42)).toBe(false);
    expect(isNoteName(null)).toBe(false);
    expect(isNoteName(undefined)).toBe(false);
  });
});

describe('isNoteNameWithOctave', () => {
  it('returns true for valid note name + octave strings', () => {
    expect(isNoteNameWithOctave('C4')).toBe(true);
    expect(isNoteNameWithOctave('A-1')).toBe(true);
    expect(isNoteNameWithOctave('F#3')).toBe(true);
    expect(isNoteNameWithOctave('Bb5')).toBe(true);
  });

  it('returns false for invalid values', () => {
    expect(isNoteNameWithOctave('C')).toBe(false);
    expect(isNoteNameWithOctave('H4')).toBe(false);
    expect(isNoteNameWithOctave(42)).toBe(false);
    expect(isNoteNameWithOctave('C10')).toBe(false);
  });
});

describe('isInterval', () => {
  it('returns true for valid interval names', () => {
    expect(isInterval('perfectFifth')).toBe(true);
    expect(isInterval('majorThird')).toBe(true);
    expect(isInterval('minorSeventh')).toBe(true);
  });

  it('returns false for invalid values', () => {
    expect(isInterval('unicorn')).toBe(false);
    expect(isInterval(5)).toBe(false);
  });
});

describe('isChordSuffix', () => {
  it('returns true for valid chord suffixes', () => {
    expect(isChordSuffix('major')).toBe(true);
    expect(isChordSuffix('minor')).toBe(true);
    expect(isChordSuffix('dominantSeventh')).toBe(true);
  });

  it('returns false for invalid values', () => {
    expect(isChordSuffix('unicorn')).toBe(false);
    expect(isChordSuffix(7)).toBe(false);
  });
});

describe('isChordSymbol', () => {
  it('returns true for valid chord symbols', () => {
    expect(isChordSymbol('m')).toBe(true);
    expect(isChordSymbol('dim')).toBe(true);
    expect(isChordSymbol('7')).toBe(true);
  });

  it('returns false for invalid values', () => {
    expect(isChordSymbol('major')).toBe(false);
    expect(isChordSymbol(null)).toBe(false);
  });
});

describe('isScaleType', () => {
  it('returns true for valid scale types', () => {
    expect(isScaleType('major')).toBe(true);
    expect(isScaleType('minor')).toBe(true);
    expect(isScaleType('pentatonicMajor')).toBe(true);
  });

  it('returns false for invalid values', () => {
    expect(isScaleType('unicorn')).toBe(false);
    expect(isScaleType(null)).toBe(false);
  });
});

describe('parseNoteName', () => {
  it('parses valid note names', () => {
    const result = parseNoteName('F#');
    expect(result.note).toBe('F#');
    expect(result.natural).toBe('F');
    expect(result.accidental).toBe('#');
  });

  it('parses natural notes', () => {
    const result = parseNoteName('C');
    expect(result.note).toBe('C');
    expect(result.natural).toBe('C');
    expect(result.accidental).toBe('');
  });

  it('throws TypeError for invalid note names', () => {
    expect(() => parseNoteName('H')).toThrow(TypeError);
    expect(() => parseNoteName('H')).toThrow(/unsupported note name/i);
    expect(() => parseNoteName(42)).toThrow(TypeError);
  });
});

describe('parseNoteNameWithOctave', () => {
  it('parses valid note name + octave strings', () => {
    const result = parseNoteNameWithOctave('A4');
    expect(result.note).toBe('A');
    expect(result.octave).toBe(4);
  });

  it('parses negative octave', () => {
    const result = parseNoteNameWithOctave('C-1');
    expect(result.note).toBe('C');
    expect(result.octave).toBe(-1);
  });

  it('parses accidentals with octave', () => {
    const result = parseNoteNameWithOctave('F#3');
    expect(result.note).toBe('F#');
    expect(result.octave).toBe(3);
  });

  it('throws TypeError for invalid strings', () => {
    expect(() => parseNoteNameWithOctave('H4')).toThrow(TypeError);
    expect(() => parseNoteNameWithOctave('H4')).toThrow(/unsupported note string/i);
    expect(() => parseNoteNameWithOctave(99)).toThrow(TypeError);
  });
});

describe('noteNameToMidi', () => {
  it('converts well-known note names to MIDI', () => {
    expect(noteNameToMidi('C', createOctave(4))).toBe(60);
    expect(noteNameToMidi('A', createOctave(4))).toBe(69);
    expect(noteNameToMidi('C', createOctave(-1))).toBe(0);
    expect(noteNameToMidi('G', createOctave(9))).toBe(127);
  });
});

describe('midiToNoteNameWithOctave', () => {
  it('converts MIDI to note and octave with default sharps preference', () => {
    const result = midiToNoteNameWithOctave(createMidiKey(60));
    expect(result.note).toBe('C');
    expect(result.octave).toBe(4);
  });

  it('respects flats preference', () => {
    const result = midiToNoteNameWithOctave(createMidiKey(61), 'flats');
    expect(result.note).toBe('Db');
  });

  it('respects sharps preference', () => {
    const result = midiToNoteNameWithOctave(createMidiKey(61), 'sharps');
    expect(result.note).toBe('C#');
  });

  it('round-trips across the full MIDI range', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 127 }), (midi) => {
        const midiKey = createMidiKey(midi);
        const { note, octave } = midiToNoteNameWithOctave(midiKey);
        expect(noteNameToMidi(note, octave)).toBe(midi);
      }),
      { numRuns: 50 },
    );
  });
});

describe('midiToFrequency', () => {
  it('returns 440 Hz for MIDI 69 (A4) with standard tuning', () => {
    expect(Number(midiToFrequency(69))).toBe(440);
  });

  it('accepts a branded MidiKey', () => {
    expect(Number(midiToFrequency(createMidiKey(69)))).toBe(440);
  });

  it('accepts a plain number', () => {
    expect(Number(midiToFrequency(69))).toBe(440);
  });

  it('plain number and branded MidiKey produce identical results', () => {
    expect(midiToFrequency(69)).toBe(midiToFrequency(createMidiKey(69)));
  });

  it('uses alternate tuning when supplied', () => {
    const tuning432 = { reference: 'A4', frequency: createFrequency(432) } as const;
    expect(Number(midiToFrequency(69, tuning432))).toBeCloseTo(432, 9);
  });

  it('throws RangeError for plain number out of MIDI range', () => {
    expect(() => midiToFrequency(128)).toThrow(RangeError);
    expect(() => midiToFrequency(-1)).toThrow(RangeError);
    expect(() => midiToFrequency(128)).toThrow(/range 0\.\.127/i);
  });

  it('maps C4 (MIDI 60) to approximately 261.63 Hz', () => {
    expect(Number(midiToFrequency(60))).toBeCloseTo(261.6255653005986, 9);
  });
});

describe('chromaticIndexToFrequency', () => {
  it('returns 440 Hz for pitch class 9 (A), octave 4 with standard tuning', () => {
    expect(Number(chromaticIndexToFrequency(9, 4))).toBeCloseTo(440, 9);
  });

  it('pitch class 0 octave 4 is C4 (~261.63 Hz)', () => {
    expect(Number(chromaticIndexToFrequency(0, 4))).toBeCloseTo(261.6255653005986, 9);
  });

  it('uses alternate tuning when supplied', () => {
    const tuning432 = { reference: 'A4', frequency: createFrequency(432) } as const;
    expect(Number(chromaticIndexToFrequency(9, 4, tuning432))).toBeCloseTo(432, 9);
  });

  it('throws RangeError for out-of-range pitch class', () => {
    expect(() => chromaticIndexToFrequency(12, 4)).toThrow(RangeError);
    expect(() => chromaticIndexToFrequency(-1, 4)).toThrow(RangeError);
    expect(() => chromaticIndexToFrequency(12, 4)).toThrow(/range 0\.\.11/i);
  });

  it('throws RangeError for out-of-range octave', () => {
    expect(() => chromaticIndexToFrequency(0, 10)).toThrow(RangeError);
    expect(() => chromaticIndexToFrequency(0, -2)).toThrow(RangeError);
  });

  it('matches midiToFrequency for all pitch classes in octave 4', () => {
    for (let pc = 0; pc <= 11; pc += 1) {
      const expectedMidi = 5 * 12 + pc; // (4 + 1) * 12 + pc
      expect(Number(chromaticIndexToFrequency(pc, 4))).toBeCloseTo(
        Number(midiToFrequency(expectedMidi)),
        9,
      );
    }
  });
});

describe('frequencyToNearestMidi', () => {
  it('returns MIDI 69 for 440 Hz standard tuning', () => {
    expect(frequencyToNearestMidi(440)).toBe(69);
  });

  it('returns MIDI 69 with alternate tuning for that tuning frequency', () => {
    const tuning432 = { reference: 'A4', frequency: createFrequency(432) } as const;
    expect(frequencyToNearestMidi(432, tuning432)).toBe(69);
  });

  it('round-trips with midiToFrequency for a sample of MIDI keys', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 127 }), (midi) => {
        const freq = midiToFrequency(midi, STANDARD_TUNING);
        expect(frequencyToNearestMidi(Number(freq), STANDARD_TUNING)).toBe(midi);
      }),
      { numRuns: 50 },
    );
  });

  it('throws RangeError for frequencies that would exceed MIDI range', () => {
    // A frequency corresponding to MIDI > 127 should throw
    expect(() => frequencyToNearestMidi(1e7)).toThrow(RangeError);
  });
});
