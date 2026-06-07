import { describe, expect, it } from 'bun:test';
import * as fc from 'fast-check';

import { Note } from './note.js';
import {
  INSTRUMENTS,
  instrumentRange,
  isInInstrumentRange,
  resolveInstrument,
  toConcertPitch,
  toWrittenPitch,
  type InstrumentDefinition,
  type InstrumentName,
} from './instruments.js';
import { CLEFS } from './clef.js';

// ---------------------------------------------------------------------------
// Clef catalog
// ---------------------------------------------------------------------------

describe('CLEFS', () => {
  it('contains the expected clef values', () => {
    expect(CLEFS).toContain('treble');
    expect(CLEFS).toContain('bass');
    expect(CLEFS).toContain('alto');
    expect(CLEFS).toContain('tenor');
    expect(CLEFS).toContain('soprano');
    expect(CLEFS).toContain('mezzo-soprano');
    expect(CLEFS).toContain('baritone');
    expect(CLEFS).toContain('percussion');
  });

  it('is frozen', () => {
    expect(Object.isFrozen(CLEFS)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// INSTRUMENTS catalog
// ---------------------------------------------------------------------------

describe('INSTRUMENTS', () => {
  it('is frozen', () => {
    expect(Object.isFrozen(INSTRUMENTS)).toBe(true);
  });

  it('contains the expected instrument names', () => {
    const expectedNames: InstrumentName[] = [
      'sopranoVoice',
      'altoVoice',
      'tenorVoice',
      'bassVoice',
      'piano',
      'guitar',
      'doubleBass',
      'violin',
      'viola',
      'cello',
      'flute',
      'clarinetBb',
      'altoSaxEb',
      'tenorSaxBb',
      'trumpetBb',
      'hornF',
      'trombone',
      'tuba',
    ];
    for (const name of expectedNames) {
      expect(INSTRUMENTS[name]).toBeDefined();
    }
  });

  it('all entries have a name and family', () => {
    for (const [, def] of Object.entries(INSTRUMENTS)) {
      expect(typeof (def as InstrumentDefinition).name).toBe('string');
      expect(typeof (def as InstrumentDefinition).family).toBe('string');
    }
  });

  it('non-transposing instruments have no transposition', () => {
    for (const key of ['piano', 'violin', 'viola', 'cello', 'flute', 'trombone', 'tuba'] as const) {
      expect(INSTRUMENTS[key].transposition).toBeUndefined();
    }
  });

  it('transposing instruments have a transposition interval', () => {
    for (const key of [
      'clarinetBb',
      'altoSaxEb',
      'tenorSaxBb',
      'trumpetBb',
      'hornF',
      'guitar',
      'doubleBass',
    ] as const) {
      expect(INSTRUMENTS[key].transposition).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// resolveInstrument
// ---------------------------------------------------------------------------

describe('resolveInstrument', () => {
  it('resolves a catalog name to a definition', () => {
    const def = resolveInstrument('piano');
    expect(def.name).toBe('Piano');
  });

  it('passes through an InstrumentDefinition object', () => {
    const custom: InstrumentDefinition = {
      name: 'Custom',
      family: 'other',
      concertRange: ['C4', 'C5'],
    };
    expect(resolveInstrument(custom)).toBe(custom);
  });

  it('throws TypeError for unknown name', () => {
    // oxlint-disable-next-line typescript-eslint/no-unsafe-argument, typescript-eslint/no-explicit-any
    expect(() => resolveInstrument('unknownInstrument' as any)).toThrow(TypeError);
  });
});

// ---------------------------------------------------------------------------
// toConcertPitch — CRITICAL direction tests
// ---------------------------------------------------------------------------

describe('toConcertPitch', () => {
  it('Bb clarinet: written C4 → concert Bb3 (down M2)', () => {
    const result = toConcertPitch('clarinetBb', 'C4');
    expect(result.toString()).toBe('Bb3');
  });

  it('Eb alto sax: written C4 → concert Eb3 (down M6)', () => {
    const result = toConcertPitch('altoSaxEb', 'C4');
    expect(result.toString()).toBe('Eb3');
  });

  it('Bb trumpet: written C4 → concert Bb3 (down M2)', () => {
    const result = toConcertPitch('trumpetBb', 'C4');
    expect(result.toString()).toBe('Bb3');
  });

  it('F horn: written C4 → concert F3 (down P5)', () => {
    const result = toConcertPitch('hornF', 'C4');
    expect(result.toString()).toBe('F3');
  });

  it('Bb tenor sax: written C4 → concert Bb2 (down M9)', () => {
    const result = toConcertPitch('tenorSaxBb', 'C4');
    expect(result.toString()).toBe('Bb2');
  });

  it('guitar: written C4 → concert C3 (down P8)', () => {
    const result = toConcertPitch('guitar', 'C4');
    expect(result.toString()).toBe('C3');
  });

  it('double bass: written C4 → concert C3 (down P8)', () => {
    const result = toConcertPitch('doubleBass', 'C4');
    expect(result.toString()).toBe('C3');
  });

  it('non-transposing instrument returns note unchanged (piano)', () => {
    const result = toConcertPitch('piano', 'C4');
    expect(result.toString()).toBe('C4');
  });

  it('non-transposing instrument returns note unchanged (violin)', () => {
    const result = toConcertPitch('violin', 'G4');
    expect(result.toString()).toBe('G4');
  });

  it('accepts a Note instance as writtenPitch', () => {
    const written = Note.create('C4');
    const result = toConcertPitch('clarinetBb', written);
    expect(result.toString()).toBe('Bb3');
  });
});

// ---------------------------------------------------------------------------
// toWrittenPitch — CRITICAL direction tests
// ---------------------------------------------------------------------------

describe('toWrittenPitch', () => {
  it('Bb clarinet: concert Bb3 → written C4 (up M2)', () => {
    const result = toWrittenPitch('clarinetBb', 'Bb3');
    expect(result.toString()).toBe('C4');
  });

  it('Eb alto sax: concert Eb3 → written C4 (up M6)', () => {
    const result = toWrittenPitch('altoSaxEb', 'Eb3');
    expect(result.toString()).toBe('C4');
  });

  it('Bb trumpet: concert Bb3 → written C4 (up M2)', () => {
    const result = toWrittenPitch('trumpetBb', 'Bb3');
    expect(result.toString()).toBe('C4');
  });

  it('F horn: concert F3 → written C4 (up P5)', () => {
    const result = toWrittenPitch('hornF', 'F3');
    expect(result.toString()).toBe('C4');
  });

  it('Bb tenor sax: concert Bb2 → written C4 (up M9)', () => {
    const result = toWrittenPitch('tenorSaxBb', 'Bb2');
    expect(result.toString()).toBe('C4');
  });

  it('guitar: concert C3 → written C4 (up P8)', () => {
    const result = toWrittenPitch('guitar', 'C3');
    expect(result.toString()).toBe('C4');
  });

  it('non-transposing instrument returns note unchanged', () => {
    const result = toWrittenPitch('piano', 'C4');
    expect(result.toString()).toBe('C4');
  });
});

// ---------------------------------------------------------------------------
// Round-trip: toConcertPitch → toWrittenPitch should be identity
// ---------------------------------------------------------------------------

describe('transposition round-trip', () => {
  const transposingInstruments: InstrumentName[] = [
    'clarinetBb',
    'altoSaxEb',
    'tenorSaxBb',
    'trumpetBb',
    'hornF',
    'guitar',
    'doubleBass',
  ];

  for (const instrument of transposingInstruments) {
    it(`round-trip identity for ${instrument}`, () => {
      fc.assert(
        fc.property(
          // Use notes in a safe range to avoid MIDI bounds issues
          fc.integer({ min: 36, max: 84 }),
          (midi) => {
            const written = Note.fromMidi(midi);
            const concert = toConcertPitch(instrument, written);
            const backToWritten = toWrittenPitch(instrument, concert);
            // MIDI values must match (enharmonic equivalence is acceptable)
            return backToWritten.midi === written.midi;
          },
        ),
        { numRuns: 50 },
      );
    });
  }
});

// ---------------------------------------------------------------------------
// instrumentRange
// ---------------------------------------------------------------------------

describe('instrumentRange', () => {
  it('returns low and high as Note instances for piano', () => {
    const range = instrumentRange('piano');
    expect(range.low).toBeInstanceOf(Note);
    expect(range.high).toBeInstanceOf(Note);
    expect(range.low.toString()).toBe('A0');
    expect(range.high.toString()).toBe('C8');
  });

  it('low.midi < high.midi for all catalog instruments', () => {
    for (const name of Object.keys(INSTRUMENTS) as InstrumentName[]) {
      if (INSTRUMENTS[name].concertRange) {
        const range = instrumentRange(name);
        expect(range.low.midi).toBeLessThan(range.high.midi);
      }
    }
  });

  it('throws TypeError for instrument with no concert range', () => {
    const custom: InstrumentDefinition = {
      name: 'No Range',
      family: 'other',
    };
    expect(() => instrumentRange(custom)).toThrow(TypeError);
  });

  it('accepts an InstrumentDefinition directly', () => {
    const custom: InstrumentDefinition = {
      name: 'Custom',
      family: 'other',
      concertRange: ['C3', 'C5'],
    };
    const range = instrumentRange(custom);
    expect(range.low.toString()).toBe('C3');
    expect(range.high.toString()).toBe('C5');
  });
});

// ---------------------------------------------------------------------------
// isInInstrumentRange
// ---------------------------------------------------------------------------

describe('isInInstrumentRange', () => {
  it('returns true for a note within the concert range', () => {
    expect(isInInstrumentRange('flute', 'C5')).toBe(true);
  });

  it('returns false for a note below the concert range', () => {
    expect(isInInstrumentRange('flute', 'B3')).toBe(false);
  });

  it('returns false for a note above the concert range', () => {
    expect(isInInstrumentRange('flute', 'E7')).toBe(false);
  });

  it('returns true for the exact low boundary', () => {
    expect(isInInstrumentRange('piano', 'A0')).toBe(true);
  });

  it('returns true for the exact high boundary', () => {
    expect(isInInstrumentRange('piano', 'C8')).toBe(true);
  });

  it('checks comfortable range when option is "comfortable"', () => {
    // Flute comfortable range: D4-G6
    expect(isInInstrumentRange('flute', 'D4', { range: 'comfortable' })).toBe(true);
    expect(isInInstrumentRange('flute', 'C4', { range: 'comfortable' })).toBe(false);
  });

  it('checks written range when option is "written" for transposing instrument', () => {
    // Clarinet Bb written range: E3-C7
    expect(isInInstrumentRange('clarinetBb', 'C4', { range: 'written' })).toBe(true);
    expect(isInInstrumentRange('clarinetBb', 'D3', { range: 'written' })).toBe(false);
  });

  it('falls back to concert range when written range is not defined', () => {
    // Flute has no writtenRange, should fall back to concertRange
    expect(isInInstrumentRange('flute', 'C5', { range: 'written' })).toBe(true);
  });

  it('throws TypeError when comfortable range is not defined', () => {
    // Piano has no comfortableRange
    expect(() => isInInstrumentRange('piano', 'C4', { range: 'comfortable' })).toThrow(TypeError);
  });

  it('accepts a Note instance', () => {
    const note = Note.create('C5');
    expect(isInInstrumentRange('violin', note)).toBe(true);
  });

  it('comfortable range is a subset of playable range', () => {
    // For instruments with both: every comfortable note should be in concert range
    const instrumentsWithBoth: InstrumentName[] = [
      'sopranoVoice',
      'altoVoice',
      'tenorVoice',
      'bassVoice',
      'violin',
      'viola',
      'cello',
      'flute',
      'clarinetBb',
      'hornF',
      'trombone',
      'tuba',
    ];
    for (const name of instrumentsWithBoth) {
      const def = INSTRUMENTS[name];
      if (!def.comfortableRange || !def.concertRange) continue;
      const [comfLow, comfHigh] = def.comfortableRange;
      expect(isInInstrumentRange(name, comfLow)).toBe(true);
      expect(isInInstrumentRange(name, comfHigh)).toBe(true);
    }
  });

  it('voice families are correctly classified', () => {
    expect(INSTRUMENTS.sopranoVoice.family).toBe('voice');
    expect(INSTRUMENTS.tenorVoice.family).toBe('voice');
  });
});
