import { describe, expect, it } from 'bun:test';
import * as fc from 'fast-check';

import { formatNoteName, parseNoteNameLabel } from './note-naming.js';

// ---------------------------------------------------------------------------
// English system
// ---------------------------------------------------------------------------

describe('formatNoteName — english', () => {
  it('C is C', () => expect(formatNoteName('C', 'english')).toBe('C'));
  it('C# is C#', () => expect(formatNoteName('C#', 'english')).toBe('C#'));
  it('Bb is Bb', () => expect(formatNoteName('Bb', 'english')).toBe('Bb'));
  it('F## is F##', () => expect(formatNoteName('F##', 'english')).toBe('F##'));
  it('B is B', () => expect(formatNoteName('B', 'english')).toBe('B'));
  it('Bb is Bb (English has no renaming)', () =>
    expect(formatNoteName('Bb', 'english')).toBe('Bb'));
});

describe('parseNoteNameLabel — english', () => {
  it('parses C', () => expect(parseNoteNameLabel('C', 'english')).toBe('C'));
  it('parses C#', () => expect(parseNoteNameLabel('C#', 'english')).toBe('C#'));
  it('parses Bb', () => expect(parseNoteNameLabel('Bb', 'english')).toBe('Bb'));
  it('parses F##', () => expect(parseNoteNameLabel('F##', 'english')).toBe('F##'));
  it('throws for unrecognized label', () => {
    expect(() => parseNoteNameLabel('X', 'english')).toThrow(TypeError);
  });
});

describe('formatNoteName ↔ parseNoteNameLabel round-trip — english', () => {
  const notes = ['C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  for (const note of notes) {
    it(`round-trips ${note}`, () => {
      const label = formatNoteName(note, 'english');
      const parsed = parseNoteNameLabel(label, 'english');
      expect(parsed).toBe(note);
    });
  }
});

// ---------------------------------------------------------------------------
// German system
// ---------------------------------------------------------------------------

describe('formatNoteName — german', () => {
  it('B-natural → H', () => expect(formatNoteName('B', 'german')).toBe('H'));
  it('Bb → B (German convention)', () => expect(formatNoteName('Bb', 'german')).toBe('B'));
  it('B# → H#', () => expect(formatNoteName('B#', 'german')).toBe('H#'));
  it('Bbb → Hbb', () => expect(formatNoteName('Bbb', 'german')).toBe('Hbb'));
  it('C → C (unchanged)', () => expect(formatNoteName('C', 'german')).toBe('C'));
  it('C# → C# (unchanged)', () => expect(formatNoteName('C#', 'german')).toBe('C#'));
  it('Ab → Ab (unchanged)', () => expect(formatNoteName('Ab', 'german')).toBe('Ab'));
  it('A → A (unchanged)', () => expect(formatNoteName('A', 'german')).toBe('A'));
});

describe('parseNoteNameLabel — german', () => {
  it('H → B-natural', () => expect(parseNoteNameLabel('H', 'german')).toBe('B'));
  it('B → Bb (German convention)', () => expect(parseNoteNameLabel('B', 'german')).toBe('Bb'));
  it('H# → B#', () => expect(parseNoteNameLabel('H#', 'german')).toBe('B#'));
  it('Hb → Bb', () => expect(parseNoteNameLabel('Hb', 'german')).toBe('Bb'));
  it('Hbb → Bbb', () => expect(parseNoteNameLabel('Hbb', 'german')).toBe('Bbb'));
  it('C → C', () => expect(parseNoteNameLabel('C', 'german')).toBe('C'));
  it('Ab → Ab', () => expect(parseNoteNameLabel('Ab', 'german')).toBe('Ab'));
  it('throws for unrecognized label', () => {
    expect(() => parseNoteNameLabel('Z', 'german')).toThrow(TypeError);
  });
  it('throws for H with invalid accidental', () => {
    expect(() => parseNoteNameLabel('Hx', 'german')).toThrow(TypeError);
  });
});

describe('formatNoteName ↔ parseNoteNameLabel round-trip — german', () => {
  // B-natural and B-flat have unambiguous German round-trips
  it('round-trips B-natural via H', () => {
    expect(parseNoteNameLabel(formatNoteName('B', 'german'), 'german')).toBe('B');
  });

  it('round-trips Bb via bare B', () => {
    expect(parseNoteNameLabel(formatNoteName('Bb', 'german'), 'german')).toBe('Bb');
  });

  it('round-trips C', () => {
    expect(parseNoteNameLabel(formatNoteName('C', 'german'), 'german')).toBe('C');
  });

  it('round-trips F#', () => {
    expect(parseNoteNameLabel(formatNoteName('F#', 'german'), 'german')).toBe('F#');
  });
});

// ---------------------------------------------------------------------------
// Northern European system
// ---------------------------------------------------------------------------

describe('formatNoteName — northernEuropean', () => {
  it('B-natural → H', () => expect(formatNoteName('B', 'northernEuropean')).toBe('H'));
  it('Bb → Hb (different from German)', () =>
    expect(formatNoteName('Bb', 'northernEuropean')).toBe('Hb'));
  it('B# → H#', () => expect(formatNoteName('B#', 'northernEuropean')).toBe('H#'));
  it('C → C (unchanged)', () => expect(formatNoteName('C', 'northernEuropean')).toBe('C'));
  it('Ab → Ab (unchanged)', () => expect(formatNoteName('Ab', 'northernEuropean')).toBe('Ab'));
});

describe('parseNoteNameLabel — northernEuropean', () => {
  it('H → B-natural', () => expect(parseNoteNameLabel('H', 'northernEuropean')).toBe('B'));
  it('Hb → Bb', () => expect(parseNoteNameLabel('Hb', 'northernEuropean')).toBe('Bb'));
  it('H# → B#', () => expect(parseNoteNameLabel('H#', 'northernEuropean')).toBe('B#'));
  it('C → C', () => expect(parseNoteNameLabel('C', 'northernEuropean')).toBe('C'));
  it('throws for H with invalid accidental', () => {
    expect(() => parseNoteNameLabel('Hq', 'northernEuropean')).toThrow(TypeError);
  });
});

describe('formatNoteName ↔ parseNoteNameLabel round-trip — northernEuropean', () => {
  const notes = ['B', 'Bb', 'B#', 'C', 'F#', 'Ab', 'D'];
  for (const note of notes) {
    it(`round-trips ${note}`, () => {
      const label = formatNoteName(note, 'northernEuropean');
      const parsed = parseNoteNameLabel(label, 'northernEuropean');
      expect(parsed).toBe(note);
    });
  }
});

// ---------------------------------------------------------------------------
// Fixed-do system
// ---------------------------------------------------------------------------

describe('formatNoteName — fixedDo', () => {
  it('C → Do', () => expect(formatNoteName('C', 'fixedDo')).toBe('Do'));
  it('D → Re', () => expect(formatNoteName('D', 'fixedDo')).toBe('Re'));
  it('E → Mi', () => expect(formatNoteName('E', 'fixedDo')).toBe('Mi'));
  it('F → Fa', () => expect(formatNoteName('F', 'fixedDo')).toBe('Fa'));
  it('G → Sol', () => expect(formatNoteName('G', 'fixedDo')).toBe('Sol'));
  it('A → La', () => expect(formatNoteName('A', 'fixedDo')).toBe('La'));
  it('B → Si', () => expect(formatNoteName('B', 'fixedDo')).toBe('Si'));
  it('C# → Do#', () => expect(formatNoteName('C#', 'fixedDo')).toBe('Do#'));
  it('Bb → Sib', () => expect(formatNoteName('Bb', 'fixedDo')).toBe('Sib'));
  it('F# → Fa#', () => expect(formatNoteName('F#', 'fixedDo')).toBe('Fa#'));
});

describe('parseNoteNameLabel — fixedDo', () => {
  it('Do → C', () => expect(parseNoteNameLabel('Do', 'fixedDo')).toBe('C'));
  it('Re → D', () => expect(parseNoteNameLabel('Re', 'fixedDo')).toBe('D'));
  it('Mi → E', () => expect(parseNoteNameLabel('Mi', 'fixedDo')).toBe('E'));
  it('Fa → F', () => expect(parseNoteNameLabel('Fa', 'fixedDo')).toBe('F'));
  it('Sol → G', () => expect(parseNoteNameLabel('Sol', 'fixedDo')).toBe('G'));
  it('La → A', () => expect(parseNoteNameLabel('La', 'fixedDo')).toBe('A'));
  it('Si → B', () => expect(parseNoteNameLabel('Si', 'fixedDo')).toBe('B'));
  it('Do# → C#', () => expect(parseNoteNameLabel('Do#', 'fixedDo')).toBe('C#'));
  it('Sib → Bb', () => expect(parseNoteNameLabel('Sib', 'fixedDo')).toBe('Bb'));
  it('Fa# → F#', () => expect(parseNoteNameLabel('Fa#', 'fixedDo')).toBe('F#'));
  it('throws for unrecognized label', () => {
    expect(() => parseNoteNameLabel('Xyz', 'fixedDo')).toThrow(TypeError);
  });
});

describe('formatNoteName ↔ parseNoteNameLabel round-trip — fixedDo', () => {
  const notes = ['C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  for (const note of notes) {
    it(`round-trips ${note}`, () => {
      const label = formatNoteName(note, 'fixedDo');
      const parsed = parseNoteNameLabel(label, 'fixedDo');
      expect(parsed).toBe(note);
    });
  }
});

// ---------------------------------------------------------------------------
// Property-based tests
// ---------------------------------------------------------------------------

describe('property tests', () => {
  const ALL_NOTES = [
    'C',
    'C#',
    'Db',
    'D',
    'D#',
    'Eb',
    'E',
    'Fb',
    'F',
    'F#',
    'Gb',
    'G',
    'G#',
    'Ab',
    'A',
    'A#',
    'Bb',
    'B',
  ] as const;

  it('english: formatNoteName and parseNoteNameLabel round-trip for all natural + accidental notes', () => {
    fc.assert(
      fc.property(fc.constantFrom(...ALL_NOTES), (note) => {
        const label = formatNoteName(note, 'english');
        const parsed = parseNoteNameLabel(label, 'english');
        return parsed === note;
      }),
      { numRuns: 50 },
    );
  });

  it('fixedDo: formatNoteName and parseNoteNameLabel round-trip for all notes', () => {
    fc.assert(
      fc.property(fc.constantFrom(...ALL_NOTES), (note) => {
        const label = formatNoteName(note, 'fixedDo');
        const parsed = parseNoteNameLabel(label, 'fixedDo');
        return parsed === note;
      }),
      { numRuns: 50 },
    );
  });

  it('northernEuropean: formatNoteName and parseNoteNameLabel round-trip', () => {
    fc.assert(
      fc.property(fc.constantFrom(...ALL_NOTES), (note) => {
        const label = formatNoteName(note, 'northernEuropean');
        const parsed = parseNoteNameLabel(label, 'northernEuropean');
        return parsed === note;
      }),
      { numRuns: 50 },
    );
  });
});
