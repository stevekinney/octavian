import { describe, expect, it } from 'bun:test';

import {
  CHORDS,
  INTERVALS,
  Note,
  SCALES,
  Scale,
  STANDARD_TUNING,
  applyInterval,
  isChordSuffix,
  isNoteName,
  isScaleType,
} from './index.ts';

describe('index exports', () => {
  it('re-exports the public music theory API', () => {
    expect(Note.create('C4').toString()).toBe('C4');
    expect(Scale.create('C4', 'major').toString()).toBe('C major');
    expect(applyInterval(Note.create('C4'), 'perfectFifth').toString()).toBe('G4');
    expect(INTERVALS.majorThird.symbol).toBe('M3');
    expect(CHORDS.majorSeventh.symbol).toBe('maj7');
    expect(SCALES.major.intervals).toContain('majorThird');
    expect(STANDARD_TUNING.frequency).toBe(440);
    expect(isNoteName('C#')).toBe(true);
    expect(isChordSuffix('maj7')).toBe(true);
    expect(isScaleType('mixolydian')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// M5 — Public API contract test (explicit allowlist)
// ---------------------------------------------------------------------------

const EXPECTED_EXPORTS = [
  'ACCIDENTALS',
  'ACCIDENTAL_OFFSETS',
  'ALL_NOTE_NAMES',
  'CHORDS',
  'CHORD_SYMBOLS',
  'CHROMATIC_INDEXES',
  'INTERVALS',
  'NATURALS',
  'NATURAL_CHROMATIC_INDEXES',
  'OCTAVES',
  'SCALES',
  'SHARP_PREFERRED_NOTE_NAMES',
  'STANDARD_TUNING',
  'Chord',
  'Note',
  'Scale',
  'applyInterval',
  'buildNoteName',
  'chordQualityForSuffix',
  'createChordName',
  'createChromaticIndex',
  'createFrequency',
  'createMidiKey',
  'createOctave',
  'createSemitones',
  'createSlashChordName',
  'FLAT_PREFERRED_NOTE_NAMES',
  'enharmonicsForNoteName',
  'findCanonicalIntervalBySemitonesAndDegree',
  'isDiatonicModeFamily',
  'isChordSuffix',
  'isChordSymbol',
  'isInterval',
  'isNoteName',
  'isNoteNameWithOctave',
  'isScaleType',
  'midiToFrequency',
  'midiToNoteNameWithOctave',
  'normalizeChromaticIndex',
  'noteNameToChromaticIndex',
  'noteNameToMidi',
  'noteToFrequency',
  'parseNoteName',
  'parseNoteNameWithOctave',
  'randomInterval',
  'randomNote',
  'resolveChordSuffix',
  'resolveInterval',
  'resolveScaleType',
  'scaleTypeForMode',
  'simplifyNoteName',
].toSorted((a, b) => a.localeCompare(b));

describe('public API contract', () => {
  it('exports exactly the allowlisted runtime names', async () => {
    // Attempt to read the fixture file; fall back to the hard-coded list above.
    let allowlist: string[] = EXPECTED_EXPORTS;
    try {
      const fixture = await Bun.file(
        new URL('../../tests/fixtures/consumer/expected-exports.json', import.meta.url),
      ).json<string[]>();
      allowlist = [...fixture].toSorted((a, b) => a.localeCompare(b));
    } catch {
      // Fixture file not present in this worktree — use the hard-coded list.
    }

    const module = await import('./index.ts');
    const actual = Object.keys(module).toSorted((a, b) => a.localeCompare(b));

    expect(actual).toEqual(allowlist);
  });
});
