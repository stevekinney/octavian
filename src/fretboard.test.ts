import { describe, expect, it } from 'bun:test';
import * as fc from 'fast-check';

import { Chord } from './chord.js';
import {
  STANDARD_BASS_TUNING,
  STANDARD_GUITAR_TUNING,
  chordPositionsFor,
  fretPositionsFor,
  noteAtFret,
  scalePositionsFor,
  type FretPosition,
  type StringInstrumentTuning,
} from './fretboard.js';
import { Note } from './note.js';
import { Scale } from './scale.js';

function assertFretPosition(pos: FretPosition): void {
  expect(typeof pos.stringIndex).toBe('number');
  expect(typeof pos.fret).toBe('number');
  expect(pos.note).toBeInstanceOf(Note);
}

describe('noteAtFret', () => {
  it('returns open string notes at fret 0', () => {
    expect(noteAtFret(STANDARD_GUITAR_TUNING, 0, 0).toString()).toBe('E2');
    expect(noteAtFret(STANDARD_GUITAR_TUNING, 1, 0).toString()).toBe('A2');
    expect(noteAtFret(STANDARD_GUITAR_TUNING, 2, 0).toString()).toBe('D3');
    expect(noteAtFret(STANDARD_GUITAR_TUNING, 3, 0).toString()).toBe('G3');
    expect(noteAtFret(STANDARD_GUITAR_TUNING, 4, 0).toString()).toBe('B3');
    expect(noteAtFret(STANDARD_GUITAR_TUNING, 5, 0).toString()).toBe('E4');
  });

  it('returns A2 at fret 5 on the low E string', () => {
    expect(noteAtFret(STANDARD_GUITAR_TUNING, 0, 5).toString()).toBe('A2');
  });

  it('returns one octave above at fret 12', () => {
    const fret12 = noteAtFret(STANDARD_GUITAR_TUNING, 0, 12);
    expect(fret12.toString()).toBe('E3');
    expect(Number(fret12.midi) - Number(Note.create('E2').midi)).toBe(12);
  });

  it('works with standard bass tuning', () => {
    expect(noteAtFret(STANDARD_BASS_TUNING, 0, 0).toString()).toBe('E1');
    expect(noteAtFret(STANDARD_BASS_TUNING, 1, 0).toString()).toBe('A1');
    expect(noteAtFret(STANDARD_BASS_TUNING, 2, 0).toString()).toBe('D2');
    expect(noteAtFret(STANDARD_BASS_TUNING, 3, 0).toString()).toBe('G2');
  });

  it('works with a custom tuning', () => {
    const dropD: StringInstrumentTuning = { strings: ['D2', 'A2', 'D3', 'G3', 'B3', 'E4'] };
    expect(noteAtFret(dropD, 0, 0).toString()).toBe('D2');
    expect(noteAtFret(dropD, 0, 2).toString()).toBe('E2');
  });

  it('throws RangeError for negative fret', () => {
    expect(() => noteAtFret(STANDARD_GUITAR_TUNING, 0, -1)).toThrow(RangeError);
    expect(() => noteAtFret(STANDARD_GUITAR_TUNING, 0, -1)).toThrow('non-negative integer fret');
  });

  it('throws RangeError for non-integer fret', () => {
    expect(() => noteAtFret(STANDARD_GUITAR_TUNING, 0, 1.5)).toThrow(RangeError);
  });

  it('throws RangeError for string index out of range', () => {
    expect(() => noteAtFret(STANDARD_GUITAR_TUNING, 6, 0)).toThrow(RangeError);
    expect(() => noteAtFret(STANDARD_GUITAR_TUNING, 6, 0)).toThrow('out of range');
  });

  it('throws RangeError for negative string index', () => {
    expect(() => noteAtFret(STANDARD_GUITAR_TUNING, -1, 0)).toThrow(RangeError);
  });

  it('throws RangeError for non-integer string index', () => {
    expect(() => noteAtFret(STANDARD_GUITAR_TUNING, 0.5, 0)).toThrow(RangeError);
  });

  it('throws RangeError when fret exceeds MIDI 127', () => {
    expect(() => noteAtFret(STANDARD_GUITAR_TUNING, 5, 64)).toThrow(RangeError);
    expect(() => noteAtFret(STANDARD_GUITAR_TUNING, 5, 64)).toThrow('127');
  });
});

describe('STANDARD_GUITAR_TUNING', () => {
  it('has 6 strings in strictly ascending pitch order', () => {
    const notes = STANDARD_GUITAR_TUNING.strings.map((s) => Note.create(s));
    expect(notes).toHaveLength(6);
    for (let i = 1; i < notes.length; i += 1) {
      // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
      expect(Number(notes[i].midi)).toBeGreaterThan(Number(notes[i - 1].midi));
    }
  });

  it('open strings are E2 A2 D3 G3 B3 E4', () => {
    const strings = STANDARD_GUITAR_TUNING.strings.map((s) => Note.create(s).toString());
    expect(strings).toEqual(['E2', 'A2', 'D3', 'G3', 'B3', 'E4']);
  });
});

describe('STANDARD_BASS_TUNING', () => {
  it('has 4 strings in strictly ascending pitch order', () => {
    const notes = STANDARD_BASS_TUNING.strings.map((s) => Note.create(s));
    expect(notes).toHaveLength(4);
    for (let i = 1; i < notes.length; i += 1) {
      // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
      expect(Number(notes[i].midi)).toBeGreaterThan(Number(notes[i - 1].midi));
    }
  });

  it('open strings are E1 A1 D2 G2', () => {
    const strings = STANDARD_BASS_TUNING.strings.map((s) => Note.create(s).toString());
    expect(strings).toEqual(['E1', 'A1', 'D2', 'G2']);
  });
});

describe('fretPositionsFor (pitch-class mode)', () => {
  it('finds positions with the target pitch class across all strings', () => {
    const positions = fretPositionsFor(STANDARD_GUITAR_TUNING, 4);
    expect(positions.length).toBeGreaterThan(0);
    for (const pos of positions) {
      assertFretPosition(pos);
      expect(pos.note.chromaticIndex).toBe(4);
    }
  });

  it('returns the exact set of pitch-class E (4) positions on frets 0..12', () => {
    const positions = fretPositionsFor(STANDARD_GUITAR_TUNING, 4, { minFret: 0, maxFret: 12 });
    expect(
      positions.map((p) => ({ stringIndex: p.stringIndex, fret: p.fret, note: p.note.toString() })),
    ).toEqual([
      { stringIndex: 0, fret: 0, note: 'E2' },
      { stringIndex: 0, fret: 12, note: 'E3' },
      { stringIndex: 1, fret: 7, note: 'E3' },
      { stringIndex: 2, fret: 2, note: 'E3' },
      { stringIndex: 3, fret: 9, note: 'E4' },
      { stringIndex: 4, fret: 5, note: 'E4' },
      { stringIndex: 5, fret: 0, note: 'E4' },
      { stringIndex: 5, fret: 12, note: 'E5' },
    ]);
  });

  it('finds the open low E string (string 0, fret 0) for pitch class 4', () => {
    const positions = fretPositionsFor(STANDARD_GUITAR_TUNING, 4, { minFret: 0, maxFret: 0 });
    const found = positions.find((p) => p.stringIndex === 0 && p.fret === 0);
    expect(found?.note.toString()).toBe('E2');
  });

  it('results are ordered by stringIndex then fret', () => {
    const positions = fretPositionsFor(STANDARD_GUITAR_TUNING, 0);
    let prevKey = -1;
    for (const pos of positions) {
      const key = pos.stringIndex * 1000 + pos.fret;
      expect(key).toBeGreaterThan(prevKey);
      prevKey = key;
    }
  });

  it('handles enharmonic pitch classes (pitch class 1 covers Db and C#)', () => {
    const positions = fretPositionsFor(STANDARD_GUITAR_TUNING, 1);
    expect(positions.length).toBeGreaterThan(0);
    for (const pos of positions) {
      expect(pos.note.chromaticIndex).toBe(1);
    }
  });

  it('respects custom fret range', () => {
    const positions = fretPositionsFor(STANDARD_GUITAR_TUNING, 4, { minFret: 5, maxFret: 7 });
    for (const pos of positions) {
      expect(pos.fret).toBeGreaterThanOrEqual(5);
      expect(pos.fret).toBeLessThanOrEqual(7);
    }
  });

  it('includes frets at exactly minFret and maxFret', () => {
    const positions = fretPositionsFor(STANDARD_GUITAR_TUNING, 9, { minFret: 5, maxFret: 5 });
    const found = positions.find((p) => p.stringIndex === 0 && p.fret === 5);
    expect(found).toBeDefined();
  });

  it('throws RangeError for pitch class below 0', () => {
    expect(() => fretPositionsFor(STANDARD_GUITAR_TUNING, -1)).toThrow(RangeError);
  });

  it('throws RangeError for pitch class above 11', () => {
    expect(() => fretPositionsFor(STANDARD_GUITAR_TUNING, 12)).toThrow(RangeError);
  });

  it('throws RangeError when minFret > maxFret', () => {
    expect(() => fretPositionsFor(STANDARD_GUITAR_TUNING, 4, { minFret: 5, maxFret: 3 })).toThrow(
      RangeError,
    );
  });

  it('throws RangeError for negative minFret', () => {
    expect(() => fretPositionsFor(STANDARD_GUITAR_TUNING, 4, { minFret: -1 })).toThrow(RangeError);
  });

  it('throws RangeError for negative maxFret', () => {
    expect(() => fretPositionsFor(STANDARD_GUITAR_TUNING, 4, { maxFret: -1 })).toThrow(RangeError);
  });

  it('throws RangeError for non-integer minFret', () => {
    expect(() => fretPositionsFor(STANDARD_GUITAR_TUNING, 4, { minFret: 0.5 })).toThrow(RangeError);
  });

  it('throws RangeError for non-integer maxFret', () => {
    expect(() => fretPositionsFor(STANDARD_GUITAR_TUNING, 4, { maxFret: 1.5 })).toThrow(RangeError);
  });
});

describe('fretPositionsFor (NoteLike mode)', () => {
  it('finds positions matching an exact pitch (octave-sensitive)', () => {
    const positions = fretPositionsFor(STANDARD_GUITAR_TUNING, 'E2');
    expect(positions.every((p) => p.note.midi === Note.create('E2').midi)).toBe(true);
  });

  it('does not find E3 when searching for E2', () => {
    const positions = fretPositionsFor(STANDARD_GUITAR_TUNING, 'E2');
    expect(positions.some((p) => p.note.toString() === 'E3')).toBe(false);
  });

  it('Db3 and C#3 return the same positions (enharmonic matching)', () => {
    const db3 = fretPositionsFor(STANDARD_GUITAR_TUNING, 'Db3', { minFret: 0, maxFret: 12 });
    const cs3 = fretPositionsFor(STANDARD_GUITAR_TUNING, 'C#3', { minFret: 0, maxFret: 12 });
    expect(db3.length).toBe(cs3.length);
    for (let i = 0; i < db3.length; i += 1) {
      // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
      expect(db3[i].stringIndex).toBe(cs3[i].stringIndex);
      // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
      expect(db3[i].fret).toBe(cs3[i].fret);
    }
  });

  it('accepts a Note instance as input', () => {
    const target = Note.create('A2');
    const positions = fretPositionsFor(STANDARD_GUITAR_TUNING, target);
    expect(positions.every((p) => p.note.midi === target.midi)).toBe(true);
  });

  it('returned Note has correct octave', () => {
    const positions = fretPositionsFor(STANDARD_GUITAR_TUNING, 'A2', { minFret: 5, maxFret: 5 });
    const found = positions.find((p) => p.stringIndex === 0 && p.fret === 5);
    expect(found?.note.toString()).toBe('A2');
    expect(found?.note.octave).toBe(2);
  });
});

describe('scalePositionsFor', () => {
  it('returns only notes belonging to the C major scale', () => {
    const scale = Scale.create('C4', 'major');
    const positions = scalePositionsFor(STANDARD_GUITAR_TUNING, scale, {
      minFret: 0,
      maxFret: 12,
    });
    const cMajorPitchClasses = new Set([0, 2, 4, 5, 7, 9, 11]);
    expect(positions.length).toBeGreaterThan(0);
    for (const pos of positions) {
      expect(cMajorPitchClasses.has(pos.note.chromaticIndex)).toBe(true);
    }
  });

  it('returns the exact set of C major scale positions on frets 0..2', () => {
    const scale = Scale.create('C4', 'major');
    const positions = scalePositionsFor(STANDARD_GUITAR_TUNING, scale, { minFret: 0, maxFret: 2 });
    // Computed: strings E2/A2/D3/G3/B3/E4, frets 0–2, only C-D-E-F-G-A-B pitch classes
    expect(
      positions.map((p) => ({ stringIndex: p.stringIndex, fret: p.fret, note: p.note.toString() })),
    ).toEqual([
      { stringIndex: 0, fret: 0, note: 'E2' },
      { stringIndex: 0, fret: 1, note: 'F2' },
      { stringIndex: 1, fret: 0, note: 'A2' },
      { stringIndex: 1, fret: 2, note: 'B2' },
      { stringIndex: 2, fret: 0, note: 'D3' },
      { stringIndex: 2, fret: 2, note: 'E3' },
      { stringIndex: 3, fret: 0, note: 'G3' },
      { stringIndex: 3, fret: 2, note: 'A3' },
      { stringIndex: 4, fret: 0, note: 'B3' },
      { stringIndex: 4, fret: 1, note: 'C4' },
      { stringIndex: 5, fret: 0, note: 'E4' },
      { stringIndex: 5, fret: 1, note: 'F4' },
    ]);
  });

  it('respects a custom fret range', () => {
    const scale = Scale.create('G4', 'major');
    const positions = scalePositionsFor(STANDARD_GUITAR_TUNING, scale, {
      minFret: 3,
      maxFret: 5,
    });
    for (const pos of positions) {
      expect(pos.fret).toBeGreaterThanOrEqual(3);
      expect(pos.fret).toBeLessThanOrEqual(5);
    }
  });

  it('works with bass tuning', () => {
    const scale = Scale.create('A1', 'naturalMinor');
    const positions = scalePositionsFor(STANDARD_BASS_TUNING, scale, { minFret: 0, maxFret: 12 });
    expect(positions.length).toBeGreaterThan(0);
    for (const pos of positions) {
      expect(scale.has(pos.note)).toBe(true);
    }
  });

  it('works with a custom tuning and custom string count', () => {
    const ukulele: StringInstrumentTuning = { strings: ['G4', 'C4', 'E4', 'A4'] };
    const scale = Scale.create('C4', 'major');
    const positions = scalePositionsFor(ukulele, scale);
    expect(positions.length).toBeGreaterThan(0);
    for (const pos of positions) {
      expect(scale.has(pos.note)).toBe(true);
    }
  });

  it('result array is frozen', () => {
    const positions = scalePositionsFor(STANDARD_GUITAR_TUNING, Scale.create('C4', 'major'));
    expect(Object.isFrozen(positions)).toBe(true);
  });
});

describe('chordPositionsFor', () => {
  it('returns only notes belonging to a C major chord (C, E, G = pitch classes 0, 4, 7)', () => {
    const chord = Chord.create('C4', 'major');
    const positions = chordPositionsFor(STANDARD_GUITAR_TUNING, chord, {
      minFret: 0,
      maxFret: 12,
    });
    const cMajorPitchClasses = new Set([0, 4, 7]);
    expect(positions.length).toBeGreaterThan(0);
    for (const pos of positions) {
      expect(cMajorPitchClasses.has(pos.note.chromaticIndex)).toBe(true);
    }
  });

  it('returns the exact set of C major chord positions on frets 0..3', () => {
    const chord = Chord.create('C4', 'major');
    const positions = chordPositionsFor(STANDARD_GUITAR_TUNING, chord, { minFret: 0, maxFret: 3 });
    expect(
      positions.map((p) => ({ stringIndex: p.stringIndex, fret: p.fret, note: p.note.toString() })),
    ).toEqual([
      { stringIndex: 0, fret: 0, note: 'E2' },
      { stringIndex: 0, fret: 3, note: 'G2' },
      { stringIndex: 1, fret: 3, note: 'C3' },
      { stringIndex: 2, fret: 2, note: 'E3' },
      { stringIndex: 3, fret: 0, note: 'G3' },
      { stringIndex: 4, fret: 1, note: 'C4' },
      { stringIndex: 5, fret: 0, note: 'E4' },
      { stringIndex: 5, fret: 3, note: 'G4' },
    ]);
  });

  it('respects a custom fret range', () => {
    const chord = Chord.create('E2', 'minor');
    const positions = chordPositionsFor(STANDARD_GUITAR_TUNING, chord, {
      minFret: 0,
      maxFret: 5,
    });
    for (const pos of positions) {
      expect(pos.fret).toBeLessThanOrEqual(5);
    }
  });

  it('works with a 7th chord', () => {
    const chord = Chord.create('G2', 'dominantSeventh');
    const positions = chordPositionsFor(STANDARD_GUITAR_TUNING, chord, { minFret: 0, maxFret: 12 });
    expect(positions.length).toBeGreaterThan(0);
    for (const pos of positions) {
      expect(chord.has(pos.note)).toBe(true);
    }
  });

  it('result array is frozen', () => {
    const positions = chordPositionsFor(STANDARD_GUITAR_TUNING, Chord.create('C4', 'major'));
    expect(Object.isFrozen(positions)).toBe(true);
  });
});

describe('edge cases', () => {
  it('returns empty array when no positions match', () => {
    const allC: StringInstrumentTuning = { strings: ['C4'] };
    expect(fretPositionsFor(allC, 1, { minFret: 0, maxFret: 0 })).toHaveLength(0);
  });

  it('positions beyond MIDI 127 are silently skipped', () => {
    expect(() =>
      fretPositionsFor(STANDARD_GUITAR_TUNING, 4, { minFret: 0, maxFret: 90 }),
    ).not.toThrow();
  });

  it('minFret === maxFret returns only that fret', () => {
    const positions = fretPositionsFor(STANDARD_GUITAR_TUNING, 4, { minFret: 7, maxFret: 7 });
    for (const pos of positions) {
      expect(pos.fret).toBe(7);
    }
  });

  it('fretPositionsFor result array is frozen', () => {
    expect(Object.isFrozen(fretPositionsFor(STANDARD_GUITAR_TUNING, 4))).toBe(true);
  });

  it('StringInstrumentTuning without name is valid', () => {
    const unnamed: StringInstrumentTuning = { strings: ['C3', 'G3', 'D4', 'A4'] };
    expect(noteAtFret(unnamed, 0, 0).toString()).toBe('C3');
  });
});

describe('string ordering (left-to-right = low-to-high)', () => {
  it('strings[0] is the lowest-pitched string', () => {
    const lowestNote = Note.create(STANDARD_GUITAR_TUNING.strings[0]);
    for (const stringEntry of STANDARD_GUITAR_TUNING.strings) {
      expect(Number(lowestNote.midi)).toBeLessThanOrEqual(Number(Note.create(stringEntry).midi));
    }
  });

  it('scalePositionsFor results are ordered by stringIndex then fret', () => {
    const scale = Scale.create('A4', 'naturalMinor');
    const positions = scalePositionsFor(STANDARD_GUITAR_TUNING, scale);
    const keys = positions.map((p) => p.stringIndex * 1000 + p.fret);
    expect(keys).toEqual([...keys].toSorted((a, b) => a - b));
  });

  it('chordPositionsFor results are ordered by stringIndex then fret', () => {
    const chord = Chord.create('A2', 'minor');
    const positions = chordPositionsFor(STANDARD_GUITAR_TUNING, chord);
    const keys = positions.map((p) => p.stringIndex * 1000 + p.fret);
    expect(keys).toEqual([...keys].toSorted((a, b) => a - b));
  });
});

describe('property tests', () => {
  it('noteAtFret at fret 0 equals the open string note', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 5 }), (stringIndex) => {
        const open = Note.create(STANDARD_GUITAR_TUNING.strings[stringIndex]);
        expect(noteAtFret(STANDARD_GUITAR_TUNING, stringIndex, 0).midi).toBe(open.midi);
      }),
      { numRuns: 50 },
    );
  });

  it('noteAtFret at fret n is n semitones above fret 0', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5 }),
        fc.integer({ min: 0, max: 20 }),
        (stringIndex, fret) => {
          const openMidi = Number(Note.create(STANDARD_GUITAR_TUNING.strings[stringIndex]).midi);
          if (openMidi + fret > 127) return;
          expect(Number(noteAtFret(STANDARD_GUITAR_TUNING, stringIndex, fret).midi)).toBe(
            openMidi + fret,
          );
        },
      ),
      { numRuns: 50 },
    );
  });

  it('fretPositionsFor always returns the expected pitch class (numeric input)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 11 }), (pc) => {
        const positions = fretPositionsFor(STANDARD_GUITAR_TUNING, pc, { minFret: 0, maxFret: 5 });
        for (const pos of positions) {
          expect(pos.note.chromaticIndex).toBe(pc);
        }
      }),
      { numRuns: 50 },
    );
  });

  it('fretPositionsFor is a subset of scalePositionsFor (chromatic scale covers all)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 11 }), (pc) => {
        const scale = Scale.create('C4', 'chromatic');
        const byPc = fretPositionsFor(STANDARD_GUITAR_TUNING, pc, { minFret: 0, maxFret: 5 });
        const scalePos = scalePositionsFor(STANDARD_GUITAR_TUNING, scale, {
          minFret: 0,
          maxFret: 5,
        });
        for (const pos of byPc) {
          expect(
            scalePos.some((sp) => sp.stringIndex === pos.stringIndex && sp.fret === pos.fret),
          ).toBe(true);
        }
      }),
      { numRuns: 50 },
    );
  });
});

describe('issue acceptance criteria', () => {
  it('noteAtFret(STANDARD_GUITAR_TUNING, 0, 0) = E2', () => {
    expect(noteAtFret(STANDARD_GUITAR_TUNING, 0, 0).toString()).toBe('E2');
  });

  it('string 5 (high E) open = E4', () => {
    expect(noteAtFret(STANDARD_GUITAR_TUNING, 5, 0).toString()).toBe('E4');
  });

  it('fret 5 on low E = A2', () => {
    expect(noteAtFret(STANDARD_GUITAR_TUNING, 0, 5).toString()).toBe('A2');
  });

  it('fret 12 on low E = E3 (one octave above E2)', () => {
    const fret12 = noteAtFret(STANDARD_GUITAR_TUNING, 0, 12);
    expect(fret12.toString()).toBe('E3');
    expect(fret12.octave).toBe(3);
  });

  it('scalePositionsFor(C major) returns only C major pitch classes', () => {
    const scale = Scale.create('C4', 'major');
    const positions = scalePositionsFor(STANDARD_GUITAR_TUNING, scale, { minFret: 0, maxFret: 12 });
    const cMajorPc = new Set([0, 2, 4, 5, 7, 9, 11]);
    for (const pos of positions) {
      expect(cMajorPc.has(pos.note.chromaticIndex)).toBe(true);
    }
  });

  it('chordPositionsFor(C major chord) returns only C, E, G pitch classes', () => {
    const chord = Chord.create('C4', 'major');
    const positions = chordPositionsFor(STANDARD_GUITAR_TUNING, chord, { minFret: 0, maxFret: 12 });
    const cMajorPc = new Set([0, 4, 7]);
    for (const pos of positions) {
      expect(cMajorPc.has(pos.note.chromaticIndex)).toBe(true);
    }
  });

  it('fretPositionsFor finds Db and C# as the same pitch class (1)', () => {
    const positions = fretPositionsFor(STANDARD_GUITAR_TUNING, 1, { minFret: 0, maxFret: 12 });
    expect(positions.length).toBeGreaterThan(0);
    for (const pos of positions) {
      expect(pos.note.chromaticIndex).toBe(1);
    }
  });

  it('custom string count works with fretPositionsFor', () => {
    const fiveBass: StringInstrumentTuning = {
      strings: ['B0', 'E1', 'A1', 'D2', 'G2'],
    };
    const positions = fretPositionsFor(fiveBass, 11, { minFret: 0, maxFret: 12 });
    expect(positions.length).toBeGreaterThan(0);
    for (const pos of positions) {
      expect(pos.note.chromaticIndex).toBe(11);
    }
  });

  it('stringIndex 0 is the lowest-pitched string (left-to-right ordering)', () => {
    const note0 = noteAtFret(STANDARD_GUITAR_TUNING, 0, 0);
    const note5 = noteAtFret(STANDARD_GUITAR_TUNING, 5, 0);
    expect(Number(note0.midi)).toBeLessThan(Number(note5.midi));
  });
});
