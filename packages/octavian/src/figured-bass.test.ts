import * as fc from 'fast-check';
import { describe, expect, it } from 'bun:test';

import { Chord } from './chord.js';
import {
  figuredBassForCardinality,
  figuredBassInversionForCardinality,
} from './figured-bass-figures.js';
import {
  figuredBassForChord,
  figuredBassInversionFor,
  figuredBassToChord,
  formatFiguredBass,
  parseFiguredBass,
  type FiguredBass,
  type FiguredBassFigure,
  type FiguredBassInversion,
} from './figured-bass.js';
import { Key } from './key.js';

describe('parseFiguredBass — inline strings', () => {
  it.each([
    ['', []],
    ['5/3', [{ digit: 5 }, { digit: 3 }]],
    ['6', [{ digit: 6 }]],
    ['6/4', [{ digit: 6 }, { digit: 4 }]],
    ['7', [{ digit: 7 }]],
    ['6/5', [{ digit: 6 }, { digit: 5 }]],
    ['4/3', [{ digit: 4 }, { digit: 3 }]],
    ['4/2', [{ digit: 4 }, { digit: 2 }]],
  ] as const)('parses %p into %p', (input: string, expected: FiguredBass) => {
    expect(parseFiguredBass(input)).toEqual(expected);
  });

  it.each([
    ['♭7', [{ digit: 7, accidental: 'flat' }]],
    ['#6', [{ digit: 6, accidental: 'sharp' }]],
    ['6♯', [{ digit: 6, accidental: 'sharp' }]],
    ['b7', [{ digit: 7, accidental: 'flat' }]],
    ['♮3', [{ digit: 3, accidental: 'natural' }]],
    ['n3', [{ digit: 3, accidental: 'natural' }]],
  ] as const)('parses accidental %p', (input: string, expected: FiguredBass) => {
    expect(parseFiguredBass(input)).toEqual(expected);
  });

  it('parses a stack with a flat on the upper figure', () => {
    expect(parseFiguredBass('♭6/4')).toEqual([{ digit: 6, accidental: 'flat' }, { digit: 4 }]);
  });

  it('trims surrounding whitespace', () => {
    expect(parseFiguredBass('  6/4  ')).toEqual([{ digit: 6 }, { digit: 4 }]);
  });
});

describe('parseFiguredBass — array forms', () => {
  it('accepts an array of strings', () => {
    expect(parseFiguredBass(['6', '4'])).toEqual([{ digit: 6 }, { digit: 4 }]);
  });

  it('accepts a mix of strings and figure objects', () => {
    expect(parseFiguredBass(['♭7', { digit: 5 }])).toEqual([
      { digit: 7, accidental: 'flat' },
      { digit: 5 },
    ]);
  });
});

describe('parseFiguredBass — error paths', () => {
  it.each(['x', '6x', '/', '0', '10', 'b'])('rejects invalid figure %p', (input: string) => {
    expect(() => parseFiguredBass(input)).toThrow(TypeError);
  });

  it('rejects an empty figure inside a stack', () => {
    expect(() => parseFiguredBass('6/')).toThrow(TypeError);
  });

  it.each(['#♭7', '♭#7', '♮♭6', 'b#7', 'bn3'])(
    'rejects multiple accidentals on a single figure (%p)',
    (input: string) => {
      expect(() => parseFiguredBass(input)).toThrow(TypeError);
    },
  );
});

describe('formatFiguredBass', () => {
  it.each([
    [[], { stacked: [], inline: '' }],
    [[{ digit: 6 }], { stacked: ['6'], inline: '6' }],
    [[{ digit: 6 }, { digit: 4 }], { stacked: ['6', '4'], inline: '6/4' }],
    [[{ digit: 4 }, { digit: 2 }], { stacked: ['4', '2'], inline: '4/2' }],
  ] as const)('renders %p as %p', (figures: FiguredBass, expected) => {
    expect(formatFiguredBass(figures)).toEqual(expected);
  });

  it('places sharps before the digit', () => {
    expect(formatFiguredBass([{ digit: 6, accidental: 'sharp' }])).toEqual({
      stacked: ['♯6'],
      inline: '♯6',
    });
  });

  it('places flats before the digit (matches the canonical parser input form)', () => {
    expect(formatFiguredBass([{ digit: 7, accidental: 'flat' }])).toEqual({
      stacked: ['♭7'],
      inline: '♭7',
    });
  });

  it('places naturals before the digit', () => {
    expect(formatFiguredBass([{ digit: 3, accidental: 'natural' }])).toEqual({
      stacked: ['♮3'],
      inline: '♮3',
    });
  });

  it('throws on an unknown accidental value (defensive, type-system bypass)', () => {
    expect(() =>
      // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
      formatFiguredBass([{ digit: 6, accidental: 'bogus' as never }]),
    ).toThrow(TypeError);
  });
});

describe('figuredBassForChord and figuredBassInversionFor — triads', () => {
  it.each([
    [0, [], '5/3'],
    [1, [{ digit: 6 }], '6'],
    [2, [{ digit: 6 }, { digit: 4 }], '6/4'],
  ] as const)(
    'reports the figure %p and shorthand %p for inversion %p of a major triad',
    (inversion: number, figures: FiguredBass, shorthand: FiguredBassInversion) => {
      // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
      const chord = Chord.create('C4', 'major').inversion(inversion as never);
      expect(figuredBassForChord(chord)).toEqual(figures);
      expect(figuredBassInversionFor(chord)).toBe(shorthand);
    },
  );
});

describe('figuredBassForChord and figuredBassInversionFor — seventh chords', () => {
  it.each([
    [0, [{ digit: 7 }], '7'],
    [1, [{ digit: 6 }, { digit: 5 }], '6/5'],
    [2, [{ digit: 4 }, { digit: 3 }], '4/3'],
    [3, [{ digit: 4 }, { digit: 2 }], '4/2'],
  ] as const)(
    'reports the figure %p and shorthand %p for inversion %p of a dominant 7th',
    (inversion: number, figures: FiguredBass, shorthand: FiguredBassInversion) => {
      // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
      const chord = Chord.create('G4', 'dominantSeventh').inversion(inversion as never);
      expect(figuredBassForChord(chord)).toEqual(figures);
      expect(figuredBassInversionFor(chord)).toBe(shorthand);
    },
  );
});

describe('figuredBassForChord — error paths', () => {
  it('throws on an extended chord (more than 4 notes)', () => {
    const ninth = Chord.create('C4', 'majorNinth');
    expect(() => figuredBassForChord(ninth)).toThrow(RangeError);
    expect(() => figuredBassInversionFor(ninth)).toThrow(RangeError);
  });
});

describe('figured-bass-figures direct API', () => {
  // The leaf module accepts any `FiguredBassInversionIndex`. The
  // public path through `Chord` and `figuredBassForChord` narrows
  // before calling, so triad-with-inversion-3 is unreachable from
  // those entry points. The leaf function still validates and throws.
  it('rejects triad inversion 3 when called directly', () => {
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
    expect(() => figuredBassForCardinality('triad', 3 as never)).toThrow(RangeError);
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
    expect(() => figuredBassInversionForCardinality('triad', 3 as never)).toThrow(RangeError);
  });

  it('returns frozen arrays so callers cannot mutate the shared lookup data', () => {
    const figures = figuredBassForCardinality('triad', 1);
    expect(Object.isFrozen(figures)).toBe(true);
    // The inner figure objects are also frozen. Attempting to mutate
    // them throws in strict mode, which `bun:test` runs by default.
    if (figures.length > 0) {
      const first = figures[0];
      if (first !== undefined) {
        expect(Object.isFrozen(first)).toBe(true);
      }
    }
  });
});

describe('Chord.figuredBass and Chord.figuredBassInversion (delegators)', () => {
  it('delegates to the same mapping as the free functions', () => {
    const triad = Chord.create('C4', 'major').inversion(1);
    expect(triad.figuredBass()).toEqual([{ digit: 6 }]);
    expect(triad.figuredBassInversion()).toBe('6');

    const seventh = Chord.create('G4', 'dominantSeventh').inversion(2);
    expect(seventh.figuredBass()).toEqual([{ digit: 4 }, { digit: 3 }]);
    expect(seventh.figuredBassInversion()).toBe('4/3');
  });

  it('throws RangeError for non-triad/seventh chords', () => {
    const ninth = Chord.create('C4', 'majorNinth');
    expect(() => ninth.figuredBass()).toThrow(RangeError);
    expect(() => ninth.figuredBassInversion()).toThrow(RangeError);
  });
});

describe('figuredBassToChord', () => {
  const cMajor = Key.create('C', 'major');

  it('resolves the empty figure to the diatonic root-position triad', () => {
    const chord = figuredBassToChord('C4', '', cMajor);
    expect(chord.bass.toString()).toBe('C4');
    expect(chord.inversionIndex).toBe(0);
    expect(chord.intervals).toHaveLength(3);
  });

  it('resolves the explicit 5/3 figure to the same chord as the empty figure', () => {
    const explicit = figuredBassToChord('C4', '5/3', cMajor);
    const implicit = figuredBassToChord('C4', '', cMajor);
    expect(explicit.bass.toString()).toBe(implicit.bass.toString());
    expect(explicit.inversionIndex).toBe(implicit.inversionIndex);
    expect(explicit.root.note).toBe(implicit.root.note);
  });

  it('preserves the requested bass octave on the returned chord', () => {
    // The diatonic-default register puts G4 first inversion at G4
    // (B as bass). Asking for C2 must return a chord whose bass is
    // C2, not C4 from the default register.
    const lowChord = figuredBassToChord('C2', '', cMajor);
    expect(lowChord.bass.toString()).toBe('C2');
    expect(lowChord.inversionIndex).toBe(0);

    const highChord = figuredBassToChord('E6', '6', cMajor);
    expect(highChord.bass.toString()).toBe('E6');
    expect(highChord.inversionIndex).toBe(1);
  });

  it('resolves 6 to the first-inversion diatonic triad', () => {
    // E in the bass with no figure other than 6 → I in first inversion
    // (C major triad with E at the bottom).
    const chord = figuredBassToChord('E4', '6', cMajor);
    expect(chord.bass.toString()).toBe('E4');
    expect(chord.inversionIndex).toBe(1);
  });

  it('resolves 6/4 to the second-inversion diatonic triad', () => {
    const chord = figuredBassToChord('G4', '6/4', cMajor);
    expect(chord.bass.toString()).toBe('G4');
    expect(chord.inversionIndex).toBe(2);
  });

  it('resolves 7 to the diatonic seventh chord', () => {
    const chord = figuredBassToChord('G4', '7', cMajor);
    expect(chord.bass.toString()).toBe('G4');
    expect(chord.inversionIndex).toBe(0);
    expect(chord.intervals).toHaveLength(4);
  });

  it.each([
    ['B4', '6/5'],
    ['D5', '4/3'],
    ['F5', '4/2'],
  ] as const)(
    'resolves %p with figure %p to a seventh-chord inversion',
    (bass: string, figure: string) => {
      const chord = figuredBassToChord(bass, figure, cMajor);
      expect(chord.intervals).toHaveLength(4);
    },
  );

  it('accepts a stacked array form', () => {
    const chord = figuredBassToChord('E4', ['6'], cMajor);
    expect(chord.inversionIndex).toBe(1);
  });

  it.each([
    ['', 'root'],
    ['6', 'first-inversion'],
    ['6/4', 'second-inversion'],
    ['7', 'root'],
    ['6/5', 'first-inversion'],
    ['4/3', 'second-inversion'],
    ['4/2', 'third-inversion'],
  ] as const)(
    'throws with the %p (%p) ordinal when no diatonic chord matches',
    (figure: string, ordinal: string) => {
      // C# is non-diatonic in C major, so no diatonic chord at any
      // inversion has it at the bass. The error message must include
      // the ordinal phrase corresponding to the figure.
      try {
        figuredBassToChord('C#4', figure, cMajor);
        throw new Error('expected figuredBassToChord to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(TypeError);
        expect((error as TypeError).message).toContain(ordinal);
      }
    },
  );

  it('throws when the figure pattern is not a standard inversion', () => {
    expect(() => figuredBassToChord('C4', '9', cMajor)).toThrow(TypeError);
    expect(() => figuredBassToChord('C4', '6/3', cMajor)).toThrow(TypeError);
    expect(() => figuredBassToChord('C4', '5/4/3', cMajor)).toThrow(TypeError);
  });

  it('throws when an accidental is on a figure (deferred feature)', () => {
    expect(() => figuredBassToChord('C4', '♭7', cMajor)).toThrow(TypeError);
  });

  it('resolves correctly in a minor key', () => {
    const aMinor = Key.create('A', 'minor');
    // E in the bass with figure 6 → first-inversion diatonic triad
    // built on C (i.e., C major in first inversion = III⁶ of A minor).
    // The returned chord matches by pitch class; the octave reflects
    // the chord's construction off the scale tonic, which puts the
    // III triad in the next octave above the tonic.
    const chord = figuredBassToChord('E4', '6', aMinor);
    expect(chord.bass.note).toBe('E');
    expect(chord.inversionIndex).toBe(1);
  });
});

describe('figuredBass round-trip', () => {
  it('parse → format round-trips on standard inversions', () => {
    for (const inline of ['', '5/3', '6', '6/4', '7', '6/5', '4/3', '4/2']) {
      expect(formatFiguredBass(parseFiguredBass(inline)).inline).toBe(inline);
    }
  });

  it('chord → figure → chord round-trips on every diatonic triad in C major', () => {
    const cMajor = Key.create('C', 'major');
    for (const triad of cMajor.diatonicChords()) {
      for (const inversion of [0, 1, 2] as const) {
        const inverted = triad.inversion(inversion);
        const figures = figuredBassForChord(inverted);
        const recovered = figuredBassToChord(inverted.bass, figures, cMajor);
        expect(recovered.bass.note).toBe(inverted.bass.note);
        expect(recovered.inversionIndex).toBe(inversion);
        expect(recovered.root.note).toBe(inverted.root.note);
      }
    }
  });

  it('chord → figure → chord round-trips on every diatonic seventh in C major', () => {
    const cMajor = Key.create('C', 'major');
    for (const seventh of cMajor.diatonicSeventhChords()) {
      for (const inversion of [0, 1, 2, 3] as const) {
        const inverted = seventh.inversion(inversion);
        const figures = figuredBassForChord(inverted);
        const recovered = figuredBassToChord(inverted.bass, figures, cMajor);
        expect(recovered.bass.note).toBe(inverted.bass.note);
        expect(recovered.inversionIndex).toBe(inversion);
        expect(recovered.root.note).toBe(inverted.root.note);
      }
    }
  });
});

describe('figuredBass — property tests', () => {
  it('formatFiguredBass → parseFiguredBass round-trips for any single figure', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(1, 2, 3, 4, 5, 6, 7, 8, 9 as const),
        fc.constantFrom(undefined, 'sharp' as const, 'flat' as const, 'natural' as const),
        (digit, accidental) => {
          // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
          const typedDigit = digit as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
          const figure: FiguredBassFigure =
            accidental === undefined ? { digit: typedDigit } : { digit: typedDigit, accidental };
          const formatted = formatFiguredBass([figure]);
          const reparsed = parseFiguredBass(formatted.inline);
          expect(reparsed).toEqual([figure]);
        },
      ),
      { numRuns: 50 },
    );
  });
});
