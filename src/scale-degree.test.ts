import { describe, expect, it } from 'bun:test';
import * as fc from 'fast-check';

import { Key } from './key.js';
import { Scale } from './scale.js';
import { degreeForNote, noteForDegree } from './scale-degree.js';

const cMajor = Key.create('C', 'major');
const aMinor = Key.create('A', 'minor');
const gMajor = Key.create('G', 'major');
const bFlatMajor = Key.create('Bb', 'major');

// ---------------------------------------------------------------------------
// degreeForNote — diatonic notes in C major
// ---------------------------------------------------------------------------

describe('degreeForNote — diatonic C major', () => {
  it('degree 1 for C (tonic)', () => {
    const result = degreeForNote(cMajor, 'C');
    expect(result).toEqual({ degree: 1, alteration: '', semitoneFromTonic: 0 });
  });

  it('degree 2 for D', () => {
    const result = degreeForNote(cMajor, 'D');
    expect(result).toEqual({ degree: 2, alteration: '', semitoneFromTonic: 2 });
  });

  it('degree 3 for E', () => {
    const result = degreeForNote(cMajor, 'E');
    expect(result).toEqual({ degree: 3, alteration: '', semitoneFromTonic: 4 });
  });

  it('degree 4 for F', () => {
    const result = degreeForNote(cMajor, 'F');
    expect(result).toEqual({ degree: 4, alteration: '', semitoneFromTonic: 5 });
  });

  it('degree 5 for G', () => {
    const result = degreeForNote(cMajor, 'G');
    expect(result).toEqual({ degree: 5, alteration: '', semitoneFromTonic: 7 });
  });

  it('degree 6 for A', () => {
    const result = degreeForNote(cMajor, 'A');
    expect(result).toEqual({ degree: 6, alteration: '', semitoneFromTonic: 9 });
  });

  it('degree 7 for B', () => {
    const result = degreeForNote(cMajor, 'B');
    expect(result).toEqual({ degree: 7, alteration: '', semitoneFromTonic: 11 });
  });
});

// ---------------------------------------------------------------------------
// degreeForNote — chromatic alterations in C major
// ---------------------------------------------------------------------------

describe('degreeForNote — chromatic notes in C major', () => {
  it('Eb → degree 3, flat (b3)', () => {
    const result = degreeForNote(cMajor, 'Eb');
    expect(result).toEqual({ degree: 3, alteration: 'b', semitoneFromTonic: 3 });
  });

  it('D# → degree 2, sharp (#2)', () => {
    const result = degreeForNote(cMajor, 'D#');
    expect(result).toEqual({ degree: 2, alteration: '#', semitoneFromTonic: 3 });
  });

  it('F# → degree 4, sharp (#4)', () => {
    const result = degreeForNote(cMajor, 'F#');
    expect(result).toEqual({ degree: 4, alteration: '#', semitoneFromTonic: 6 });
  });

  it('Bb → degree 7, flat (b7)', () => {
    const result = degreeForNote(cMajor, 'Bb');
    expect(result).toEqual({ degree: 7, alteration: 'b', semitoneFromTonic: 10 });
  });

  it('Ab → degree 6, flat (b6)', () => {
    const result = degreeForNote(cMajor, 'Ab');
    expect(result).toEqual({ degree: 6, alteration: 'b', semitoneFromTonic: 8 });
  });

  it('Db → degree 2, flat (b2)', () => {
    const result = degreeForNote(cMajor, 'Db');
    expect(result).toEqual({ degree: 2, alteration: 'b', semitoneFromTonic: 1 });
  });

  it('C# → degree 1, sharp (#1)', () => {
    const result = degreeForNote(cMajor, 'C#');
    expect(result).toEqual({ degree: 1, alteration: '#', semitoneFromTonic: 1 });
  });

  // Enharmonic spellings: Eb and D# produce different analyses
  it('Eb and D# are enharmonic but have different degrees', () => {
    const ebResult = degreeForNote(cMajor, 'Eb');
    const dSharpResult = degreeForNote(cMajor, 'D#');
    expect(ebResult?.degree).toBe(3);
    expect(dSharpResult?.degree).toBe(2);
    expect(ebResult?.alteration).toBe('b');
    expect(dSharpResult?.alteration).toBe('#');
  });
});

// ---------------------------------------------------------------------------
// degreeForNote — A natural minor (tonic-do)
// ---------------------------------------------------------------------------

describe('degreeForNote — A natural minor (tonic = degree 1)', () => {
  it('A = degree 1, no alteration', () => {
    const result = degreeForNote(aMinor, 'A');
    expect(result).toEqual({ degree: 1, alteration: '', semitoneFromTonic: 0 });
  });

  it('B = degree 2, no alteration', () => {
    const result = degreeForNote(aMinor, 'B');
    expect(result).toEqual({ degree: 2, alteration: '', semitoneFromTonic: 2 });
  });

  it('C = degree 3, no alteration (natural minor 3rd is diatonic)', () => {
    const result = degreeForNote(aMinor, 'C');
    expect(result).toEqual({ degree: 3, alteration: '', semitoneFromTonic: 3 });
  });

  it('D = degree 4, no alteration', () => {
    const result = degreeForNote(aMinor, 'D');
    expect(result).toEqual({ degree: 4, alteration: '', semitoneFromTonic: 5 });
  });

  it('E = degree 5, no alteration', () => {
    const result = degreeForNote(aMinor, 'E');
    expect(result).toEqual({ degree: 5, alteration: '', semitoneFromTonic: 7 });
  });

  it('F = degree 6, no alteration (natural minor 6th is diatonic)', () => {
    const result = degreeForNote(aMinor, 'F');
    expect(result).toEqual({ degree: 6, alteration: '', semitoneFromTonic: 8 });
  });

  it('G = degree 7, no alteration (natural minor 7th is diatonic)', () => {
    const result = degreeForNote(aMinor, 'G');
    expect(result).toEqual({ degree: 7, alteration: '', semitoneFromTonic: 10 });
  });

  it('raised leading tone G# = degree 7 with sharp alteration (relative to natural-minor G)', () => {
    // In A natural minor, G# is a sharp alteration relative to the diatonic G
    const result = degreeForNote(aMinor, 'G#');
    expect(result).toEqual({ degree: 7, alteration: '#', semitoneFromTonic: 11 });
  });
});

// ---------------------------------------------------------------------------
// degreeForNote — G major
// ---------------------------------------------------------------------------

describe('degreeForNote — G major', () => {
  it('F# = degree 7, no alteration (diatonic in G major)', () => {
    const result = degreeForNote(gMajor, 'F#');
    expect(result).toEqual({ degree: 7, alteration: '', semitoneFromTonic: 11 });
  });

  it('F (natural) = degree 7, flat (b7 in G major)', () => {
    const result = degreeForNote(gMajor, 'F');
    expect(result).toEqual({ degree: 7, alteration: 'b', semitoneFromTonic: 10 });
  });
});

// ---------------------------------------------------------------------------
// degreeForNote — non-heptatonic scale returns null
// ---------------------------------------------------------------------------

describe('degreeForNote — non-heptatonic scale returns null', () => {
  it('returns null for pentatonic scale', () => {
    const pentatonic = Scale.create('C', 'majorPentatonic');
    const result = degreeForNote(pentatonic, 'C');
    expect(result).toBeNull();
  });

  it('returns null for chromatic scale', () => {
    const chromatic = Scale.create('C', 'chromatic');
    const result = degreeForNote(chromatic, 'C');
    expect(result).toBeNull();
  });

  it('returns null for whole tone scale', () => {
    const wholeTone = Scale.create('C', 'wholeTone');
    const result = degreeForNote(wholeTone, 'C');
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// degreeForNote — Scale objects (not Key)
// ---------------------------------------------------------------------------

describe('degreeForNote — accepts Scale directly', () => {
  it('works with a Scale object', () => {
    const scale = Scale.create('C', 'major');
    const result = degreeForNote(scale, 'E');
    expect(result).toEqual({ degree: 3, alteration: '', semitoneFromTonic: 4 });
  });

  it('works with natural minor Scale — C is diatonic degree 3', () => {
    const scale = Scale.create('A', 'naturalMinor');
    const result = degreeForNote(scale, 'C');
    expect(result).toEqual({ degree: 3, alteration: '', semitoneFromTonic: 3 });
  });
});

// ---------------------------------------------------------------------------
// noteForDegree — diatonic degrees
// ---------------------------------------------------------------------------

describe('noteForDegree — diatonic degrees in C major', () => {
  it("'1' → C", () => {
    const note = noteForDegree(cMajor, '1');
    expect(note.note).toBe('C');
  });

  it("'3' → E", () => {
    const note = noteForDegree(cMajor, '3');
    expect(note.note).toBe('E');
  });

  it("'5' → G", () => {
    const note = noteForDegree(cMajor, '5');
    expect(note.note).toBe('G');
  });

  it("'7' → B", () => {
    const note = noteForDegree(cMajor, '7');
    expect(note.note).toBe('B');
  });
});

// ---------------------------------------------------------------------------
// noteForDegree — chromatic tokens
// ---------------------------------------------------------------------------

describe('noteForDegree — chromatic tokens in C major', () => {
  it("'b3' → Eb (not D#)", () => {
    const note = noteForDegree(cMajor, 'b3');
    expect(note.note).toBe('Eb');
  });

  it("'#4' → F#", () => {
    const note = noteForDegree(cMajor, '#4');
    expect(note.note).toBe('F#');
  });

  it("'b7' → Bb", () => {
    const note = noteForDegree(cMajor, 'b7');
    expect(note.note).toBe('Bb');
  });

  it("'b2' → Db", () => {
    const note = noteForDegree(cMajor, 'b2');
    expect(note.note).toBe('Db');
  });

  it("'#1' → C#", () => {
    const note = noteForDegree(cMajor, '#1');
    expect(note.note).toBe('C#');
  });

  it("'b6' → Ab", () => {
    const note = noteForDegree(cMajor, 'b6');
    expect(note.note).toBe('Ab');
  });

  it("'#5' → G#", () => {
    const note = noteForDegree(cMajor, '#5');
    expect(note.note).toBe('G#');
  });
});

// ---------------------------------------------------------------------------
// noteForDegree — round-trip with degreeForNote
// ---------------------------------------------------------------------------

describe('noteForDegree ↔ degreeForNote round-trip', () => {
  const tokens = ['1', '2', '3', '4', '5', '6', '7', 'b2', 'b3', 'b6', 'b7', '#4'];

  for (const token of tokens) {
    it(`round-trips token '${token}' in C major`, () => {
      const note = noteForDegree(cMajor, token);
      const analysis = degreeForNote(cMajor, note);
      expect(analysis).not.toBeNull();
      // Reconstruct the token from the analysis
      const roundTripped = `${analysis!.alteration}${analysis!.degree}`;
      expect(roundTripped).toBe(token);
    });
  }

  it("round-trips 'b3' in A minor", () => {
    const note = noteForDegree(aMinor, 'b3');
    const analysis = degreeForNote(aMinor, note);
    expect(analysis).not.toBeNull();
    expect(analysis!.degree).toBe(3);
    expect(analysis!.alteration).toBe('b');
  });
});

// ---------------------------------------------------------------------------
// noteForDegree — Bb major
// ---------------------------------------------------------------------------

describe('noteForDegree — Bb major', () => {
  it("'7' → A (diatonic leading tone)", () => {
    const note = noteForDegree(bFlatMajor, '7');
    expect(note.note).toBe('A');
  });

  it("'b7' → Ab", () => {
    const note = noteForDegree(bFlatMajor, 'b7');
    expect(note.note).toBe('Ab');
  });
});

// ---------------------------------------------------------------------------
// Double and triple alterations
// ---------------------------------------------------------------------------

describe('noteForDegree — double/triple alterations', () => {
  it("'##5' → G## (double sharp fifth in C major)", () => {
    const note = noteForDegree(cMajor, '##5');
    expect(note.note).toBe('G##');
  });

  it("'bb3' → Ebb (double flat third in C major)", () => {
    const note = noteForDegree(cMajor, 'bb3');
    expect(note.note).toBe('Ebb');
  });

  it("'###4' → F### (triple sharp fourth in C major)", () => {
    const note = noteForDegree(cMajor, '###4');
    expect(note.note).toBe('F###');
  });

  it("'bbb7' → Bbbb (triple flat seventh in C major)", () => {
    const note = noteForDegree(cMajor, 'bbb7');
    expect(note.note).toBe('Bbbb');
  });
});

describe('degreeForNote — double/triple alterations', () => {
  it('G## has alteration ## in C major', () => {
    const result = degreeForNote(cMajor, 'G##');
    expect(result?.alteration).toBe('##');
    expect(result?.degree).toBe(5);
  });

  it('Ebb has alteration bb in C major', () => {
    const result = degreeForNote(cMajor, 'Ebb');
    expect(result?.alteration).toBe('bb');
    expect(result?.degree).toBe(3);
  });

  it('G### has alteration ### in C major', () => {
    // G### = degree 5 with alteration +3 relative to G natural (diatonic)
    const result = degreeForNote(cMajor, 'G###');
    expect(result?.alteration).toBe('###');
    expect(result?.degree).toBe(5);
  });

  it('Ebbb has alteration bbb in C major', () => {
    // Ebbb = degree 3 with alteration -3 relative to E natural (diatonic)
    const result = degreeForNote(cMajor, 'Ebbb');
    expect(result?.alteration).toBe('bbb');
    expect(result?.degree).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Error cases
// ---------------------------------------------------------------------------

describe('error cases', () => {
  it('noteForDegree throws for non-heptatonic scale', () => {
    const scale = Scale.create('C', 'majorPentatonic');
    expect(() => noteForDegree(scale, '1')).toThrow(RangeError);
  });

  it('noteForDegree throws for unrecognized token format', () => {
    expect(() => noteForDegree(cMajor, 'x3')).toThrow(TypeError);
  });

  it('noteForDegree throws for out-of-range degree', () => {
    expect(() => noteForDegree(cMajor, '8')).toThrow(RangeError);
  });

  it('noteForDegree throws for degree 0', () => {
    expect(() => noteForDegree(cMajor, '0')).toThrow(RangeError);
  });

  it('noteForDegree throws for invalid accidental pattern (4 flats)', () => {
    expect(() => noteForDegree(cMajor, 'bbbb5')).toThrow(TypeError);
  });

  it('degreeForNote throws when alteration offset exceeds ±3 (extreme accidentals)', () => {
    // B major has F# at degree 5; Fbbb has offset -3 from natural F, so
    // alteration relative to F# = -3 - 1 = -4, which exceeds ±3.
    const bMajor = Key.create('B', 'major');
    expect(() => degreeForNote(bMajor, 'Fbbb')).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// Property-based tests
// ---------------------------------------------------------------------------

describe('property tests', () => {
  it('degreeForNote returns non-null for all diatonic notes of any major key', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          'C',
          'G',
          'D',
          'A',
          'E',
          'B',
          'F',
          'Bb',
          'Eb',
          'Ab',
          'Db',
          'F#',
        ) as fc.Arbitrary<string>,
        (tonic) => {
          const key = Key.create(tonic as Parameters<typeof Key.create>[0], 'major');
          for (const note of key.scale.notes) {
            const result = degreeForNote(key, note);
            if (result === null) return false;
            if (result.alteration !== '') return false;
          }
          return true;
        },
      ),
      { numRuns: 50 },
    );
  });

  it('noteForDegree tokens 1..7 produce the diatonic scale notes', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('C', 'G', 'D', 'A', 'E', 'F', 'Bb', 'Eb', 'Ab') as fc.Arbitrary<string>,
        (tonic) => {
          const key = Key.create(tonic as Parameters<typeof Key.create>[0], 'major');
          for (let d = 1; d <= 7; d++) {
            const note = noteForDegree(key, String(d));
            const scaleNote = key.scale.notes[d - 1];
            if (!scaleNote) return false;
            if (note.note !== scaleNote.note) return false;
          }
          return true;
        },
      ),
      { numRuns: 50 },
    );
  });
});
