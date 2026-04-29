import { describe, expect, it } from 'bun:test';

import { Chord } from './chord.js';
import { chordFromRomanNumeral, romanNumeralFor } from './key-roman.js';
import { Key } from './key.js';
import { RomanNumeral, type RomanNumeralLike } from './roman-numeral.js';

describe('romanNumeralFor', () => {
  it('identifies all 7 diatonic triads in C major', () => {
    const cMajor = Key.create('C', 'major');
    const expected = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
    const triads = cMajor.diatonicChords();
    for (let i = 0; i < triads.length; i++) {
      const rn = romanNumeralFor(cMajor, triads[i]!);
      expect(rn).not.toBeNull();
      expect(rn!.toString()).toBe(expected[i]!);
    }
  });

  it('identifies the 7 diatonic seventh chords in C major', () => {
    const cMajor = Key.create('C', 'major');
    const expected = ['I⁷', 'ii⁷', 'iii⁷', 'IV⁷', 'V⁷', 'vi⁷', 'vii°⁷'];
    const sevenths = cMajor.diatonicSeventhChords();
    for (let i = 0; i < sevenths.length; i++) {
      const rn = romanNumeralFor(cMajor, sevenths[i]!);
      expect(rn).not.toBeNull();
      expect(rn!.toString()).toBe(expected[i]!);
    }
  });

  it('identifies natural-minor triads in A minor', () => {
    const aMinor = Key.create('A', 'minor');
    const expected = ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'];
    const triads = aMinor.diatonicChords();
    for (let i = 0; i < triads.length; i++) {
      const rn = romanNumeralFor(aMinor, triads[i]!);
      expect(rn).not.toBeNull();
      expect(rn!.toString()).toBe(expected[i]!);
    }
  });

  it('returns null for non-diatonic chords (no chromatic recognition in v1)', () => {
    const cMajor = Key.create('C', 'major');
    expect(romanNumeralFor(cMajor, Chord.create('Db4', 'major'))).toBeNull();
    expect(romanNumeralFor(cMajor, Chord.create('D4', 'dominantSeventh'))).toBeNull();
  });

  it('captures inversion when the chord is inverted', () => {
    const cMajor = Key.create('C', 'major');
    const cMajorTriad = Chord.create('C4', 'major').invert(1);
    const rn = romanNumeralFor(cMajor, cMajorTriad);
    expect(rn).not.toBeNull();
    expect(rn!.inversion).toBe('6');
  });
});

describe('chordFromRomanNumeral', () => {
  it('builds the diatonic triads of C major', () => {
    const cMajor = Key.create('C', 'major');
    const expected = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    const numerals: RomanNumeralLike[] = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
    for (let i = 0; i < numerals.length; i++) {
      const chord = chordFromRomanNumeral(cMajor, numerals[i]);
      expect(chord.root.note).toBe(expected[i]);
    }
  });

  it('builds dominant-seventh on V', () => {
    const cMajor = Key.create('C', 'major');
    const v7 = chordFromRomanNumeral(cMajor, 'V7');
    expect(v7.root.note).toBe('G');
    expect(v7.suffix).toBe('dominantSeventh');
  });

  it('builds half-diminished on vii° when figured as a seventh', () => {
    const cMajor = Key.create('C', 'major');
    const halfDim = chordFromRomanNumeral(cMajor, 'vii°7');
    expect(halfDim.root.note).toBe('B');
    expect(halfDim.suffix).toBe('halfDiminishedSeventh');
  });

  it('handles flat-prefix chromatic degrees', () => {
    const cMajor = Key.create('C', 'major');
    const flatSeven = chordFromRomanNumeral(cMajor, 'bVII');
    expect(flatSeven.root.note).toBe('Bb');
    expect(flatSeven.suffix).toBe('major');
  });

  it('handles sharp-prefix chromatic degrees', () => {
    const cMajor = Key.create('C', 'major');
    const sharpFour = chordFromRomanNumeral(cMajor, '#iv°');
    expect(sharpFour.root.note).toBe('F#');
    expect(sharpFour.suffix).toBe('diminished');
  });

  it('builds V/V in C major as the D major triad (no seventh)', () => {
    const cMajor = Key.create('C', 'major');
    const vOfV = chordFromRomanNumeral(cMajor, 'V/V');
    expect(vOfV.root.note).toBe('D');
    expect(vOfV.suffix).toBe('major');
  });

  it('builds V7/V in C major = D7', () => {
    const cMajor = Key.create('C', 'major');
    const v7OfV = chordFromRomanNumeral(cMajor, 'V7/V');
    expect(v7OfV.root.note).toBe('D');
    expect(v7OfV.suffix).toBe('dominantSeventh');
  });

  it('builds V7/IV in C major = C7', () => {
    const cMajor = Key.create('C', 'major');
    const v7OfIV = chordFromRomanNumeral(cMajor, 'V7/IV');
    expect(v7OfIV.root.note).toBe('C');
    expect(v7OfIV.suffix).toBe('dominantSeventh');
  });

  it('builds vii°/V in C major = F#°', () => {
    const cMajor = Key.create('C', 'major');
    const dimOfV = chordFromRomanNumeral(cMajor, 'vii°/V');
    expect(dimOfV.root.note).toBe('F#');
    expect(dimOfV.suffix).toBe('diminished');
  });

  it('builds vii°/ii in C major using the harmonic-minor leading tone (C#°)', () => {
    // The temporary tonic is D (minor); D minor's leading tone is C#
    // (raised from natural C). vii° must be built on C#, not C.
    const cMajor = Key.create('C', 'major');
    const dimOfII = chordFromRomanNumeral(cMajor, 'vii°/ii');
    expect(dimOfII.root.note).toBe('C#');
    expect(dimOfII.suffix).toBe('diminished');
  });

  it('builds nested applied chords V/V/V in C major', () => {
    // V of (V of V) = V of D major = A major triad.
    const cMajor = Key.create('C', 'major');
    const result = chordFromRomanNumeral(cMajor, 'V/V/V');
    expect(result.root.note).toBe('A');
    expect(result.suffix).toBe('major');
  });

  it('builds I⁷ in C major as the major-seventh chord', () => {
    // Major-quality seventh on a non-V degree should be majorSeventh,
    // not dominantSeventh.
    const cMajor = Key.create('C', 'major');
    const iMaj7 = chordFromRomanNumeral(cMajor, 'I7');
    expect(iMaj7.root.note).toBe('C');
    expect(iMaj7.suffix).toBe('majorSeventh');
  });

  it('builds VII7 in A minor as a dominant seventh (G7)', () => {
    // Diatonic VII in natural minor (G major triad) + seventh figure
    // produces a dominant-seventh chord (G-B-D-F), not a major seventh.
    const aMinor = Key.create('A', 'minor');
    const vii7 = chordFromRomanNumeral(aMinor, 'VII7');
    expect(vii7.root.note).toBe('G');
    expect(vii7.suffix).toBe('dominantSeventh');
  });

  it('builds V7 in A minor as the dominant seventh on the raised leading tone implied by uppercase V', () => {
    // V in minor is uppercase (major-quality, taking the harmonic-minor
    // raised leading tone). E major triad becomes E7 with the seventh.
    const aMinor = Key.create('A', 'minor');
    const v7 = chordFromRomanNumeral(aMinor, 'V7');
    expect(v7.root.note).toBe('E');
    expect(v7.suffix).toBe('dominantSeventh');
  });

  it('builds vii°7 in A minor as a fully diminished seventh (G#°7)', () => {
    // The harmonic-minor leading-tone seventh chord is fully diminished
    // (G#-B-D-F in A minor), not half-diminished. Major-key vii°7 is
    // half-diminished by natural-major spelling; minor-key is fully
    // diminished by harmonic-minor spelling.
    const aMinor = Key.create('A', 'minor');
    const vii07 = chordFromRomanNumeral(aMinor, 'vii°7');
    expect(vii07.root.note).toBe('G#');
    expect(vii07.suffix).toBe('diminishedSeventh');
  });

  it('builds vii°7/ii in C major as the fully-diminished applied chord (C#°7)', () => {
    // Tonicizing D minor; the applied vii°7 is the harmonic-minor
    // leading-tone seventh (C#-E-G-Bb).
    const cMajor = Key.create('C', 'major');
    const result = chordFromRomanNumeral(cMajor, 'vii°7/ii');
    expect(result.root.note).toBe('C#');
    expect(result.suffix).toBe('diminishedSeventh');
  });
});

describe('chordFromRomanNumeral — applied-chord error paths', () => {
  it('rejects an empty applied head (/V)', () => {
    expect(() => RomanNumeral.parse('/V')).toThrow(TypeError);
  });

  it('rejects an unrecognized applied head (Z/V)', () => {
    expect(() => RomanNumeral.parse('Z/V')).toThrow(TypeError);
  });

  it('rejects double-slash applied (V//V)', () => {
    expect(() => RomanNumeral.parse('V//V')).toThrow(TypeError);
  });
});

describe('romanNumeralFor / chordFromRomanNumeral round-trip', () => {
  it('round-trips diatonic triads in C major', () => {
    const cMajor = Key.create('C', 'major');
    for (const chord of cMajor.diatonicChords()) {
      const rn = romanNumeralFor(cMajor, chord);
      expect(rn).not.toBeNull();
      const rebuilt = chordFromRomanNumeral(cMajor, rn!);
      expect(rebuilt.equals(chord)).toBe(true);
    }
  });

  it('round-trips diatonic sevenths in C major', () => {
    const cMajor = Key.create('C', 'major');
    for (const chord of cMajor.diatonicSeventhChords()) {
      const rn = romanNumeralFor(cMajor, chord);
      expect(rn).not.toBeNull();
      const rebuilt = chordFromRomanNumeral(cMajor, rn!);
      expect(rebuilt.equals(chord)).toBe(true);
    }
  });
});
