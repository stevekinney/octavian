import { describe, expect, it } from 'bun:test';
import * as fc from 'fast-check';

import { Note } from './note.js';
import { Chord } from './chord.js';
import { Scale } from './scale.js';
import { Key } from './key.js';
import { RomanNumeral } from './roman-numeral.js';
import {
  compareNotes,
  compareIntervals,
  compareScaleDegrees,
  compareRomanNumerals,
  compareMusicAnswer,
} from './answer-comparison.js';
import { compareChords } from './answer-comparison-chord.js';
import type {
  NoteComparison,
  IntervalComparison,
  ScaleDegreeComparison,
  RomanNumeralComparison,
} from './answer-comparison.js';
import type { ChordComparison } from './answer-comparison-chord.js';

// ---------------------------------------------------------------------------
// compareNotes
// ---------------------------------------------------------------------------

describe('compareNotes', () => {
  it('returns correct=true and enharmonicMatch=true for exact same note', () => {
    const result: NoteComparison = compareNotes(Note.create('C4'), Note.create('C4'));
    expect(result.correct).toBe(true);
    expect(result.equivalent).toBe(true);
    expect(result.enharmonicMatch).toBe(true);
    expect(result.pitchClassMatch).toBe(true);
    expect(result.registerDiffers).toBe(false);
    expect(result.semitoneDifference).toBe(0);
    expect(result.relationship).toBe('exact');
  });

  it('C#4 vs Db4 → enharmonicMatch true, correct false, pitchClassMatch true', () => {
    const result = compareNotes(Note.create('C#4'), Note.create('Db4'));
    expect(result.correct).toBe(false);
    expect(result.enharmonicMatch).toBe(true);
    expect(result.pitchClassMatch).toBe(true);
    expect(result.equivalent).toBe(true);
    expect(result.relationship).toBe('enharmonic-equivalent');
    expect(result.semitoneDifference).toBe(0);
  });

  it('C4 vs C5 → pitchClassMatch true, registerDiffers true, enharmonicMatch false', () => {
    const result = compareNotes(Note.create('C4'), Note.create('C5'));
    expect(result.correct).toBe(false);
    expect(result.enharmonicMatch).toBe(false);
    expect(result.pitchClassMatch).toBe(true);
    expect(result.registerDiffers).toBe(true);
    expect(result.relationship).toBe('pitch-class-equal');
    expect(result.semitoneDifference).toBe(12);
  });

  it('C4 vs D4 → completely different notes', () => {
    const result = compareNotes(Note.create('C4'), Note.create('D4'));
    expect(result.correct).toBe(false);
    expect(result.enharmonicMatch).toBe(false);
    expect(result.pitchClassMatch).toBe(false);
    expect(result.relationship).toBe('different');
  });

  it('accepts NoteLike strings', () => {
    const result = compareNotes('C4', 'C4');
    expect(result.correct).toBe(true);
  });

  it('property: exact notes always report correct', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('C', 'D', 'E', 'F', 'G', 'A', 'B'),
        fc.integer({ min: 2, max: 6 }),
        (noteName, octave) => {
          const n = Note.create({ note: noteName as 'C', octave });
          const result = compareNotes(n, n);
          return result.correct && result.equivalent && result.relationship === 'exact';
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ---------------------------------------------------------------------------
// compareIntervals
// ---------------------------------------------------------------------------

describe('compareIntervals', () => {
  it('perfectFifth vs perfectFifth → correct=true', () => {
    const result: IntervalComparison = compareIntervals('perfectFifth', 'perfectFifth');
    expect(result.correct).toBe(true);
    expect(result.equivalent).toBe(true);
    expect(result.relationship).toBe('exact');
    expect(result.semitoneDifference).toBe(0);
    expect(result.degreeDifference).toBe(0);
  });

  it('majorThird vs minorThird → near-miss, semitoneDifference 1', () => {
    const result = compareIntervals('majorThird', 'minorThird');
    expect(result.correct).toBe(false);
    expect(result.semitoneDifference).toBe(1);
    expect(result.relationship).toBe('near-miss');
    expect(result.qualityMatch).toBe(false);
  });

  it('augmentedFourth vs diminishedFifth → enharmonic-equivalent (both 6 semitones)', () => {
    const result = compareIntervals('augmentedFourth', 'diminishedFifth');
    expect(result.correct).toBe(false);
    expect(result.equivalent).toBe(true);
    expect(result.semitoneDifference).toBe(0);
    expect(result.relationship).toBe('enharmonic-equivalent');
  });

  it('perfectFourth vs perfectFifth → inversion match', () => {
    // P4 (5 semitones, degree 4) + P5 (7 semitones, degree 5) = 12 semitones, degree 9
    const result = compareIntervals('perfectFourth', 'perfectFifth');
    expect(result.inversionMatch).toBe(true);
    expect(result.relationship).toBe('inversion-differs');
  });

  it('majorSecond vs majorSeventh → same quality, large difference → different', () => {
    const result = compareIntervals('majorSecond', 'majorSeventh');
    expect(result.qualityMatch).toBe(true);
    expect(result.semitoneDifference).toBe(9);
    // Both major quality, large semitone diff → falls into qualityMatch branch → 'different'
    expect(result.relationship).toBe('different');
  });

  it('minorThird vs majorSixth → quality differs, large semitone distance → quality-differs', () => {
    // minorThird: 3 semitones, minor quality, degree 3
    // majorSixth: 9 semitones, major quality, degree 6
    // Not near-miss (diff 6), check inversion: 3+9=12 but 3+6=9 → IS an inversion → inversion-differs
    // So use a non-inversion pair: minorThird vs majorSeventh
    // minorThird: 3 sem, degree 3; majorSeventh: 11 sem, degree 7 → 3+11≠12 → not inversion
    const result = compareIntervals('minorThird', 'majorSeventh');
    expect(result.qualityMatch).toBe(false);
    expect(Math.abs(result.semitoneDifference)).toBeGreaterThan(2);
    // Not inversion: 3+11=14≠12
    expect(result.inversionMatch).toBe(false);
    expect(result.relationship).toBe('quality-differs');
  });

  it('property: same interval is always correct', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          'perfectUnison' as const,
          'minorSecond' as const,
          'majorThird' as const,
          'perfectFifth' as const,
          'minorSeventh' as const,
        ),
        (interval) => {
          const result = compareIntervals(interval, interval);
          return result.correct && result.semitoneDifference === 0;
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ---------------------------------------------------------------------------
// compareChords
// ---------------------------------------------------------------------------

describe('compareChords', () => {
  it('same chord → correct=true', () => {
    const result: ChordComparison = compareChords(
      Chord.create('C', 'major'),
      Chord.create('C', 'major'),
    );
    expect(result.correct).toBe(true);
    expect(result.equivalent).toBe(true);
    expect(result.relationship).toBe('exact');
    expect(result.missingChordTones).toHaveLength(0);
    expect(result.extraChordTones).toHaveLength(0);
  });

  it('Cmaj7 vs C6 → missing/extra chord-tone diffs', () => {
    // Cmaj7: C E G B  (maj7 adds B instead of A)
    // C6:    C E G A
    const cmaj7 = Chord.create('C', 'majorSeventh');
    const c6 = Chord.create('C', 'majorSixth');
    const result = compareChords(cmaj7, c6);
    expect(result.correct).toBe(false);
    expect(result.suffixMatch).toBe(false);
    expect(result.rootMatch).toBe(true);
    // B is missing from c6; A is extra
    expect(result.missingChordTones).toHaveLength(1);
    expect(result.extraChordTones).toHaveLength(1);
  });

  it('C/E (first inversion) vs C (root position) → inversionMatch false, same pitch content', () => {
    const cMajRoot = Chord.create('C', 'major');
    const cMajFirstInv = cMajRoot.invert(1);
    const result = compareChords(cMajRoot, cMajFirstInv);
    expect(result.correct).toBe(false);
    expect(result.equivalent).toBe(true);
    expect(result.inversionMatch).toBe(false);
    expect(result.relationship).toBe('inversion-differs');
    expect(result.missingChordTones).toHaveLength(0);
    expect(result.extraChordTones).toHaveLength(0);
  });

  it('Cmaj vs Cmin → quality differs', () => {
    const result = compareChords(Chord.create('C', 'major'), Chord.create('C', 'minor'));
    expect(result.correct).toBe(false);
    expect(result.suffixMatch).toBe(false);
    expect(result.rootMatch).toBe(true);
    expect(result.relationship).toBe('quality-differs');
  });

  it('enharmonic roots: C# major vs Db major → equivalent pitch content', () => {
    const cSharp = Chord.create('C#', 'major');
    const dFlat = Chord.create('Db', 'major');
    const result = compareChords(cSharp, dFlat);
    // Same pitch classes, same inversion, different root spelling
    expect(result.equivalent).toBe(true);
    expect(result.relationship).toBe('enharmonic-equivalent');
  });

  it('Cmaj vs Dmin → completely different → different relationship', () => {
    const result = compareChords(Chord.create('C', 'major'), Chord.create('D', 'minor'));
    expect(result.correct).toBe(false);
    expect(result.equivalent).toBe(false);
    expect(result.rootMatch).toBe(false);
    expect(result.relationship).toBe('different');
  });

  it('property: a chord compared to itself is always correct', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('C', 'D', 'E', 'F', 'G', 'A', 'B'),
        fc.constantFrom('major' as const, 'minor' as const, 'dominantSeventh' as const),
        (root, suffix) => {
          const chord = Chord.create(root, suffix);
          const result = compareChords(chord, chord);
          return result.correct && result.equivalent;
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ---------------------------------------------------------------------------
// compareScaleDegrees
// ---------------------------------------------------------------------------

describe('compareScaleDegrees', () => {
  const cMajorScale = Scale.create('C4', 'major');

  it('same note → correct=true', () => {
    const result: ScaleDegreeComparison = compareScaleDegrees(
      cMajorScale,
      Note.create('E4'),
      Note.create('E4'),
    );
    expect(result.correct).toBe(true);
    expect(result.relationship).toBe('exact');
  });

  it('b3 vs 3 in C major → degree same, alteration differs', () => {
    // b3 in C major = Eb (degree 3 with flat alteration)
    // 3 in C major = E (diatonic degree 3, no alteration)
    const eb = Note.create('Eb4');
    const e = Note.create('E4');
    const result = compareScaleDegrees(cMajorScale, eb, e);
    expect(result.correct).toBe(false);
    expect(result.degreeDifference).toBe(0);
    expect(result.alterationDiffers).toBe(true);
    expect(result.relationship).toBe('alteration-differs');
    expect(result.targetLabel).toBe('b3');
    expect(result.answerLabel).toBe('3');
  });

  it('3 vs b3 in C major → alteration differs (flipped direction)', () => {
    const e = Note.create('E4');
    const eb = Note.create('Eb4');
    const result = compareScaleDegrees(cMajorScale, e, eb);
    expect(result.alterationDiffers).toBe(true);
    expect(result.degreeDifference).toBe(0);
  });

  it('#4 vs 4 in C major → alteration differs, near semitone distance', () => {
    // #4 = F# (augmented fourth)
    const fSharp = Note.create('F#4');
    const f = Note.create('F4');
    const result = compareScaleDegrees(cMajorScale, fSharp, f);
    expect(result.alterationDiffers).toBe(true);
    expect(result.degreeDifference).toBe(0);
  });

  it('1 vs 5 → different degrees', () => {
    const c = Note.create('C4');
    const g = Note.create('G4');
    const result = compareScaleDegrees(cMajorScale, c, g);
    expect(result.correct).toBe(false);
    expect(result.degreeDifference).toBe(4);
  });

  it('enharmonic spellings: D# vs Eb in C major → enharmonic-equivalent (same semitone from tonic)', () => {
    // D# = degree 2, alteration #, semitoneFromTonic 3
    // Eb = degree 3, alteration b, semitoneFromTonic 3
    // Different degree, same semitoneFromTonic → enharmonic-equivalent
    const dSharp = Note.create('D#4');
    const eb = Note.create('Eb4');
    const result = compareScaleDegrees(cMajorScale, dSharp, eb);
    expect(result.correct).toBe(false);
    expect(result.equivalent).toBe(true);
    expect(result.relationship).toBe('enharmonic-equivalent');
    expect(result.degreeDifference).toBe(1); // Eb (degree 3) - D# (degree 2)
  });

  it('adjacent diatonic degrees: 2 vs 3 in C major → near-miss', () => {
    // D = degree 2, no alteration, semitoneFromTonic 2
    // E = degree 3, no alteration, semitoneFromTonic 4
    // degreeDifference = 1, alterationDiffers = false → near-miss
    const d = Note.create('D4');
    const e = Note.create('E4');
    const result = compareScaleDegrees(cMajorScale, d, e);
    expect(result.correct).toBe(false);
    expect(result.equivalent).toBe(false);
    expect(result.alterationDiffers).toBe(false);
    expect(result.degreeDifference).toBe(1);
    expect(result.relationship).toBe('near-miss');
  });

  it('works with Key context', () => {
    const cKey = Key.create('C4', 'major');
    const e = Note.create('E4');
    const eb = Note.create('Eb4');
    const result = compareScaleDegrees(cKey, eb, e);
    expect(result.alterationDiffers).toBe(true);
  });

  it('throws for non-heptatonic scale', () => {
    const pentatonic = Scale.create('C4', 'majorPentatonic');
    expect(() => compareScaleDegrees(pentatonic, Note.create('C4'), Note.create('D4'))).toThrow(
      RangeError,
    );
  });

  it('property: same note always yields correct comparison', () => {
    const notes = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4'] as const;
    fc.assert(
      fc.property(fc.constantFrom(...notes), (noteStr) => {
        const n = Note.create(noteStr);
        const result = compareScaleDegrees(cMajorScale, n, n);
        return result.correct && result.relationship === 'exact';
      }),
      { numRuns: 50 },
    );
  });
});

// ---------------------------------------------------------------------------
// compareRomanNumerals
// ---------------------------------------------------------------------------

describe('compareRomanNumerals', () => {
  it('same numeral → correct=true', () => {
    const result: RomanNumeralComparison = compareRomanNumerals(
      RomanNumeral.parse('I'),
      RomanNumeral.parse('I'),
    );
    expect(result.correct).toBe(true);
    expect(result.relationship).toBe('exact');
  });

  it('I vs i → quality differs', () => {
    const result = compareRomanNumerals(RomanNumeral.parse('I'), RomanNumeral.parse('i'));
    expect(result.correct).toBe(false);
    expect(result.qualityMatch).toBe(false);
    expect(result.relationship).toBe('quality-differs');
  });

  it('I vs I6 → same degree+quality, inversion differs', () => {
    const result = compareRomanNumerals(RomanNumeral.parse('I'), RomanNumeral.parse('I6'));
    expect(result.correct).toBe(false);
    expect(result.equivalent).toBe(true);
    expect(result.inversionMatch).toBe(false);
    expect(result.relationship).toBe('inversion-differs');
  });

  it('I vs II → degree differs by 1, near-miss', () => {
    const result = compareRomanNumerals(RomanNumeral.parse('I'), RomanNumeral.parse('II'));
    expect(result.degreeDifference).toBe(1);
    expect(result.relationship).toBe('near-miss');
  });

  it('I vs V → degree differs by 4, different', () => {
    const result = compareRomanNumerals(RomanNumeral.parse('I'), RomanNumeral.parse('V'));
    expect(result.degreeDifference).toBe(4);
    expect(result.relationship).toBe('different');
  });

  it('property: same Roman numeral is always correct', () => {
    fc.assert(
      fc.property(fc.constantFrom('I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii'), (sym) => {
        const rn = RomanNumeral.parse(sym);
        const result = compareRomanNumerals(rn, rn);
        return result.correct;
      }),
      { numRuns: 50 },
    );
  });
});

// ---------------------------------------------------------------------------
// compareMusicAnswer dispatcher
// ---------------------------------------------------------------------------

describe('compareMusicAnswer', () => {
  it('dispatches Note comparison', () => {
    const result = compareMusicAnswer(Note.create('C4'), Note.create('C4'));
    expect(result.correct).toBe(true);
  });

  it('dispatches Chord comparison', () => {
    const result = compareMusicAnswer(Chord.create('C', 'major'), Chord.create('C', 'major'));
    expect(result.correct).toBe(true);
  });

  it('dispatches Interval comparison (strings)', () => {
    const result = compareMusicAnswer('perfectFifth', 'perfectFifth');
    expect(result.correct).toBe(true);
  });

  it('dispatches ScaleDegreeAnalysis comparison', () => {
    // Construct analyses directly
    const target = { degree: 3 as const, alteration: 'b' as const, semitoneFromTonic: 3 as const };
    const answer = { degree: 3 as const, alteration: '' as const, semitoneFromTonic: 4 as const };
    const result = compareMusicAnswer(target, answer);
    expect(result.correct).toBe(false);
  });

  it('dispatches RomanNumeral comparison', () => {
    const result = compareMusicAnswer(RomanNumeral.parse('V'), RomanNumeral.parse('V'));
    expect(result.correct).toBe(true);
  });

  it('throws TypeError for unsupported target type', () => {
    expect(() =>
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
      compareMusicAnswer(42 as any, 42 as any),
    ).toThrow(TypeError);
  });

  it('throws TypeError when target is RomanNumeral but answer is not', () => {
    expect(() =>
      compareMusicAnswer(
        RomanNumeral.parse('I'),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
        Note.create('C4') as any,
      ),
    ).toThrow(TypeError);
  });

  it('throws TypeError when target is Chord but answer is not', () => {
    expect(() =>
      compareMusicAnswer(
        Chord.create('C', 'major'),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
        Note.create('C4') as any,
      ),
    ).toThrow(TypeError);
  });

  it('throws TypeError when target is Note but answer is not', () => {
    expect(() =>
      compareMusicAnswer(
        Note.create('C4'),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
        Chord.create('C', 'major') as any,
      ),
    ).toThrow(TypeError);
  });

  it('throws TypeError when target is ScaleDegreeAnalysis but answer is not', () => {
    const target = { degree: 3 as const, alteration: '' as const, semitoneFromTonic: 4 as const };
    expect(() =>
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
      compareMusicAnswer(target, Note.create('C4') as any),
    ).toThrow(TypeError);
  });

  it('error message includes RomanNumeral string when answer is RomanNumeral in wrong context', () => {
    // Exercises describeValue branch: value instanceof RomanNumeral
    expect(() =>
      compareMusicAnswer(
        Note.create('C4'),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
        RomanNumeral.parse('V') as any,
      ),
    ).toThrow(TypeError);
  });

  it('error message uses JSON.stringify when answer is a plain ScaleDegreeAnalysis in wrong context', () => {
    // Exercises describeValue branch: JSON.stringify path
    const analysis = { degree: 3 as const, alteration: '' as const, semitoneFromTonic: 4 as const };
    expect(() =>
      compareMusicAnswer(
        Note.create('C4'),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
        analysis as any,
      ),
    ).toThrow(TypeError);
  });
});
