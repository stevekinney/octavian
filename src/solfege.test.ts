import { describe, expect, it } from 'bun:test';
import * as fc from 'fast-check';

import { Key } from './key.js';
import { Scale } from './scale.js';
import { formatSolfege, parseSolfege } from './solfege.js';

const cMajor = Key.create('C', 'major');
const gMajor = Key.create('G', 'major');
const aMinor = Key.create('A', 'minor');

// ---------------------------------------------------------------------------
// fixedDo — C is always do
// ---------------------------------------------------------------------------

describe('formatSolfege — fixedDo', () => {
  it('C → do', () => expect(formatSolfege('C', 'fixedDo')).toBe('do'));
  it('D → re', () => expect(formatSolfege('D', 'fixedDo')).toBe('re'));
  it('E → mi', () => expect(formatSolfege('E', 'fixedDo')).toBe('mi'));
  it('F → fa', () => expect(formatSolfege('F', 'fixedDo')).toBe('fa'));
  it('G → sol', () => expect(formatSolfege('G', 'fixedDo')).toBe('sol'));
  it('A → la', () => expect(formatSolfege('A', 'fixedDo')).toBe('la'));
  it('B → ti', () => expect(formatSolfege('B', 'fixedDo')).toBe('ti'));

  it('C# → di (raised do)', () => expect(formatSolfege('C#', 'fixedDo')).toBe('di'));
  it('Db → ra (lowered re)', () => expect(formatSolfege('Db', 'fixedDo')).toBe('ra'));
  it('Eb → me (lowered mi)', () => expect(formatSolfege('Eb', 'fixedDo')).toBe('me'));
  it('F# → fi (raised fa)', () => expect(formatSolfege('F#', 'fixedDo')).toBe('fi'));
  it('Ab → le (lowered la)', () => expect(formatSolfege('Ab', 'fixedDo')).toBe('le'));
  it('Bb → te (lowered ti)', () => expect(formatSolfege('Bb', 'fixedDo')).toBe('te'));
  it('G# → si (raised sol)', () => expect(formatSolfege('G#', 'fixedDo')).toBe('si'));

  it('context is ignored for fixedDo', () => {
    // C should still be 'do' regardless of context
    expect(formatSolfege('C', 'fixedDo', gMajor)).toBe('do');
    expect(formatSolfege('C', 'fixedDo', aMinor)).toBe('do');
  });
});

describe('parseSolfege — fixedDo', () => {
  it('do → C4', () => {
    const note = parseSolfege('do', 'fixedDo');
    expect('note' in note && (note as { note: string }).note).toBe('C');
  });
  it('re → D', () => {
    const note = parseSolfege('re', 'fixedDo');
    expect('note' in note && (note as { note: string }).note).toBe('D');
  });
  it('mi → E', () => {
    const note = parseSolfege('mi', 'fixedDo');
    expect('note' in note && (note as { note: string }).note).toBe('E');
  });
  it('fa → F', () => {
    const note = parseSolfege('fa', 'fixedDo');
    expect('note' in note && (note as { note: string }).note).toBe('F');
  });
  it('sol → G', () => {
    const note = parseSolfege('sol', 'fixedDo');
    expect('note' in note && (note as { note: string }).note).toBe('G');
  });
  it('la → A', () => {
    const note = parseSolfege('la', 'fixedDo');
    expect('note' in note && (note as { note: string }).note).toBe('A');
  });
  it('ti → B', () => {
    const note = parseSolfege('ti', 'fixedDo');
    expect('note' in note && (note as { note: string }).note).toBe('B');
  });
  it('di → C#', () => {
    const note = parseSolfege('di', 'fixedDo');
    expect('note' in note && (note as { note: string }).note).toBe('C#');
  });
  it('me → Eb', () => {
    const note = parseSolfege('me', 'fixedDo');
    expect('note' in note && (note as { note: string }).note).toBe('Eb');
  });
  it('throws for unknown syllable', () => {
    expect(() => parseSolfege('xyz', 'fixedDo')).toThrow(TypeError);
  });
});

// ---------------------------------------------------------------------------
// movableDo — C major: C=do, D=re, E=mi, G=sol
// ---------------------------------------------------------------------------

describe('formatSolfege — movableDo in C major', () => {
  it('C → do (tonic)', () => expect(formatSolfege('C', 'movableDo', cMajor)).toBe('do'));
  it('D → re', () => expect(formatSolfege('D', 'movableDo', cMajor)).toBe('re'));
  it('E → mi', () => expect(formatSolfege('E', 'movableDo', cMajor)).toBe('mi'));
  it('F → fa', () => expect(formatSolfege('F', 'movableDo', cMajor)).toBe('fa'));
  it('G → sol', () => expect(formatSolfege('G', 'movableDo', cMajor)).toBe('sol'));
  it('A → la', () => expect(formatSolfege('A', 'movableDo', cMajor)).toBe('la'));
  it('B → ti', () => expect(formatSolfege('B', 'movableDo', cMajor)).toBe('ti'));

  it('Eb → me (b3)', () => expect(formatSolfege('Eb', 'movableDo', cMajor)).toBe('me'));
  it('F# → fi (#4)', () => expect(formatSolfege('F#', 'movableDo', cMajor)).toBe('fi'));
  it('Bb → te (b7)', () => expect(formatSolfege('Bb', 'movableDo', cMajor)).toBe('te'));
  it('Ab → le (b6)', () => expect(formatSolfege('Ab', 'movableDo', cMajor)).toBe('le'));
  it('Db → ra (b2)', () => expect(formatSolfege('Db', 'movableDo', cMajor)).toBe('ra'));
  it('C# → di (#1)', () => expect(formatSolfege('C#', 'movableDo', cMajor)).toBe('di'));
  it('G# → si (#5)', () => expect(formatSolfege('G#', 'movableDo', cMajor)).toBe('si'));
});

// ---------------------------------------------------------------------------
// movableDo — G major: G=do, A=re, B=mi, C=fa, D=sol, E=la, F#=ti
// ---------------------------------------------------------------------------

describe('formatSolfege — movableDo in G major', () => {
  it('G → do (tonic)', () => expect(formatSolfege('G', 'movableDo', gMajor)).toBe('do'));
  it('A → re', () => expect(formatSolfege('A', 'movableDo', gMajor)).toBe('re'));
  it('B → mi', () => expect(formatSolfege('B', 'movableDo', gMajor)).toBe('mi'));
  it('C → fa', () => expect(formatSolfege('C', 'movableDo', gMajor)).toBe('fa'));
  it('D → sol', () => expect(formatSolfege('D', 'movableDo', gMajor)).toBe('sol'));
  it('E → la', () => expect(formatSolfege('E', 'movableDo', gMajor)).toBe('la'));
  it('F# → ti (diatonic in G major)', () =>
    expect(formatSolfege('F#', 'movableDo', gMajor)).toBe('ti'));
  it('F → te (b7 in G major)', () => expect(formatSolfege('F', 'movableDo', gMajor)).toBe('te'));
});

// ---------------------------------------------------------------------------
// movableDo — A natural minor (tonic-do)
// A=do, B=re, C=me (b3), D=fa, E=sol, F=le (b6), G=te (b7)
// ---------------------------------------------------------------------------

describe('formatSolfege — movableDo in A natural minor (tonic-do)', () => {
  it('A → do (tonic)', () => expect(formatSolfege('A', 'movableDo', aMinor)).toBe('do'));
  it('B → re', () => expect(formatSolfege('B', 'movableDo', aMinor)).toBe('re'));
  it('C → me (minor third = b3 → me)', () =>
    expect(formatSolfege('C', 'movableDo', aMinor)).toBe('me'));
  it('D → fa', () => expect(formatSolfege('D', 'movableDo', aMinor)).toBe('fa'));
  it('E → sol', () => expect(formatSolfege('E', 'movableDo', aMinor)).toBe('sol'));
  it('F → le (minor sixth = b6 → le)', () =>
    expect(formatSolfege('F', 'movableDo', aMinor)).toBe('le'));
  it('G → te (minor seventh = b7 → te)', () =>
    expect(formatSolfege('G', 'movableDo', aMinor)).toBe('te'));
});

// ---------------------------------------------------------------------------
// movableDo — accepts Scale directly
// ---------------------------------------------------------------------------

describe('formatSolfege — movableDo with Scale object', () => {
  it('works with a Scale object', () => {
    const scale = Scale.create('C', 'major');
    expect(formatSolfege('C', 'movableDo', scale)).toBe('do');
    expect(formatSolfege('G', 'movableDo', scale)).toBe('sol');
  });
});

// ---------------------------------------------------------------------------
// Error cases
// ---------------------------------------------------------------------------

describe('error cases', () => {
  it('formatSolfege movableDo without context throws', () => {
    expect(() => formatSolfege('C', 'movableDo')).toThrow(TypeError);
  });

  it('formatSolfege movableDo with non-heptatonic scale throws', () => {
    const pentatonic = Scale.create('C', 'majorPentatonic');
    expect(() => formatSolfege('C', 'movableDo', pentatonic)).toThrow(TypeError);
  });

  it('parseSolfege throws for unrecognized syllable', () => {
    expect(() => parseSolfege('boop', 'movableDo')).toThrow(TypeError);
  });
});

// ---------------------------------------------------------------------------
// parseSolfege — movableDo with context
// ---------------------------------------------------------------------------

describe('parseSolfege — movableDo with context', () => {
  it('do in C major → C', () => {
    const result = parseSolfege('do', 'movableDo', cMajor);
    expect('note' in result && (result as { note: string }).note).toBe('C');
  });

  it('do in G major → G', () => {
    const result = parseSolfege('do', 'movableDo', gMajor);
    expect('note' in result && (result as { note: string }).note).toBe('G');
  });

  it('ti in C major → B', () => {
    const result = parseSolfege('ti', 'movableDo', cMajor);
    expect('note' in result && (result as { note: string }).note).toBe('B');
  });

  it('me in C major → Eb (b3)', () => {
    const result = parseSolfege('me', 'movableDo', cMajor);
    expect('note' in result && (result as { note: string }).note).toBe('Eb');
  });
});

// ---------------------------------------------------------------------------
// parseSolfege — movableDo without context → ScaleDegreeAnalysis
// ---------------------------------------------------------------------------

describe('parseSolfege — movableDo without context', () => {
  it('do → {degree: 1, alteration: ""}', () => {
    const result = parseSolfege('do', 'movableDo');
    expect('degree' in result).toBe(true);
    if ('degree' in result) {
      expect(result.degree).toBe(1);
      expect(result.alteration).toBe('');
    }
  });

  it('re → {degree: 2, alteration: ""}', () => {
    const result = parseSolfege('re', 'movableDo');
    expect('degree' in result).toBe(true);
    if ('degree' in result) {
      expect(result.degree).toBe(2);
      expect(result.alteration).toBe('');
    }
  });

  it('me → {degree: 3, alteration: "b"}', () => {
    const result = parseSolfege('me', 'movableDo');
    expect('degree' in result).toBe(true);
    if ('degree' in result) {
      expect(result.degree).toBe(3);
      expect(result.alteration).toBe('b');
    }
  });

  it('ti → {degree: 7, alteration: ""}', () => {
    const result = parseSolfege('ti', 'movableDo');
    expect('degree' in result).toBe(true);
    if ('degree' in result) {
      expect(result.degree).toBe(7);
      expect(result.alteration).toBe('');
    }
  });

  it('di → {degree: 1, alteration: "#"}', () => {
    const result = parseSolfege('di', 'movableDo');
    expect('degree' in result).toBe(true);
    if ('degree' in result) {
      expect(result.degree).toBe(1);
      expect(result.alteration).toBe('#');
    }
  });

  it('fi → {degree: 4, alteration: "#"}', () => {
    const result = parseSolfege('fi', 'movableDo');
    expect('degree' in result).toBe(true);
    if ('degree' in result) {
      expect(result.degree).toBe(4);
      expect(result.alteration).toBe('#');
    }
  });
});

// ---------------------------------------------------------------------------
// Double/triple alterations in solfège (fallback labels)
// ---------------------------------------------------------------------------

describe('formatSolfege — double alterations', () => {
  it('Ebb in C major → mi(-2) (double-flat major reference)', () => {
    // Ebb is degree 3, semitone 2. Major[3]=4. offset = (2-4+12)%12 = 10 → -2.
    expect(formatSolfege('Ebb', 'movableDo', cMajor)).toBe('mi(-2)');
  });

  it('G## in C major → sol(+2) (double-sharp fifth)', () => {
    // G## is degree 5, semitone 9. Major[5]=7. offset = (9-7)%12 = 2.
    expect(formatSolfege('G##', 'movableDo', cMajor)).toBe('sol(+2)');
  });

  it('fixedDo: Ebb → mi(-2)', () => {
    expect(formatSolfege('Ebb', 'fixedDo')).toBe('mi(-2)');
  });

  it('fixedDo: G## → sol(+2)', () => {
    expect(formatSolfege('G##', 'fixedDo')).toBe('sol(+2)');
  });

  it('G### in C major → sol(+3) (triple-sharp fifth)', () => {
    // G### = degree 5, semitone 10. Major[5]=7. offset = (10-7)%12 = 3.
    expect(formatSolfege('G###', 'movableDo', cMajor)).toBe('sol(+3)');
  });

  it('Bbbb in C major → ti(-3) (triple-flat seventh — lowered, not +9)', () => {
    // Regression: a triple-flat is -3 semitones. Raw (semitone - major) % 12
    // = 9; the signed mapping must read that as -3, not +9.
    // Bbbb = degree 7, semitone 8. Major[7]=11. (8-11+12)%12 = 9 → -3.
    expect(formatSolfege('Bbbb', 'movableDo', cMajor)).toBe('ti(-3)');
  });

  it('fixedDo: Bbbb → ti(-3)', () => {
    expect(formatSolfege('Bbbb', 'fixedDo')).toBe('ti(-3)');
  });
});

// ---------------------------------------------------------------------------
// fixedDo round-trip: formatSolfege then parseSolfege
// ---------------------------------------------------------------------------

describe('fixedDo round-trip', () => {
  const diatonicNotes = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
  for (const note of diatonicNotes) {
    it(`round-trips ${note}`, () => {
      const syllable = formatSolfege(note, 'fixedDo');
      const result = parseSolfege(syllable, 'fixedDo');
      expect('note' in result && (result as { note: string }).note).toBe(note);
    });
  }
});

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe('property tests', () => {
  it('fixedDo: formatSolfege round-trips diatonic notes', () => {
    const diatonic = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
    fc.assert(
      fc.property(fc.constantFrom(...diatonic), (note) => {
        const syllable = formatSolfege(note, 'fixedDo');
        const result = parseSolfege(syllable, 'fixedDo');
        return 'note' in result && (result as { note: string }).note === note;
      }),
      { numRuns: 50 },
    );
  });

  it('movableDo: diatonic notes of major keys are all empty-alteration degrees', () => {
    const tonicKeys = ['C', 'G', 'D', 'A', 'E', 'F', 'Bb', 'Eb', 'Ab'] as const;
    fc.assert(
      fc.property(fc.constantFrom(...tonicKeys), (tonic) => {
        const key = Key.create(tonic, 'major');
        for (const note of key.scale.notes) {
          const syllable = formatSolfege(note, 'movableDo', key);
          // Diatonic syllables should be one of the seven pure syllables
          const diatonicSyllables = new Set(['do', 're', 'mi', 'fa', 'sol', 'la', 'ti']);
          if (!diatonicSyllables.has(syllable)) return false;
        }
        return true;
      }),
      { numRuns: 50 },
    );
  });
});
