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
  'analyzeProgression',
  'analyzeVoiceLeading',
  'applyInterval',
  'buildNoteName',
  'centsBetween',
  'centsOffsetTemperament',
  'Chord',
  'CHORD_SYMBOLS',
  'chordFromRomanNumeral',
  'chordPositionsFor',
  'chordQualityForSuffix',
  'CHORDS',
  'CHROMATIC_INDEXES',
  'chromaticIndexToFrequency',
  'CIRCLE_OF_FIFTHS_MAJOR',
  'CIRCLE_OF_FIFTHS_MINOR',
  'circleOfFifths',
  'CLEFS',
  'commonProgressionName',
  'commonProgressions',
  'commonTones',
  'compareMelodicContour',
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
  'createSeededRandom',
  'createSemitones',
  'createSlashChordName',
  'degreeForNote',
  'detectModulations',
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
  'findCommonProgression',
  'findMotifOccurrences',
  'findParallelPerfects',
  'FLAT_PREFERRED_NOTE_NAMES',
  'formatChord',
  'formatFiguredBass',
  'formatKey',
  'formatNoteName',
  'formatRational',
  'formatScale',
  'formatSolfege',
  'frequencyFor',
  'fretPositionsFor',
  'harmonicFunctionFor',
  'harmonicFunctionForAsAlias',
  'harmonicFunctionForNumeral',
  'highlightGroupsForChordOrScale',
  'identifyCadence',
  'identifyCadenceSequence',
  'instrumentRange',
  'INSTRUMENTS',
  'INTERVALS',
  'invertInterval',
  'isChordSuffix',
  'isChordSymbol',
  'isConsonant',
  'isDiatonicModeFamily',
  'isDissonant',
  'isInInstrumentRange',
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
  'leadingToneResolutions',
  'Melody',
  'Meter',
  'metersEqual',
  'midiToFrequency',
  'midiToNoteNameWithOctave',
  'multiplyRationals',
  'NATURAL_CHROMATIC_INDEXES',
  'NATURALS',
  'normalizeChromaticIndex',
  'normalizeJazzSuffix',
  'Note',
  'noteAtFret',
  'noteForDegree',
  'noteNameToChromaticIndex',
  'noteNameToMidi',
  'noteToFrequency',
  'OCTAVES',
  'parseChordName',
  'parseFiguredBass',
  'parseKeyName',
  'parseNoteName',
  'parseNoteNameLabel',
  'parseNoteNameWithOctave',
  'parseScaleName',
  'parseSolfege',
  'pianoKeyFor',
  'Progression',
  'randomChord',
  'randomInterval',
  'randomNote',
  'randomRomanNumeral',
  'randomRomanNumeralSequence',
  'randomScale',
  'randomScaleDegree',
  'ratioCents',
  'rationalsEqual',
  'rationalToNumber',
  'ratioValue',
  'resolveChordSuffix',
  'resolveInstrument',
  'resolveInterval',
  'resolveScaleType',
  'RhythmPattern',
  'RomanNumeral',
  'romanNumeralFor',
  'Scale',
  'scalePositionsFor',
  'SCALES',
  'scaleTypeForMode',
  'SHARP_PREFERRED_NOTE_NAMES',
  'simplifyInterval',
  'simplifyNoteName',
  'STANDARD_BASS_TUNING',
  'STANDARD_GUITAR_TUNING',
  'STANDARD_TUNING',
  'subtractRationals',
  'suggestContinuations',
  'toConcertPitch',
  'totalDurationFraction',
  'toWrittenPitch',
  'tunedScale',
  'voiceMotion',
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
