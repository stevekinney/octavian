import { describe, expect, it } from 'bun:test';
import * as fc from 'fast-check';

import { Note } from './note.js';
import {
  Melody,
  compareMelodicContour,
  findMotifOccurrences,
  type ContourComparison,
  type MelodicDirection,
  type MotifOccurrence,
  type SerializedMelody,
} from './melody.js';

function mel(...noteNames: string[]): Melody {
  return Melody.create(noteNames.map((n) => Note.create(n as any)));
}

// ---------------------------------------------------------------------------
// Melody.create
// ---------------------------------------------------------------------------

describe('Melody.create', () => {
  it('normalizes an array of NoteLike values', () => {
    const m = Melody.create(['C4', 'D4', 'E4']);
    expect(m.length).toBe(3);
    expect(m.notes[0]!.toString()).toBe('C4');
    expect(m.notes[2]!.toString()).toBe('E4');
  });

  it('accepts Note instances, serialized objects, and empty arrays', () => {
    expect(Melody.create([Note.create('C4'), Note.create('G4')]).length).toBe(2);
    expect(Melody.create([{ note: 'C', octave: 4 }]).length).toBe(1);
    expect(Melody.create([]).isEmpty()).toBe(true);
  });

  it('throws TypeError for unsupported note-like values', () => {
    expect(() => Melody.create(['NOTAVALID' as any])).toThrow(TypeError);
  });
});

// ---------------------------------------------------------------------------
// Melody.fromJSON / toJSON
// ---------------------------------------------------------------------------

describe('Melody.fromJSON / toJSON', () => {
  it('round-trips through toJSON/fromJSON', () => {
    const original = mel('C4', 'E4', 'G4');
    const serialized: SerializedMelody = original.toJSON();
    expect(Melody.fromJSON(serialized).toString()).toBe(original.toString());
    expect(serialized.notes[0]!.note).toBe('C');
    expect(serialized.notes[0]!.octave).toBe(4);
  });

  it('throws TypeError for malformed input', () => {
    expect(() => Melody.fromJSON(null)).toThrow(TypeError);
    expect(() => Melody.fromJSON({ notNotes: [] })).toThrow(TypeError);
    expect(() => Melody.fromJSON({ notes: 'bad' })).toThrow(TypeError);
    expect(() => Melody.fromJSON({ notes: [{ note: 'C', octave: 4 }, 'bad'] })).toThrow(TypeError);
  });
});

// ---------------------------------------------------------------------------
// Melody#intervals
// ---------------------------------------------------------------------------

describe('Melody#intervals', () => {
  it('returns N-1 intervals for N notes and empty for ≤1 note', () => {
    expect(mel('C4', 'E4', 'G4').intervals()).toHaveLength(2);
    expect(mel('C4').intervals()).toHaveLength(0);
    expect(Melody.create([]).intervals()).toHaveLength(0);
  });

  it('identifies common intervals correctly', () => {
    expect(mel('C4', 'E4').intervals()[0]).toBe('majorThird');
    expect(mel('C4', 'G4').intervals()[0]).toBe('perfectFifth');
    expect(mel('C4', 'C5').intervals()[0]).toBe('perfectOctave');
    expect(mel('C4', 'D5').intervals()[0]).toBe('majorNinth');
  });

  it('returns absolute interval (downward E→C is still majorThird)', () => {
    expect(mel('E4', 'C4').intervals()[0]).toBe('majorThird');
  });

  it('returns perfectUnison for repeated note', () => {
    expect(mel('C4', 'C4').intervals()[0]).toBe('perfectUnison');
  });

  it('handles enharmonic spellings: C#4→D4 is minorSecond', () => {
    expect(mel('C#4', 'D4').intervals()[0]).toBe('minorSecond');
  });
});

// ---------------------------------------------------------------------------
// Melody#semitoneContour
// ---------------------------------------------------------------------------

describe('Melody#semitoneContour', () => {
  it('returns signed steps', () => {
    expect(mel('C4', 'E4', 'G4').semitoneContour()).toEqual([4, 3]);
    expect(mel('G4', 'E4', 'C4').semitoneContour()).toEqual([-3, -4]);
    expect(mel('C4', 'C4').semitoneContour()).toEqual([0]);
  });

  it('returns empty for single and empty melody', () => {
    expect(mel('C4').semitoneContour()).toEqual([]);
    expect(Melody.create([]).semitoneContour()).toEqual([]);
  });

  it('handles octave crossings', () => {
    expect(mel('B4', 'C5').semitoneContour()).toEqual([1]);
    expect(mel('C5', 'C4').semitoneContour()).toEqual([-12]);
    expect(mel('C4', 'C6').semitoneContour()).toEqual([24]);
  });
});

// ---------------------------------------------------------------------------
// Melody#directionContour
// ---------------------------------------------------------------------------

describe('Melody#directionContour', () => {
  it('returns up/down/same for each step', () => {
    const contour: readonly MelodicDirection[] = mel('C4', 'E4', 'E4', 'D4').directionContour();
    expect(contour).toEqual(['up', 'same', 'down']);
  });

  it('returns empty for single and empty melody', () => {
    expect(mel('C4').directionContour()).toEqual([]);
    expect(Melody.create([]).directionContour()).toEqual([]);
  });

  it('all up/down for strictly ascending/descending', () => {
    expect(mel('C4', 'D4', 'E4').directionContour()).toEqual(['up', 'up']);
    expect(mel('E4', 'D4', 'C4').directionContour()).toEqual(['down', 'down']);
  });
});

// ---------------------------------------------------------------------------
// Melody#transpose
// ---------------------------------------------------------------------------

describe('Melody#transpose', () => {
  it('transposes by named interval', () => {
    const t = mel('C4', 'E4', 'G4').transpose('perfectFifth');
    expect(t.notes[0]!.toString()).toBe('G4');
    expect(t.notes[2]!.toString()).toBe('D5');
  });

  it('transposes by semitone count', () => {
    const t = mel('C4', 'D4').transpose(2);
    expect(t.notes[0]!.toString()).toBe('D4');
    expect(t.notes[1]!.toString()).toBe('E4');
  });

  it('preserves semitone contour and returns new instance', () => {
    const m = mel('C4', 'E4', 'G4');
    const t = m.transpose('majorSecond');
    expect(t.semitoneContour()).toEqual(m.semitoneContour());
    expect(t).not.toBe(m);
  });
});

// ---------------------------------------------------------------------------
// Melody#invert
// ---------------------------------------------------------------------------

describe('Melody#invert', () => {
  it('inverts [C4, D4, E4] around C4: axis stays, others reflect down', () => {
    const inv = mel('C4', 'D4', 'E4').invert('C4');
    const c4Midi = Number(Note.create('C4').midi);
    expect(inv.notes[0]!.toString()).toBe('C4');
    expect(Number(inv.notes[1]!.midi)).toBe(c4Midi - 2); // Bb3
    expect(Number(inv.notes[2]!.midi)).toBe(c4Midi - 4); // Ab3
  });

  it('note at axis stays after inversion', () => {
    const inv = mel('C4', 'E4', 'G4').invert('E4');
    expect(inv.notes[1]!.midi).toBe(Note.create('E4').midi);
  });

  it('ascending contour inverts to descending', () => {
    expect(mel('C4', 'D4', 'E4').invert('C4').directionContour()).toEqual(['down', 'down']);
  });

  it('double inversion returns original MIDI values', () => {
    const m = mel('C4', 'E4', 'G4');
    const inv2 = m.invert('C4').invert('C4');
    for (let i = 0; i < m.length; i++) {
      expect(inv2.notes[i]!.midi).toBe(m.notes[i]!.midi);
    }
  });

  it('accepts Note or string axis, enharmonic axes produce same result', () => {
    const m = mel('C4', 'E4');
    const inv1 = m.invert('C#4');
    const inv2 = m.invert('Db4');
    expect(inv1.notes[0]!.midi).toBe(inv2.notes[0]!.midi);
    expect(inv1.notes[1]!.midi).toBe(inv2.notes[1]!.midi);
  });
});

// ---------------------------------------------------------------------------
// Melody#retrograde
// ---------------------------------------------------------------------------

describe('Melody#retrograde', () => {
  it('reverses [C4, D4, E4] to [E4, D4, C4]', () => {
    const r = mel('C4', 'D4', 'E4').retrograde();
    expect(r.notes[0]!.toString()).toBe('E4');
    expect(r.notes[2]!.toString()).toBe('C4');
  });

  it('double retrograde returns original order', () => {
    const m = mel('C4', 'E4', 'G4');
    const rr = m.retrograde().retrograde();
    for (let i = 0; i < m.length; i++) {
      expect(rr.notes[i]!.midi).toBe(m.notes[i]!.midi);
    }
  });

  it('retrograde of single and empty melody', () => {
    expect(mel('C4').retrograde().notes[0]!.toString()).toBe('C4');
    expect(Melody.create([]).retrograde().isEmpty()).toBe(true);
  });

  it('retrograde of ascending melody is descending', () => {
    expect(mel('C4', 'D4', 'E4', 'F4').retrograde().directionContour()).toEqual([
      'down',
      'down',
      'down',
    ]);
  });
});

// ---------------------------------------------------------------------------
// Melody accessors
// ---------------------------------------------------------------------------

describe('Melody accessors', () => {
  it('toString and iterator', () => {
    const m = mel('C4', 'E4', 'G4');
    expect(m.toString()).toBe('C4 E4 G4');
    expect(Melody.create([]).toString()).toBe('');
    const collected: Note[] = [];
    for (const n of m) collected.push(n);
    expect(collected).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// compareMelodicContour
// ---------------------------------------------------------------------------

describe('compareMelodicContour', () => {
  it('[C4,E4,G4] and [G4,B4,D5] are equivalent (transposition-invariant)', () => {
    const result: ContourComparison = compareMelodicContour(
      mel('C4', 'E4', 'G4'),
      mel('G4', 'B4', 'D5'),
    );
    expect(result.isEquivalent).toBe(true);
    expect(result.contourA).toEqual([4, 3]);
    expect(result.contourB).toEqual([4, 3]);
  });

  it('different shapes, different lengths, and empty melodies', () => {
    expect(compareMelodicContour(mel('C4', 'E4', 'G4'), mel('C4', 'D4', 'E4')).isEquivalent).toBe(
      false,
    );
    expect(compareMelodicContour(mel('C4', 'D4', 'E4'), mel('C4', 'D4')).isEquivalent).toBe(false);
    expect(compareMelodicContour(Melody.create([]), Melody.create([])).isEquivalent).toBe(true);
    expect(compareMelodicContour(mel('G4', 'E4', 'C4'), mel('D5', 'B4', 'G4')).isEquivalent).toBe(
      true,
    );
  });

  it('contourOnly=true: same direction matches, opposite direction does not', () => {
    // C4-E4-G4: up,up vs C4-D4-E4: up,up — same direction, different size
    expect(
      compareMelodicContour(mel('C4', 'E4', 'G4'), mel('C4', 'D4', 'E4'), { contourOnly: true })
        .isEquivalent,
    ).toBe(true);
    expect(
      compareMelodicContour(mel('C4', 'E4'), mel('E4', 'C4'), { contourOnly: true }).isEquivalent,
    ).toBe(false);
    expect(
      compareMelodicContour(mel('C4', 'E4'), mel('G4', 'B4'), { contourOnly: false }).isEquivalent,
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// findMotifOccurrences
// ---------------------------------------------------------------------------

describe('findMotifOccurrences', () => {
  it('finds exact match at start, middle, and end', () => {
    const motif = mel('C4', 'D4', 'E4'); // contour [+2, +2]
    expect(findMotifOccurrences(mel('C4', 'D4', 'E4', 'F4'), motif)[0]?.startIndex).toBe(0);
    expect(findMotifOccurrences(mel('A4', 'C4', 'D4', 'E4', 'F4'), motif)[0]?.startIndex).toBe(1);
    expect(
      findMotifOccurrences(mel('A4', 'B4', 'C5', 'D5', 'E5'), mel('C5', 'D5', 'E5'))[0]?.startIndex,
    ).toBe(2);
  });

  it('finds overlapping occurrences (F4-G4-A4 also has contour [+2,+2])', () => {
    const motif = mel('C4', 'D4', 'E4'); // [+2,+2]
    const melody = mel('C4', 'D4', 'E4', 'F4', 'G4', 'A4');
    const results = findMotifOccurrences(melody, motif);
    const starts = results.map((r) => r.startIndex);
    expect(starts).toContain(0);
    expect(starts).toContain(3); // F4(+2)G4(+2)A4
  });

  it('returns empty when motif is too long, has 1 note, or is empty', () => {
    expect(findMotifOccurrences(mel('C4', 'D4'), mel('C4', 'D4', 'E4'))).toHaveLength(0);
    expect(findMotifOccurrences(mel('C4', 'D4', 'E4'), mel('C4'))).toHaveLength(0);
    expect(findMotifOccurrences(mel('C4', 'D4', 'E4'), Melody.create([]))).toHaveLength(0);
  });

  it('matchType contour: finds direction-only matches', () => {
    const motif = mel('C4', 'E4'); // [+4] — direction: up
    const results = findMotifOccurrences(mel('C4', 'C#4', 'C5', 'E5'), motif, {
      matchType: 'contour',
    });
    expect(results.some((r) => r.startIndex === 0)).toBe(true); // C4→C#4 is up but +1
    expect(results.every((r) => r.matchType === 'contour')).toBe(true);
  });

  it('matchType both: exact tagged exact, direction-only tagged contour, no double-reporting', () => {
    const motif = mel('C4', 'E4'); // [+4]
    const melody = mel('C4', 'E4', 'G4', 'B4', 'C5', 'D5');
    const results: readonly MotifOccurrence[] = findMotifOccurrences(melody, motif, {
      matchType: 'both',
    });
    const exact = results.filter((r) => r.matchType === 'exact');
    const contour = results.filter((r) => r.matchType === 'contour');
    expect(exact.some((r) => r.startIndex === 0)).toBe(true); // C4-E4 exact
    expect(exact.some((r) => r.startIndex === 2)).toBe(true); // G4-B4 exact
    expect(contour.some((r) => r.startIndex === 4)).toBe(true); // C5-D5 up but +2
    const exactStarts = new Set(exact.map((r) => r.startIndex));
    for (const c of contour) expect(exactStarts.has(c.startIndex)).toBe(false);
  });

  it('finds transposed exact motif', () => {
    const motif = mel('C4', 'E4', 'G4'); // [+4, +3]
    const results = findMotifOccurrences(mel('F4', 'G4', 'B4', 'D5'), motif);
    expect(results).toHaveLength(1);
    expect(results[0]!.startIndex).toBe(1); // G4-B4-D5 is [+4,+3]
  });
});

// ---------------------------------------------------------------------------
// Edge cases: enharmonics, repeated notes, octave crossings
// ---------------------------------------------------------------------------

describe('enharmonic and edge cases', () => {
  it('C#4 and Db4 produce same semitone contour', () => {
    expect(mel('C4', 'C#4').semitoneContour()).toEqual(mel('C4', 'Db4').semitoneContour());
    expect(compareMelodicContour(mel('C4', 'C#4'), mel('C4', 'Db4')).isEquivalent).toBe(true);
  });

  it('repeated note has direction same', () => {
    expect(mel('C4', 'C4', 'C4').directionContour()).toEqual(['same', 'same']);
  });

  it('B4→C5 is a minor second up (octave boundary)', () => {
    expect(mel('B4', 'C5').semitoneContour()).toEqual([1]);
    expect(mel('B4', 'C5').directionContour()).toEqual(['up']);
  });
});

// ---------------------------------------------------------------------------
// Property-based tests
// ---------------------------------------------------------------------------

describe('Melody property tests', () => {
  it('semitoneContour length is always (notes.length - 1)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 21, max: 108 }), { minLength: 0, maxLength: 10 }),
        (midis) => {
          const m = Melody.create(midis.map((midi) => Note.fromMidi(midi)));
          expect(m.semitoneContour()).toHaveLength(Math.max(0, midis.length - 1));
          expect(m.directionContour()).toHaveLength(m.semitoneContour().length);
        },
      ),
      { numRuns: 50 },
    );
  });

  it('transpose preserves semitone contour', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 40, max: 80 }), { minLength: 2, maxLength: 8 }),
        fc.integer({ min: -12, max: 12 }),
        (midis, semitones) => {
          if (!midis.every((midi) => midi + semitones >= 0 && midi + semitones <= 127)) return;
          const m = Melody.create(midis.map((midi) => Note.fromMidi(midi)));
          expect(m.transpose(semitones).semitoneContour()).toEqual(m.semitoneContour());
        },
      ),
      { numRuns: 50 },
    );
  });

  it('retrograde double application is identity', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 21, max: 108 }), { minLength: 1, maxLength: 8 }),
        (midis) => {
          const m = Melody.create(midis.map((midi) => Note.fromMidi(midi)));
          const rr = m.retrograde().retrograde();
          for (let i = 0; i < m.length; i++) expect(rr.notes[i]!.midi).toBe(m.notes[i]!.midi);
        },
      ),
      { numRuns: 50 },
    );
  });

  it('invert double application is identity', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 40, max: 80 }), { minLength: 1, maxLength: 8 }),
        fc.integer({ min: 40, max: 80 }),
        (midis, axisMidi) => {
          // Restrict range so that inversions stay within MIDI 0..127.
          // Delta from axis is at most 40, so inverted midi is axisMidi ± 40, always in range.
          const m = Melody.create(midis.map((midi) => Note.fromMidi(midi)));
          const axis = Note.fromMidi(axisMidi);
          const inv2 = m.invert(axis).invert(axis);
          for (let i = 0; i < m.length; i++) expect(inv2.notes[i]!.midi).toBe(m.notes[i]!.midi);
        },
      ),
      { numRuns: 50 },
    );
  });

  it('compareMelodicContour is reflexive and transposition-invariant', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 40, max: 70 }), { minLength: 1, maxLength: 6 }),
        fc.integer({ min: 1, max: 12 }),
        (midis, shift) => {
          if (!midis.every((midi) => midi + shift <= 127)) return;
          const m = Melody.create(midis.map((midi) => Note.fromMidi(midi)));
          expect(compareMelodicContour(m, m).isEquivalent).toBe(true);
          expect(compareMelodicContour(m, m.transpose(shift)).isEquivalent).toBe(true);
        },
      ),
      { numRuns: 50 },
    );
  });
});
