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

  it('recognizes D major in C major as V/V (secondary dominant)', () => {
    const cMajor = Key.create('C', 'major');
    const rn = romanNumeralFor(cMajor, Chord.create('D', 'major'));
    expect(rn).not.toBeNull();
    expect(rn!.toString()).toBe('V/V');
  });

  it('recognizes D dominant seventh in C major as V⁷/V', () => {
    const cMajor = Key.create('C', 'major');
    const rn = romanNumeralFor(cMajor, Chord.create('D', 'dominantSeventh'));
    expect(rn).not.toBeNull();
    expect(rn!.toString()).toBe('V⁷/V');
  });

  it('recognizes Db major in C major as the Neapolitan (♭II)', () => {
    const cMajor = Key.create('C', 'major');
    const rn = romanNumeralFor(cMajor, Chord.create('Db', 'major'));
    expect(rn).not.toBeNull();
    expect(rn!.toString()).toBe('♭II');
  });

  it('recognizes F minor in C major as iv (borrowed from parallel minor)', () => {
    const cMajor = Key.create('C', 'major');
    const rn = romanNumeralFor(cMajor, Chord.create('F', 'minor'));
    expect(rn).not.toBeNull();
    expect(rn!.toString()).toBe('iv');
  });

  it('recognizes Ab major in C major as bVI (borrowed from parallel minor)', () => {
    const cMajor = Key.create('C', 'major');
    const rn = romanNumeralFor(cMajor, Chord.create('Ab', 'major'));
    expect(rn).not.toBeNull();
    expect(rn!.toString()).toBe('♭VI');
  });

  it('recognizes Bb major in C major as bVII (borrowed from parallel minor)', () => {
    const cMajor = Key.create('C', 'major');
    const rn = romanNumeralFor(cMajor, Chord.create('Bb', 'major'));
    expect(rn).not.toBeNull();
    expect(rn!.toString()).toBe('♭VII');
  });

  it('recognizes Eb major in C major as bIII (borrowed from parallel minor)', () => {
    const cMajor = Key.create('C', 'major');
    const rn = romanNumeralFor(cMajor, Chord.create('Eb', 'major'));
    expect(rn).not.toBeNull();
    expect(rn!.toString()).toBe('♭III');
  });

  it('recognizes F# diminished in C major as vii°/V (secondary leading-tone)', () => {
    const cMajor = Key.create('C', 'major');
    const rn = romanNumeralFor(cMajor, Chord.create('F#', 'diminished'));
    expect(rn).not.toBeNull();
    expect(rn!.toString()).toBe('vii°/V');
  });

  it('recognizes F# diminished seventh in C major as vii°⁷/V', () => {
    const cMajor = Key.create('C', 'major');
    const rn = romanNumeralFor(cMajor, Chord.create('F#', 'diminishedSeventh'));
    expect(rn).not.toBeNull();
    expect(rn!.toString()).toBe('vii°⁷/V');
  });

  it('recognizes C# diminished in C major as vii°/ii (secondary leading-tone of ii)', () => {
    const cMajor = Key.create('C', 'major');
    const rn = romanNumeralFor(cMajor, Chord.create('C#', 'diminished'));
    expect(rn).not.toBeNull();
    expect(rn!.toString()).toBe('vii°/ii');
  });

  it('recognizes D diminished in C major as ii° (borrowed from parallel minor)', () => {
    // In C minor, ii = D° (diminished); borrowed into C major.
    const cMajor = Key.create('C', 'major');
    const rn = romanNumeralFor(cMajor, Chord.create('D', 'diminished'));
    expect(rn).not.toBeNull();
    expect(rn!.toString()).toBe('ii°');
  });

  it('recognizes A major in C major as V/ii (secondary dominant of ii)', () => {
    const cMajor = Key.create('C', 'major');
    const rn = romanNumeralFor(cMajor, Chord.create('A', 'major'));
    expect(rn).not.toBeNull();
    expect(rn!.toString()).toBe('V/ii');
  });

  it('recognizes Db major in A minor as the Neapolitan (♭II) — root check path', () => {
    // G# major in A minor: not a secondary dominant (G# is not +7 from any
    // A-minor diatonic root), not borrowed (A major has G# diminished, not
    // G# major), not Neapolitan (bII of A minor = Bb, not G#). Returns null.
    const aMinor = Key.create('A', 'minor');
    expect(romanNumeralFor(aMinor, Chord.create('G#', 'major'))).toBeNull();
  });

  it('returns null for genuinely unrecognized chords', () => {
    const cMajor = Key.create('C', 'major');
    // G# minor is not a diatonic chord, secondary dominant, borrowed chord
    // from C minor, or Neapolitan in C major.
    expect(romanNumeralFor(cMajor, Chord.create('G#', 'minor'))).toBeNull();
  });

  it('does not recognize a half-diminished seventh (F#ø7) as a secondary leading-tone chord', () => {
    // Half-dim sevenths are excluded from secondary leading-tone recognition
    // because they do not carry the harmonic-minor resolution. F#ø7 in C
    // major falls through chromatic recognition entirely → null.
    const cMajor = Key.create('C', 'major');
    expect(romanNumeralFor(cMajor, Chord.create('F#', 'halfDiminishedSeventh'))).toBeNull();
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

  it('applies Roman numeral inversion figures to built chords', () => {
    const cMajor = Key.create('C', 'major');
    const firstInversionTriad = chordFromRomanNumeral(cMajor, 'I6');
    const secondInversionTriad = chordFromRomanNumeral(cMajor, 'I64');
    const firstInversionSeventh = chordFromRomanNumeral(cMajor, 'V65');
    const thirdInversionSeventh = chordFromRomanNumeral(cMajor, 'V42');

    expect(firstInversionTriad.inversionIndex).toBe(1);
    expect(firstInversionTriad.bass.note).toBe('E');
    expect(secondInversionTriad.inversionIndex).toBe(2);
    expect(secondInversionTriad.bass.note).toBe('G');
    expect(firstInversionSeventh.inversionIndex).toBe(1);
    expect(firstInversionSeventh.bass.note).toBe('B');
    expect(thirdInversionSeventh.inversionIndex).toBe(3);
    expect(thirdInversionSeventh.bass.note).toBe('F');
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

  it('builds vii°7/V in C major as the fully-diminished seventh (F#°7)', () => {
    // Applied to a major target (G major). The leading-tone seventh is always
    // fully diminished (F#-A-C-Eb), not half-diminished, regardless of whether
    // the tonicised target is major or minor.
    const cMajor = Key.create('C', 'major');
    const result = chordFromRomanNumeral(cMajor, 'vii°7/V');
    expect(result.root.note).toBe('F#');
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

  it('round-trips diatonic triads in A minor', () => {
    const aMinor = Key.create('A', 'minor');
    for (const chord of aMinor.diatonicChords()) {
      const rn = romanNumeralFor(aMinor, chord);
      expect(rn).not.toBeNull();
      const rebuilt = chordFromRomanNumeral(aMinor, rn!);
      expect(rebuilt.equals(chord)).toBe(true);
    }
  });

  it('recognizes E major in A minor as plain V (harmonic-minor dominant, not V/i)', () => {
    // In a minor key the diatonic V is natural-minor v (minor triad), but
    // uppercase V (major triad) is the harmonic-minor dominant. It should
    // be labeled V, not V/i.
    const aMinor = Key.create('A', 'minor');
    const rn = romanNumeralFor(aMinor, Chord.create('E', 'major'));
    expect(rn).not.toBeNull();
    expect(rn!.toString()).toBe('V');
  });

  it('recognizes G# diminished in A minor as plain vii° (harmonic-minor leading tone, not vii°/i)', () => {
    // G# diminished is the harmonic-minor leading-tone triad in A minor.
    // It should be labeled vii°, not vii°/i.
    const aMinor = Key.create('A', 'minor');
    const rn = romanNumeralFor(aMinor, Chord.create('G#', 'diminished'));
    expect(rn).not.toBeNull();
    expect(rn!.toString()).toBe('vii°');
  });

  it.each([
    ['V/V', 'D', 'major'],
    ['V⁷/V', 'D', 'dominantSeventh'],
    ['vii°/V', 'F#', 'diminished'],
    ['vii°⁷/V', 'F#', 'diminishedSeventh'],
    ['vii°/ii', 'C#', 'diminished'],
    ['vii°⁷/ii', 'C#', 'diminishedSeventh'],
    ['V/ii', 'A', 'major'],
    ['♭II', 'Db', 'major'],
    ['iv', 'F', 'minor'],
    ['♭VI', 'Ab', 'major'],
    ['♭VII', 'Bb', 'major'],
    ['♭III', 'Eb', 'major'],
    ['ii°', 'D', 'diminished'],
  ] as const)(
    'chromatic round-trip for %s in C major: recognize → rebuild → equals original',
    (numeral, rootNote, suffix) => {
      const cMajor = Key.create('C', 'major');
      // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
      const original = Chord.create(rootNote, suffix as never);
      const rn = romanNumeralFor(cMajor, original);
      expect(rn).not.toBeNull();
      expect(rn!.toString()).toBe(numeral);
      const rebuilt = chordFromRomanNumeral(cMajor, rn!);
      expect(rebuilt.root.chromaticIndex).toBe(original.root.chromaticIndex);
      expect(rebuilt.suffix).toBe(original.suffix);
    },
  );
});
