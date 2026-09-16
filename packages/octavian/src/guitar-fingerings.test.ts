import { describe, expect, it } from 'bun:test';
import {
  guitarFingeringsFor,
  type GuitarFingering,
  type GuitarFingeringOptions,
} from './guitar-fingerings.js';
import { Note } from './note.js';

function takeFingerings(
  chord: string,
  options: GuitarFingeringOptions,
  count: number,
): GuitarFingering[] {
  const results: GuitarFingering[] = [];
  for (const fingering of guitarFingeringsFor(chord, options)) {
    results.push(fingering);
    if (results.length === count) break;
  }
  return results;
}

function fingeringFor(
  chord: string,
  frets: readonly (number | null)[],
  options: GuitarFingeringOptions = {},
): GuitarFingering | undefined {
  for (const fingering of guitarFingeringsFor(chord, options)) {
    if (JSON.stringify(fingering.frets) === JSON.stringify(frets)) return fingering;
  }
  return undefined;
}

function includesFingering(
  chord: string,
  frets: readonly (number | null)[],
  options: GuitarFingeringOptions = {},
): boolean {
  return fingeringFor(chord, frets, options) !== undefined;
}

describe('guitarFingeringsFor', () => {
  it('finds the familiar open C shape first', () => {
    const first = guitarFingeringsFor('C')[Symbol.iterator]().next().value;
    expect(first).toBeDefined();
    expect(first?.frets).toEqual([0, 3, 2, 0, 1, 0]);
    expect(first?.bass.note).toBe('E');
    expect(first?.barres).toHaveLength(0);
  });

  it('includes common open and barre shapes with concrete finger assignments', () => {
    const openC = fingeringFor('C', [null, 3, 2, 0, 1, 0], { maxFret: 3 });
    expect(openC?.fingers).toEqual([null, 3, 2, null, 1, null]);
    expect(openC?.notes.map(String)).toEqual(['C3', 'E3', 'G3', 'C4', 'E4']);

    const partialBarreA = fingeringFor('A', [0, 0, 2, 2, 2, 0], { maxFret: 2 });
    expect(partialBarreA?.fingers).toEqual([null, null, 1, 1, 1, null]);
    expect(partialBarreA?.barres).toEqual([{ finger: 1, fret: 2, fromString: 2, toString: 4 }]);

    const fullBarreF = fingeringFor('F', [1, 3, 3, 2, 1, 1], { maxFret: 3 });
    expect(fullBarreF?.fingers).toEqual([1, 3, 3, 2, 1, 1]);
    expect(fullBarreF?.barres).toEqual([
      { finger: 1, fret: 1, fromString: 0, toString: 5 },
      { finger: 3, fret: 3, fromString: 1, toString: 2 },
    ]);
  });

  it('snapshots mutable options before iteration', () => {
    const options = { maxFret: 3 };
    const iterator = guitarFingeringsFor('C', options)[Symbol.iterator]();
    options.maxFret = 0;
    expect(iterator.next().value?.frets).toEqual([0, 3, 2, 0, 1, 0]);
  });

  it('rejects invalid ranges and tunings immediately', () => {
    expect(() => guitarFingeringsFor('C', { minFret: 4, maxFret: 2 })).toThrow(RangeError);
    expect(() => guitarFingeringsFor('C', { minFret: 1.5 })).toThrow(RangeError);
    expect(() => guitarFingeringsFor('C', { availableFingers: 5 })).toThrow(RangeError);
    expect(() => guitarFingeringsFor('C', { tuning: { strings: [] } })).toThrow(TypeError);
    expect(() =>
      guitarFingeringsFor('C', {
        allowBarres: 'yes',
      } as unknown as GuitarFingeringOptions),
    ).toThrow(TypeError);
    expect(() =>
      guitarFingeringsFor('C', {
        omissions: 'sometimes',
      } as unknown as GuitarFingeringOptions),
    ).toThrow(TypeError);
  });

  it('locks the bass for slash chords', () => {
    for (const fingering of guitarFingeringsFor('C/E', { maxFret: 5 })) {
      expect(fingering.bass.chromaticIndex).toBe(4);
    }
  });

  it('supports custom reentrant tunings and high neck searches', () => {
    const results = [
      ...guitarFingeringsFor('C', {
        tuning: { strings: ['G4', 'C4', 'E4', 'A4'] },
        minFret: 12,
        maxFret: 15,
      }),
    ];
    expect(results.every((result) => result.frets.length === 4)).toBe(true);
  });

  it('accepts documented Note-like tuning entries', () => {
    const results = [
      ...guitarFingeringsFor('C', {
        tuning: {
          strings: [Note.create('C3'), Note.create('E3').toJSON(), { note: 'G', octave: 3 }, 'C'],
        },
        maxFret: 0,
        omissions: 'none',
      }),
    ];

    expect(results.map((result) => result.frets)).toContainEqual([0, 0, 0, 0]);
    expect(
      results.find((result) => result.frets.every((fret) => fret === 0))?.notes.map(String),
    ).toEqual(['C3', 'E3', 'G3', 'C4']);
  });

  it('enforces finger reach and barre settings', () => {
    expect(includesFingering('C', [null, 3, 2, 0, 1, 0], { maxFret: 3, maxFretSpan: 1 })).toBe(
      false,
    );
    expect(includesFingering('F', [1, 3, null, 2, 1, 1], { maxFret: 3, availableFingers: 3 })).toBe(
      false,
    );
    expect(
      [...guitarFingeringsFor('C', { allowBarres: false, maxFret: 3 })].every(
        (result) => result.barres.length === 0,
      ),
    ).toBe(true);
  });

  it('rejects full barres that would cross open strings or mutes', () => {
    const openCrossingF = fingeringFor('F', [1, 0, 3, 2, 1, 1], { maxFret: 3 });
    expect(openCrossingF?.barres).toEqual([{ finger: 2, fret: 1, fromString: 4, toString: 5 }]);

    const mutedCrossingBb = fingeringFor('Bb', [1, 1, null, 3, 3, 1], { maxFret: 3 });
    expect(mutedCrossingBb?.barres).toEqual([
      { finger: 1, fret: 1, fromString: 0, toString: 1 },
      { finger: 3, fret: 3, fromString: 3, toString: 4 },
    ]);
  });

  it('orders unique shapes by lowest stopped fret and lexicographic fret pattern with nulls last', () => {
    const shapes = takeFingerings('C', { maxFret: 3 }, 8).map((fingering) => fingering.frets);
    expect(new Set(shapes.map((shape) => JSON.stringify(shape))).size).toBe(shapes.length);
    expect(shapes).toEqual([
      [0, 3, 2, 0, 1, 0],
      [0, 3, 2, 0, 1, 3],
      [0, 3, 2, 0, 1, null],
      [0, 3, 2, null, 1, 0],
      [0, 3, 2, null, 1, 3],
      [0, 3, 2, null, 1, null],
      [0, 3, null, 0, 1, 0],
      [0, 3, null, 0, 1, 3],
    ]);
  });

  it('clamps huge fret ranges to MIDI-reachable frets before iteration', () => {
    const iterator = guitarFingeringsFor('C', {
      tuning: { strings: ['C9'] },
      minFret: 8,
      maxFret: 1_000_000_000,
    })[Symbol.iterator]();

    expect(iterator.next()).toEqual({ done: true, value: undefined });
  });
});
