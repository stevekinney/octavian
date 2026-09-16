import { describe, expect, it } from 'bun:test';

import { Chord } from './chord.js';
import {
  harmonicFunctionFor,
  harmonicFunctionForAsAlias,
  harmonicFunctionForNumeral,
  type HarmonicFunction,
} from './harmonic-function.js';
import { Key } from './key.js';
import { RomanNumeral } from './roman-numeral.js';

describe('harmonicFunctionFor — major key (C major)', () => {
  const cMajor = Key.create('C', 'major');

  it.each([
    ['C', 'major', 'tonic'],
    ['D', 'minor', 'predominant'],
    ['E', 'minor', 'tonic'],
    ['F', 'major', 'predominant'],
    ['G', 'major', 'dominant'],
    ['A', 'minor', 'tonic'],
    ['B', 'diminished', 'dominant'],
  ] as const)(
    'classifies the %s %s diatonic triad as %s',
    (root: string, suffix: string, expected: HarmonicFunction) => {
      // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
      const chord = Chord.create(`${root}4`, suffix as never);
      expect(harmonicFunctionFor(cMajor, chord)).toBe(expected);
    },
  );

  it.each([
    ['C', 'majorSeventh', 'tonic'], // I⁷
    ['D', 'minorSeventh', 'predominant'], // ii⁷
    ['E', 'minorSeventh', 'tonic'], // iii⁷
    ['F', 'majorSeventh', 'predominant'], // IV⁷
    ['G', 'dominantSeventh', 'dominant'], // V⁷
    ['A', 'minorSeventh', 'tonic'], // vi⁷
    ['B', 'halfDiminishedSeventh', 'dominant'], // vii°⁷
  ] as const)(
    'classifies the %s %s diatonic seventh chord as %s',
    (root: string, suffix: string, expected: HarmonicFunction) => {
      // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
      const chord = Chord.create(`${root}4`, suffix as never);
      expect(harmonicFunctionFor(cMajor, chord)).toBe(expected);
    },
  );
});

describe('harmonicFunctionFor — minor key (A minor)', () => {
  const aMinor = Key.create('A', 'minor');

  it.each([
    ['A', 'minor', 'tonic'], // i
    ['B', 'diminished', 'predominant'], // ii°
    ['C', 'major', 'tonic'], // III (relative major as tonic substitute)
    ['D', 'minor', 'predominant'], // iv
    ['E', 'minor', 'dominant'], // v (natural minor diatonic)
    ['F', 'major', 'tonic'], // VI
    ['G', 'major', 'dominant'], // VII (sub-tonic, dominant function)
  ] as const)(
    'classifies the %s %s diatonic triad as %s',
    (root: string, suffix: string, expected: HarmonicFunction) => {
      // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
      const chord = Chord.create(`${root}4`, suffix as never);
      expect(harmonicFunctionFor(aMinor, chord)).toBe(expected);
    },
  );

  it.each([
    ['A', 'minorSeventh', 'tonic'], // i⁷
    ['B', 'halfDiminishedSeventh', 'predominant'], // ii°⁷ (natural-minor supertonic)
    ['C', 'majorSeventh', 'tonic'], // III⁷
    ['D', 'minorSeventh', 'predominant'], // iv⁷
    ['E', 'minorSeventh', 'dominant'], // v⁷ (natural-minor diatonic dominant)
    ['F', 'majorSeventh', 'tonic'], // VI⁷
    ['G', 'dominantSeventh', 'dominant'], // VII⁷ (natural-minor sub-tonic)
  ] as const)(
    'classifies the %s %s diatonic seventh chord as %s',
    (root: string, suffix: string, expected: HarmonicFunction) => {
      // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
      const chord = Chord.create(`${root}4`, suffix as never);
      expect(harmonicFunctionFor(aMinor, chord)).toBe(expected);
    },
  );
});

describe('harmonicFunctionFor — non-functional and edge cases', () => {
  const cMajor = Key.create('C', 'major');

  it('returns null for a borrowed chord (Db major = ♭II in C major)', () => {
    // Db major is now recognized as the Neapolitan (♭II), but
    // harmonicFunctionForNumeral returns null for altered numerals.
    expect(harmonicFunctionFor(cMajor, Chord.create('Db4', 'major'))).toBeNull();
  });

  it('returns null for a secondary dominant (D dominant7 = V⁷/V in C major)', () => {
    // D7 is now recognized as V7/V (secondary dominant), but
    // harmonicFunctionForNumeral returns null for applied numerals.
    expect(harmonicFunctionFor(cMajor, Chord.create('D4', 'dominantSeventh'))).toBeNull();
  });

  it('returns null for a genuinely unrecognized chord (G# minor in C major)', () => {
    // G# minor is not diatonic, a secondary dominant, borrowed, or Neapolitan.
    // romanNumeralFor returns null, so harmonicFunctionFor returns null too.
    expect(harmonicFunctionFor(cMajor, Chord.create('G#4', 'minor'))).toBeNull();
  });
});

describe('harmonicFunctionForNumeral', () => {
  it.each([
    ['I', 'major', 'tonic'],
    ['ii', 'major', 'predominant'],
    ['iii', 'major', 'tonic'],
    ['IV', 'major', 'predominant'],
    ['V', 'major', 'dominant'],
    ['vi', 'major', 'tonic'],
    ['vii°', 'major', 'dominant'],
    ['i', 'minor', 'tonic'],
    ['ii°', 'minor', 'predominant'],
    ['III', 'minor', 'tonic'],
    ['iv', 'minor', 'predominant'],
    ['v', 'minor', 'dominant'],
    ['VI', 'minor', 'tonic'],
    ['VII', 'minor', 'dominant'],
    // Harmonic-minor leading-tone chord: in A minor analyzed off a
    // raised G♯ root, vii° is dominant just as it is in major.
    ['vii°', 'minor', 'dominant'],
    // Harmonic-minor V (major triad in minor) is the textbook
    // dominant; covered alongside natural-minor v above.
    ['V', 'minor', 'dominant'],
  ] as const)(
    'classifies %s in %s as %s',
    (rn: string, mode: 'major' | 'minor', expected: HarmonicFunction) => {
      const numeral = RomanNumeral.parse(rn);
      expect(harmonicFunctionForNumeral(numeral, mode)).toBe(expected);
    },
  );

  it('returns null for altered numerals (♭III, ♯iv°)', () => {
    expect(harmonicFunctionForNumeral(RomanNumeral.parse('♭III'), 'major')).toBeNull();
    expect(harmonicFunctionForNumeral(RomanNumeral.parse('♯iv°'), 'major')).toBeNull();
  });

  it('returns null for applied numerals (V/V, V7/IV)', () => {
    expect(harmonicFunctionForNumeral(RomanNumeral.parse('V/V'), 'major')).toBeNull();
    expect(harmonicFunctionForNumeral(RomanNumeral.parse('V7/IV'), 'major')).toBeNull();
  });

  it.each([
    // Borrowed-from-parallel numerals on the same diatonic degree
    // must return null in v1; they're handled by modal mixture (2.11).
    ['i', 'major'], // borrowed minor tonic in a major key
    ['III', 'major'], // borrowed major mediant (♭III material rendered without flat)
    ['iv', 'major'], // borrowed minor subdominant
    ['v', 'major'], // borrowed minor dominant (no leading tone)
    ['vi', 'minor'], // borrowed minor submediant in a minor key
    ['IV', 'minor'], // borrowed major subdominant
    ['I', 'minor'], // Picardy-style major tonic
    ['ii', 'minor'], // borrowed minor supertonic (vs diatonic ii°)
  ] as const)(
    'returns null for borrowed-quality numeral %s in %s key',
    (rn: string, mode: 'major' | 'minor') => {
      expect(harmonicFunctionForNumeral(RomanNumeral.parse(rn), mode)).toBeNull();
    },
  );
});

describe('harmonicFunctionForAsAlias — predominant ↔ subdominant alias', () => {
  const cMajor = Key.create('C', 'major');

  it('returns subdominant for predominant chords', () => {
    expect(harmonicFunctionForAsAlias(cMajor, Chord.create('D4', 'minor'))).toBe('subdominant');
    expect(harmonicFunctionForAsAlias(cMajor, Chord.create('F4', 'major'))).toBe('subdominant');
  });

  it('returns the same name for tonic and dominant', () => {
    expect(harmonicFunctionForAsAlias(cMajor, Chord.create('C4', 'major'))).toBe('tonic');
    expect(harmonicFunctionForAsAlias(cMajor, Chord.create('G4', 'major'))).toBe('dominant');
  });

  it('returns null for non-functional chords (G# minor is unrecognized in C major)', () => {
    expect(harmonicFunctionForAsAlias(cMajor, Chord.create('G#4', 'minor'))).toBeNull();
  });
});
