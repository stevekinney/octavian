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
  'ACCIDENTAL_OFFSETS',
  'ACCIDENTALS',
  'addRationals',
  'adjacentKeys',
  'ALL_NOTE_NAMES',
  'applyInterval',
  'buildNoteName',
  'centsBetween',
  'centsOffsetTemperament',
  'Chord',
  'CHORD_SYMBOLS',
  'chordFromRomanNumeral',
  'chordQualityForSuffix',
  'CHORDS',
  'CHROMATIC_INDEXES',
  'chromaticIndexToFrequency',
  'CIRCLE_OF_FIFTHS_MAJOR',
  'CIRCLE_OF_FIFTHS_MINOR',
  'circleOfFifths',
  'compareRationals',
  'compareRhythm',
  'compoundInterval',
  'consonanceOf',
  'createChordName',
  'createChromaticIndex',
  'createFrequency',
  'createMidiKey',
  'createOctave',
  'createRatio',
  'createRational',
  'createSemitones',
  'createSlashChordName',
  'distanceInFifths',
  'divideRationals',
  'Duration',
  'edo',
  'enharmonicEquivalent',
  'enharmonicsForNoteName',
  'EQUAL_TEMPERAMENT',
  'figuredBassForChord',
  'figuredBassInversionFor',
  'figuredBassToChord',
  'findCanonicalIntervalBySemitonesAndDegree',
  'FLAT_PREFERRED_NOTE_NAMES',
  'formatChord',
  'formatFiguredBass',
  'formatKey',
  'formatRational',
  'formatScale',
  'frequencyFor',
  'harmonicFunctionFor',
  'harmonicFunctionForAsAlias',
  'harmonicFunctionForNumeral',
  'highlightGroupsForChordOrScale',
  'identifyCadence',
  'identifyCadenceSequence',
  'INTERVALS',
  'invertInterval',
  'isChordSuffix',
  'isChordSymbol',
  'isConsonant',
  'isDiatonicModeFamily',
  'isDissonant',
  'isInterval',
  'isKnownKey',
  'isNoteName',
  'isNoteNameWithOctave',
  'isOnCircleOfFifths',
  'isScaleType',
  'isZeroRational',
  'JUST_INTONATION',
  'justIntonationRatiosFor',
  'justRatioForSemitone',
  'Key',
  'KEY_SIGNATURES',
  'KEYBOARD_25',
  'KEYBOARD_49',
  'KEYBOARD_61',
  'KEYBOARD_76',
  'KEYBOARD_88',
  'keyboardKeysForRange',
  'keyboardPositionFor',
  'keyboardRange',
  'keySignatureFor',
  'keySignatureFromAccidentals',
  'Meter',
  'metersEqual',
  'midiToFrequency',
  'midiToNoteNameWithOctave',
  'multiplyRationals',
  'NATURAL_CHROMATIC_INDEXES',
  'NATURALS',
  'normalizeChromaticIndex',
  'Note',
  'noteNameToChromaticIndex',
  'noteNameToMidi',
  'noteToFrequency',
  'OCTAVES',
  'parseChordName',
  'parseFiguredBass',
  'parseKeyName',
  'parseNoteName',
  'parseNoteNameWithOctave',
  'parseScaleName',
  'pianoKeyFor',
  'randomInterval',
  'randomNote',
  'ratioCents',
  'rationalsEqual',
  'rationalToNumber',
  'ratioValue',
  'resolveChordSuffix',
  'resolveInterval',
  'resolveScaleType',
  'RhythmPattern',
  'RomanNumeral',
  'romanNumeralFor',
  'Scale',
  'SCALES',
  'scaleTypeForMode',
  'SHARP_PREFERRED_NOTE_NAMES',
  'simplifyInterval',
  'simplifyNoteName',
  'STANDARD_TUNING',
  'subtractRationals',
  'totalDurationFraction',
  'tunedScale',
  'STANDARD_GUITAR_TUNING',
  'STANDARD_BASS_TUNING',
  'noteAtFret',
  'fretPositionsFor',
  'scalePositionsFor',
  'chordPositionsFor',
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
