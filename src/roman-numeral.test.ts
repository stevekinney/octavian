import { describe, expect, it } from 'bun:test';
import * as fc from 'fast-check';

import { Chord } from './chord.js';
import { chordFromRomanNumeral, romanNumeralFor } from './key-roman.js';
import { Key } from './key.js';
import {
  RomanNumeral,
  type RomanNumeralLike,
  type SerializedRomanNumeral,
} from './roman-numeral.js';

describe('RomanNumeral.parse — surface forms', () => {
  it('parses a simple major degree (I)', () => {
    const rn = RomanNumeral.parse('I');
    expect(rn.degree).toBe(1);
    expect(rn.quality).toBe('major');
    expect(rn.inversion).toBe('5/3');
    expect(rn.alteration).toBeUndefined();
    expect(rn.applied).toBeUndefined();
  });

  it('parses a simple minor degree (ii)', () => {
    const rn = RomanNumeral.parse('ii');
    expect(rn.degree).toBe(2);
    expect(rn.quality).toBe('minor');
  });

  it('parses diminished with ° marker', () => {
    const rn = RomanNumeral.parse('vii°');
    expect(rn.degree).toBe(7);
    expect(rn.quality).toBe('diminished');
  });

  it('parses ASCII diminished (lowercase o)', () => {
    expect(RomanNumeral.parse('viio').quality).toBe('diminished');
  });

  it('parses augmented with + marker', () => {
    const rn = RomanNumeral.parse('III+');
    expect(rn.degree).toBe(3);
    expect(rn.quality).toBe('augmented');
  });

  it('parses Unicode augmented marker (⁺)', () => {
    expect(RomanNumeral.parse('III⁺').quality).toBe('augmented');
  });

  it('rejects nonsensical case + marker combinations', () => {
    expect(() => RomanNumeral.parse('III°')).toThrow(TypeError); // uppercase + diminished
    expect(() => RomanNumeral.parse('iii+')).toThrow(TypeError); // lowercase + augmented
  });

  it('rejects unrecognized degree letters', () => {
    expect(() => RomanNumeral.parse('VIII')).toThrow(TypeError);
    expect(() => RomanNumeral.parse('Z')).toThrow(TypeError);
  });

  it('rejects an empty string', () => {
    expect(() => RomanNumeral.parse('')).toThrow(TypeError);
    expect(() => RomanNumeral.parse('   ')).toThrow(TypeError);
  });
});

describe('RomanNumeral.parse — degrees disambiguate longest-match-first', () => {
  it.each([
    ['I', 1],
    ['II', 2],
    ['III', 3],
    ['IV', 4],
    ['V', 5],
    ['VI', 6],
    ['VII', 7],
    ['i', 1],
    ['ii', 2],
    ['iii', 3],
    ['iv', 4],
    ['v', 5],
    ['vi', 6],
    ['vii', 7],
  ] as const)('parses %s as degree %d', (input: string, expected: number) => {
    expect(RomanNumeral.parse(input).degree).toBe(expected as RomanNumeral['degree']);
  });
});

describe('RomanNumeral.parse — alterations', () => {
  it('parses ASCII flat prefix (b)', () => {
    const rn = RomanNumeral.parse('bVII');
    expect(rn.alteration).toBe('flat');
    expect(rn.degree).toBe(7);
    expect(rn.quality).toBe('major');
  });

  it('parses ASCII sharp prefix (#)', () => {
    const rn = RomanNumeral.parse('#iv°');
    expect(rn.alteration).toBe('sharp');
    expect(rn.degree).toBe(4);
    expect(rn.quality).toBe('diminished');
  });

  it('parses Unicode flat prefix (♭)', () => {
    const rn = RomanNumeral.parse('♭III');
    expect(rn.alteration).toBe('flat');
    expect(rn.degree).toBe(3);
  });

  it('parses Unicode sharp prefix (♯)', () => {
    const rn = RomanNumeral.parse('♯iv°');
    expect(rn.alteration).toBe('sharp');
  });
});

describe('RomanNumeral.parse — inversions', () => {
  it.each([
    ['I', '5/3'],
    ['I6', '6'],
    ['I64', '6/4'],
    ['V7', '7'],
    ['V65', '6/5'],
    ['V43', '4/3'],
    ['V42', '4/2'],
  ] as const)(
    'parses %s with inversion %s',
    (input: string, expected: RomanNumeral['inversion']) => {
      expect(RomanNumeral.parse(input).inversion).toBe(expected);
    },
  );

  it('parses Unicode superscript inversions', () => {
    expect(RomanNumeral.parse('I⁶').inversion).toBe('6');
    expect(RomanNumeral.parse('V⁶₄').inversion).toBe('6/4');
    expect(RomanNumeral.parse('V⁷').inversion).toBe('7');
    expect(RomanNumeral.parse('V⁶₅').inversion).toBe('6/5');
    expect(RomanNumeral.parse('V⁴₃').inversion).toBe('4/3');
    expect(RomanNumeral.parse('V⁴₂').inversion).toBe('4/2');
  });

  it('rejects unrecognized inversion figures', () => {
    expect(() => RomanNumeral.parse('I33')).toThrow(TypeError);
    expect(() => RomanNumeral.parse('V8')).toThrow(TypeError);
  });
});

describe('RomanNumeral.parse — applied chords', () => {
  it('parses V/V', () => {
    const rn = RomanNumeral.parse('V/V');
    expect(rn.isApplied).toBe(true);
    expect(rn.degree).toBe(5);
    expect(rn.applied!.degree).toBe(5);
    expect(rn.applied!.quality).toBe('major');
  });

  it('parses V7/IV', () => {
    const rn = RomanNumeral.parse('V7/IV');
    expect(rn.degree).toBe(5);
    expect(rn.inversion).toBe('7');
    expect(rn.applied!.degree).toBe(4);
  });

  it('parses vii°/V', () => {
    const rn = RomanNumeral.parse('vii°/V');
    expect(rn.quality).toBe('diminished');
    expect(rn.applied!.degree).toBe(5);
  });

  it('rejects trailing slash', () => {
    expect(() => RomanNumeral.parse('V/')).toThrow(TypeError);
  });
});

describe('RomanNumeral round-trip', () => {
  const examples = [
    'I',
    'ii',
    'iii',
    'IV',
    'V',
    'vi',
    'vii°',
    'I⁶',
    'V⁷',
    'V⁶₅',
    'V⁴₃',
    'V⁴₂',
    'ii⁶',
    'IV⁶₄',
    '♭VII',
    '♭III',
    '♯iv°',
    'III⁺',
    'V⁷/V',
    'vii°/V',
    'V⁶₅/IV',
  ];

  it.each(examples)('parse → render round-trips for %s', (raw: string) => {
    const parsed = RomanNumeral.parse(raw);
    const rendered = parsed.toString();
    const reparsed = RomanNumeral.parse(rendered);
    expect(reparsed.equals(parsed)).toBe(true);
  });

  it('renders ASCII inputs in canonical Unicode form', () => {
    expect(RomanNumeral.parse('V7').toString()).toBe('V⁷');
    expect(RomanNumeral.parse('I6').toString()).toBe('I⁶');
    expect(RomanNumeral.parse('V64').toString()).toBe('V⁶₄');
    expect(RomanNumeral.parse('bVII').toString()).toBe('♭VII');
    expect(RomanNumeral.parse('III+').toString()).toBe('III⁺');
    expect(RomanNumeral.parse('V7/V').toString()).toBe('V⁷/V');
  });

  it('round-trips JSON', () => {
    fc.assert(
      fc.property(fc.constantFrom(...examples), (raw: string) => {
        const parsed = RomanNumeral.parse(raw);
        const restored = RomanNumeral.fromJSON(parsed.toJSON());
        return restored.equals(parsed);
      }),
      { numRuns: 50, seed: 42 },
    );
  });
});

describe('RomanNumeral.create', () => {
  it('returns the same instance when given a RomanNumeral', () => {
    const rn = RomanNumeral.parse('V7');
    expect(RomanNumeral.create(rn)).toBe(rn);
  });

  it('parses a string', () => {
    expect(RomanNumeral.create('IV').degree).toBe(4);
  });

  it('rebuilds from a serialized snapshot', () => {
    const snapshot: SerializedRomanNumeral = {
      degree: 5,
      quality: 'major',
      inversion: '7',
    };
    expect(RomanNumeral.create(snapshot).toString()).toBe('V⁷');
  });
});

describe('RomanNumeral.isRomanNumeral', () => {
  it('returns true for instances', () => {
    expect(RomanNumeral.isRomanNumeral(RomanNumeral.parse('I'))).toBe(true);
  });
  it('returns false for everything else', () => {
    expect(RomanNumeral.isRomanNumeral('I')).toBe(false);
    expect(RomanNumeral.isRomanNumeral({ degree: 1 })).toBe(false);
    expect(RomanNumeral.isRomanNumeral(null)).toBe(false);
  });
});

describe('RomanNumeral.equals', () => {
  it('returns true for identical numerals', () => {
    const a = RomanNumeral.parse('V7/V');
    const b = RomanNumeral.parse('V7/V');
    expect(a.equals(b)).toBe(true);
  });

  it('distinguishes by degree, quality, inversion, alteration, applied', () => {
    const base = RomanNumeral.parse('V7');
    expect(base.equals(RomanNumeral.parse('V'))).toBe(false); // inversion
    expect(base.equals(RomanNumeral.parse('vii°'))).toBe(false); // degree+quality
    expect(base.equals(RomanNumeral.parse('V7/V'))).toBe(false); // applied
    const flat = RomanNumeral.parse('♭VII');
    expect(flat.equals(RomanNumeral.parse('VII'))).toBe(false); // alteration
  });

  it('distinguishes applied targets that differ', () => {
    expect(RomanNumeral.parse('V/V').equals(RomanNumeral.parse('V/IV'))).toBe(false);
  });

  it('returns true when both numerals have the same applied target', () => {
    const a = RomanNumeral.parse('V7/V');
    const b = RomanNumeral.parse('V7/V');
    expect(a.equals(b)).toBe(true);
  });
});

describe('RomanNumeral.toString tag', () => {
  it('exposes a Symbol.toStringTag', () => {
    expect(Object.prototype.toString.call(RomanNumeral.parse('V7'))).toBe(
      '[object RomanNumeral(V⁷)]',
    );
  });
});

describe('Key.romanNumeralFor', () => {
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
    // The chord still has root C even after inverting, so it's still I⁶.
    expect(rn).not.toBeNull();
    expect(rn!.inversion).toBe('6');
  });
});

describe('Key.chordFromRomanNumeral', () => {
  it('builds the diatonic triads of C major', () => {
    const cMajor = Key.create('C', 'major');
    const expected = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    const numerals: RomanNumeralLike[] = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
    for (let i = 0; i < numerals.length; i++) {
      const chord = chordFromRomanNumeral(cMajor, numerals[i]!);
      expect(chord.root.note).toBe(expected[i]!);
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
    // ♭VII in C major → Bb major triad
    const flatSeven = chordFromRomanNumeral(cMajor, 'bVII');
    expect(flatSeven.root.note).toBe('Bb');
    expect(flatSeven.suffix).toBe('major');
  });

  it('handles sharp-prefix chromatic degrees', () => {
    const cMajor = Key.create('C', 'major');
    // ♯iv° in C major → F#° triad
    const sharpFour = chordFromRomanNumeral(cMajor, '#iv°');
    expect(sharpFour.root.note).toBe('F#');
    expect(sharpFour.suffix).toBe('diminished');
  });

  it('builds applied chords (V/V in C major = D7)', () => {
    const cMajor = Key.create('C', 'major');
    const vOfV = chordFromRomanNumeral(cMajor, 'V/V');
    // V of G major is D major triad.
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
});

describe('Key.romanNumeralFor / chordFromRomanNumeral round-trip', () => {
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
