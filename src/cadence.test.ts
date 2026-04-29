import { describe, expect, it } from 'bun:test';

import { Chord } from './chord.js';
import {
  identifyCadence,
  identifyCadenceSequence,
  type CadenceOccurrence,
  type CadenceType,
} from './cadence.js';
import { Key } from './key.js';

describe('identifyCadence — Roman numeral input', () => {
  const cMajor = Key.create('C', 'major');
  const aMinor = Key.create('A', 'minor');

  it.each([
    ['V', 'I', 'authentic-perfect'],
    ['V', 'I6', 'authentic-imperfect'],
    ['ii', 'V', 'half'],
    ['IV', 'I', 'plagal'],
    ['V', 'vi', 'deceptive'],
  ] as const)(
    'identifies %s → %s as %s in C major',
    (first: string, second: string, expected: CadenceType) => {
      expect(identifyCadence(cMajor, first, second)).toBe(expected);
      expect(cMajor.identifyCadence(first, second)).toBe(expected);
    },
  );

  it('identifies the minor-key phrygian cadence iv6 → V', () => {
    expect(identifyCadence(aMinor, 'iv6', 'V')).toBe('phrygian');
    expect(aMinor.identifyCadence('iv⁶', 'V')).toBe('phrygian');
  });

  it('returns null for non-cadential Roman numeral pairs', () => {
    expect(cMajor.identifyCadence('I', 'ii')).toBeNull();
    expect(cMajor.identifyCadence('V/V', 'I')).toBeNull();
  });
});

describe('identifyCadence — Chord input', () => {
  const cMajor = Key.create('C', 'major');
  const aMinor = Key.create('A', 'minor');

  it.each([
    [Chord.create('G4', 'major'), Chord.create('C4', 'major'), 'authentic-perfect'],
    [Chord.create('G4', 'major'), Chord.create('C4', 'major').invert(1), 'authentic-imperfect'],
    [Chord.create('D4', 'minor'), Chord.create('G4', 'major'), 'half'],
    [Chord.create('F4', 'major'), Chord.create('C4', 'major'), 'plagal'],
    [Chord.create('G4', 'dominantSeventh'), Chord.create('A4', 'minor'), 'deceptive'],
  ] as const)('identifies chord pair %# as %s', (first, second, expected: CadenceType) => {
    expect(cMajor.identifyCadence(first, second)).toBe(expected);
  });

  it('identifies the minor-key phrygian cadence from inverted chords', () => {
    expect(
      aMinor.identifyCadence(Chord.create('D4', 'minor').invert(1), Chord.create('E4', 'major')),
    ).toBe('phrygian');
  });

  it('uses explicit voicing to distinguish authentic cadence soprano position', () => {
    const dominant = Chord.create('G3', 'dominantSeventh');
    const tonicWithTonicSoprano = {
      chord: Chord.create('C4', 'major'),
      voicing: ['E4', 'G4', 'C5'],
    } as const;
    const tonicWithThirdSoprano = {
      chord: Chord.create('C4', 'major'),
      voicing: ['C4', 'G4', 'E5'],
    } as const;

    expect(cMajor.identifyCadence(dominant, tonicWithTonicSoprano)).toBe('authentic-perfect');
    expect(cMajor.identifyCadence(dominant, tonicWithThirdSoprano)).toBe('authentic-imperfect');
  });

  it('throws when an explicit voicing does not contain the chord pitch classes', () => {
    expect(() =>
      cMajor.identifyCadence(Chord.create('G4', 'major'), {
        chord: Chord.create('C4', 'major'),
        voicing: ['C4', 'D4', 'E4'],
      }),
    ).toThrow(RangeError);
  });

  it('returns null for non-cadential chord qualities and roots', () => {
    expect(
      cMajor.identifyCadence(Chord.create('Db4', 'major'), Chord.create('C4', 'major')),
    ).toBeNull();
    expect(
      cMajor.identifyCadence(Chord.create('C4', 'major'), Chord.create('B4', 'diminished')),
    ).toBeNull();
    expect(
      cMajor.identifyCadence(Chord.create('C4', 'major'), Chord.create('C4', 'augmented')),
    ).toBeNull();
    expect(
      cMajor.identifyCadence(Chord.create('C4', 'major'), Chord.create('G4', 'sus4')),
    ).toBeNull();
  });
});

describe('identifyCadenceSequence', () => {
  it('finds cadences in adjacent pairs of a longer progression', () => {
    const cMajor = Key.create('C', 'major');
    const sequence = cMajor.identifyCadenceSequence(['I', 'IV', 'I', 'ii', 'V', 'vi']);

    expect(sequence).toEqual([
      {
        type: 'plagal',
        startIndex: 1,
        endIndex: 2,
        from: 'IV',
        to: 'I',
      },
      {
        type: 'half',
        startIndex: 3,
        endIndex: 4,
        from: 'ii',
        to: 'V',
      },
      {
        type: 'deceptive',
        startIndex: 4,
        endIndex: 5,
        from: 'V',
        to: 'vi',
      },
    ] satisfies CadenceOccurrence[]);
  });

  it('is also available as a free function', () => {
    const cMajor = Key.create('C', 'major');
    expect(identifyCadenceSequence(cMajor, ['V', 'I']).map((cadence) => cadence.type)).toEqual([
      'authentic-perfect',
    ]);
  });
});
