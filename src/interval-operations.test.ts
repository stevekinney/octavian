import { describe, expect, it } from 'bun:test';
import * as fc from 'fast-check';

import {
  compoundInterval,
  consonanceOf,
  INTERVALS,
  invertInterval,
  isConsonant,
  isDissonant,
  simplifyInterval,
  type CanonicalInterval,
  type Interval,
} from './intervals.js';

const CANONICAL_INTERVAL_KEYS: readonly CanonicalInterval[] = [
  'perfectUnison',
  'diminishedSecond',
  'minorSecond',
  'augmentedUnison',
  'majorSecond',
  'diminishedThird',
  'minorThird',
  'augmentedSecond',
  'majorThird',
  'diminishedFourth',
  'perfectFourth',
  'augmentedThird',
  'augmentedFourth',
  'diminishedFifth',
  'perfectFifth',
  'diminishedSixth',
  'minorSixth',
  'augmentedFifth',
  'majorSixth',
  'diminishedSeventh',
  'minorSeventh',
  'augmentedSixth',
  'majorSeventh',
  'diminishedOctave',
  'perfectOctave',
  'minorNinth',
  'augmentedOctave',
  'majorNinth',
  'diminishedTenth',
  'minorTenth',
  'augmentedNinth',
  'majorTenth',
  'diminishedEleventh',
  'perfectEleventh',
  'augmentedTenth',
  'augmentedEleventh',
  'diminishedTwelfth',
  'perfectTwelfth',
  'minorThirteenth',
  'augmentedTwelfth',
  'majorThirteenth',
  'diminishedFourteenth',
];

describe('invertInterval', () => {
  it('inverts simple intervals correctly', () => {
    expect(invertInterval('perfectFifth')).toBe('perfectFourth');
    expect(invertInterval('perfectFourth')).toBe('perfectFifth');
    expect(invertInterval('majorThird')).toBe('minorSixth');
    expect(invertInterval('minorThird')).toBe('majorSixth');
    expect(invertInterval('majorSecond')).toBe('minorSeventh');
    expect(invertInterval('minorSeventh')).toBe('majorSecond');
    expect(invertInterval('majorSixth')).toBe('minorThird');
    expect(invertInterval('minorSixth')).toBe('majorThird');
    expect(invertInterval('majorSeventh')).toBe('minorSecond');
    expect(invertInterval('minorSecond')).toBe('majorSeventh');
  });

  it('inverts the tritone to itself (A4 ↔ d5)', () => {
    expect(invertInterval('augmentedFourth')).toBe('diminishedFifth');
    expect(invertInterval('diminishedFifth')).toBe('augmentedFourth');
  });

  it('inverts unison to octave and vice versa', () => {
    expect(invertInterval('perfectUnison')).toBe('perfectOctave');
    expect(invertInterval('perfectOctave')).toBe('perfectUnison');
  });

  it('handles aliases', () => {
    expect(invertInterval('octave')).toBe('perfectUnison');
    expect(invertInterval('tritone')).toBe('diminishedFifth');
  });

  it('inverts compound intervals via their simple form', () => {
    // P11 simplifies to P4, which inverts to P5.
    expect(invertInterval('perfectEleventh')).toBe('perfectFifth');
    // M9 simplifies to M2, which inverts to m7.
    expect(invertInterval('majorNinth')).toBe('minorSeventh');
  });

  it('property: invert(invert(x)) returns to a pitch-class-equivalent simple interval', () => {
    // Exclude intervals whose inversion mathematics produce out-of-range
    // semitones (negative or beyond an octave): augmentedOctave (13 st,
    // deg 8 → inversion would need semitones=-1) and diminishedSecond
    // (0 st, deg 2 → inversion would need semitones=12 deg=7 not in
    // catalog). Both are valid catalog entries but their inversion is
    // not represented. The property holds for all other simple intervals.
    const invertible = CANONICAL_INTERVAL_KEYS.filter(
      (i) => i !== 'augmentedOctave' && i !== 'diminishedSecond' && i !== 'augmentedUnison',
    );
    fc.assert(
      fc.property(fc.constantFrom(...invertible), (interval) => {
        const inverted = invertInterval(interval);
        const back = invertInterval(inverted);
        const original = INTERVALS[simplifyInterval(interval)];
        const result = INTERVALS[back];
        return original.semitones % 12 === result.semitones % 12;
      }),
      { numRuns: 50 },
    );
  });

  it('throws RangeError on inversion of intervals whose inverse is out of catalog', () => {
    // augmentedOctave (semitones=13, degree=8) — inverse semitones=−1 not
    // representable.
    expect(() => invertInterval('augmentedOctave')).toThrow(RangeError);
    // diminishedSecond (semitones=0, degree=2) — inverse semitones=12,
    // degree=7 is not in the catalog (no "perfect seventh" or equivalent).
    expect(() => invertInterval('diminishedSecond')).toThrow(RangeError);
  });
});

describe('simplifyInterval', () => {
  it('returns simple intervals unchanged', () => {
    expect(simplifyInterval('perfectFifth')).toBe('perfectFifth');
    expect(simplifyInterval('majorThird')).toBe('majorThird');
    expect(simplifyInterval('perfectUnison')).toBe('perfectUnison');
    expect(simplifyInterval('perfectOctave')).toBe('perfectOctave');
  });

  it('reduces compound intervals to their simple form', () => {
    expect(simplifyInterval('perfectEleventh')).toBe('perfectFourth');
    expect(simplifyInterval('majorNinth')).toBe('majorSecond');
    expect(simplifyInterval('minorNinth')).toBe('minorSecond');
    expect(simplifyInterval('majorThirteenth')).toBe('majorSixth');
    expect(simplifyInterval('minorThirteenth')).toBe('minorSixth');
    expect(simplifyInterval('augmentedEleventh')).toBe('augmentedFourth');
    expect(simplifyInterval('perfectTwelfth')).toBe('perfectFifth');
  });

  it('handles aliases', () => {
    expect(simplifyInterval('eleventh')).toBe('perfectFourth');
    expect(simplifyInterval('flatNine')).toBe('minorSecond');
  });
});

describe('compoundInterval', () => {
  it('returns the canonical when octaves is 0', () => {
    expect(compoundInterval('perfectFourth', 0)).toBe('perfectFourth');
    expect(compoundInterval('majorSecond', 0)).toBe('majorSecond');
  });

  it('extends simple intervals by 1 octave', () => {
    expect(compoundInterval('perfectFourth', 1)).toBe('perfectEleventh');
    expect(compoundInterval('majorSecond', 1)).toBe('majorNinth');
    expect(compoundInterval('minorSecond', 1)).toBe('minorNinth');
    expect(compoundInterval('majorSixth', 1)).toBe('majorThirteenth');
  });

  it('throws RangeError on negative or non-integer octaves', () => {
    expect(() => compoundInterval('perfectFourth', -1)).toThrow(RangeError);
    expect(() => compoundInterval('perfectFourth', 1.5)).toThrow(RangeError);
  });

  it('throws RangeError when the compound result is not in the catalog', () => {
    // Two-octave extensions are beyond the catalog (which stops at 14ths).
    expect(() => compoundInterval('perfectFifth', 2)).toThrow(RangeError);
  });

  it('property: simplify(compound(x, 1)) === x for catalog-supported simple intervals', () => {
    // Compound coverage in the v1 catalog goes up to 13ths (degree 13, M13).
    // m7 → m14 and M7 → M14 are out of catalog. The catalog supports compound
    // forms for degrees 1–6: P1→P8, m2→m9, M2→M9, m3→m10, M3→M10, P4→P11,
    // P5→P12, m6→m13, M6→M13. Test only those.
    const compoundable: readonly CanonicalInterval[] = [
      'minorSecond',
      'majorSecond',
      'minorThird',
      'majorThird',
      'perfectFourth',
      'perfectFifth',
      'minorSixth',
      'majorSixth',
    ];
    fc.assert(
      fc.property(fc.constantFrom(...compoundable), (interval) => {
        const compounded = compoundInterval(interval, 1);
        return simplifyInterval(compounded) === interval;
      }),
      { numRuns: 50 },
    );
  });

  it('compoundInterval(x, 0) is identity for any input', () => {
    for (const x of CANONICAL_INTERVAL_KEYS) {
      expect(compoundInterval(x, 0)).toBe(x);
    }
  });
});

describe('IntervalInformation enrichment', () => {
  it('every canonical entry has simpleInterval, octaveOffset, and consonance populated', () => {
    for (const canonical of CANONICAL_INTERVAL_KEYS) {
      const info = INTERVALS[canonical];
      expect(info.simpleInterval).toBeDefined();
      expect(info.octaveOffset).toBeDefined();
      expect(info.consonance).toBeDefined();
    }
  });

  it('simple intervals have octaveOffset 0', () => {
    expect(INTERVALS.perfectFifth.octaveOffset).toBe(0);
    expect(INTERVALS.majorThird.octaveOffset).toBe(0);
    expect(INTERVALS.perfectOctave.octaveOffset).toBe(0);
  });

  it('compound intervals have octaveOffset > 0', () => {
    expect(INTERVALS.perfectEleventh.octaveOffset).toBe(1);
    expect(INTERVALS.majorNinth.octaveOffset).toBe(1);
    expect(INTERVALS.minorThirteenth.octaveOffset).toBe(1);
  });

  it('aliases inherit enrichment from their canonical form', () => {
    expect(INTERVALS.unison.simpleInterval).toBe('perfectUnison');
    expect(INTERVALS.tritone.simpleInterval).toBe('augmentedFourth');
    expect(INTERVALS.octave.octaveOffset).toBe(0);
    expect(INTERVALS.eleventh.octaveOffset).toBe(1);
  });
});

describe('consonance classification', () => {
  it('classifies perfect consonances correctly', () => {
    expect(consonanceOf('perfectUnison')).toBe('perfect-consonance');
    expect(consonanceOf('perfectFifth')).toBe('perfect-consonance');
    expect(consonanceOf('perfectOctave')).toBe('perfect-consonance');
    expect(consonanceOf('perfectFourth')).toBe('perfect-consonance');
  });

  it('classifies imperfect consonances correctly', () => {
    expect(consonanceOf('majorThird')).toBe('imperfect-consonance');
    expect(consonanceOf('minorThird')).toBe('imperfect-consonance');
    expect(consonanceOf('majorSixth')).toBe('imperfect-consonance');
    expect(consonanceOf('minorSixth')).toBe('imperfect-consonance');
  });

  it('classifies mild dissonances correctly', () => {
    expect(consonanceOf('majorSecond')).toBe('mild-dissonance');
    expect(consonanceOf('minorSeventh')).toBe('mild-dissonance');
  });

  it('classifies sharp dissonances correctly', () => {
    expect(consonanceOf('minorSecond')).toBe('sharp-dissonance');
    expect(consonanceOf('majorSeventh')).toBe('sharp-dissonance');
    expect(consonanceOf('augmentedFourth')).toBe('sharp-dissonance');
    expect(consonanceOf('diminishedFifth')).toBe('sharp-dissonance');
  });

  it('classifies compound intervals via their simple form', () => {
    expect(consonanceOf('perfectEleventh')).toBe('perfect-consonance'); // P4
    expect(consonanceOf('majorNinth')).toBe('mild-dissonance'); // M2
    expect(consonanceOf('majorThirteenth')).toBe('imperfect-consonance'); // M6
  });

  it('isConsonant returns true for consonances and false for dissonances', () => {
    expect(isConsonant('perfectFifth')).toBe(true);
    expect(isConsonant('majorThird')).toBe(true);
    expect(isConsonant('majorSecond')).toBe(false);
    expect(isConsonant('augmentedFourth')).toBe(false);
  });

  it('isDissonant is the complement of isConsonant', () => {
    fc.assert(
      fc.property(fc.constantFrom(...CANONICAL_INTERVAL_KEYS), (interval: Interval) => {
        return isConsonant(interval) !== isDissonant(interval);
      }),
      { numRuns: 50 },
    );
  });

  it('every canonical interval has a defined consonance classification', () => {
    for (const canonical of CANONICAL_INTERVAL_KEYS) {
      const value = consonanceOf(canonical);
      expect([
        'perfect-consonance',
        'imperfect-consonance',
        'mild-dissonance',
        'sharp-dissonance',
      ]).toContain(value);
    }
  });
});
