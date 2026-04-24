import { describe, expect, it } from 'bun:test';

import {
  CHROMATIC_INDEXES,
  OCTAVES,
  createChromaticIndex,
  createFrequency,
  createMidiKey,
  createOctave,
  createSemitones,
} from './branded-types.ts';
import {
  CHORDS,
  chordQualityForSuffix,
  findChordSuffixByIntervals,
  resolveChordSuffix,
} from './chords.ts';
import {
  INTERVALS,
  findCanonicalIntervalBySemitonesAndDegree,
  resolveInterval,
} from './intervals.ts';
import {
  frequencyToNearestMidi,
  isChordSuffix,
  isChordSymbol,
  isInterval,
  isNoteName,
  isNoteNameWithOctave,
  isScaleType,
  midiToFrequency,
  midiToNoteNameWithOctave,
  noteNameToMidi,
  parseNoteName,
  parseNoteNameWithOctave,
} from './music-utilities.ts';
import {
  ALL_NOTE_NAMES,
  SHARP_PREFERRED_NOTE_NAMES,
  buildNoteName,
  enharmonicsForNoteName,
  normalizeChromaticIndex,
  noteNameToChromaticIndex,
  simplifyNoteName,
} from './note-spellings.ts';
import { SCALES, isDiatonicModeFamily, resolveScaleType, scaleTypeForMode } from './scales.ts';
import { STANDARD_TUNING } from './tuning.ts';

describe('foundation helpers', () => {
  it('validates branded numeric domains', () => {
    expect(OCTAVES).toContain(4);
    expect(CHROMATIC_INDEXES).toContain(11);
    expect(createOctave(4)).toBe(4);
    expect(createChromaticIndex(11)).toBe(11);
    expect(createMidiKey(69)).toBe(69);
    expect(createFrequency(440)).toBe(440);
    expect(createSemitones(-7)).toBe(-7);
    expect(() => createOctave(10)).toThrow(RangeError);
    expect(() => createChromaticIndex(12)).toThrow(RangeError);
    expect(() => createMidiKey(128)).toThrow(RangeError);
    expect(() => createFrequency(0)).toThrow(RangeError);
    expect(() => createSemitones(1.5)).toThrow(RangeError);
  });

  it('supports note spelling helpers and guards', () => {
    expect(ALL_NOTE_NAMES).toContain('C##');
    expect(isNoteName('Bb')).toBe(true);
    expect(isNoteName('H')).toBe(false);
    expect(isNoteNameWithOctave('C#4')).toBe(true);
    expect(isNoteNameWithOctave('C#10')).toBe(false);
    expect(parseNoteName('Ebb')).toEqual({ note: 'Ebb', natural: 'E', accidental: 'bb' });
    expect(parseNoteNameWithOctave('F#3')).toEqual({ note: 'F#', octave: 3 });
    expect(() => parseNoteName('H')).toThrow(TypeError);
    expect(() => parseNoteNameWithOctave('H4')).toThrow(TypeError);
    expect(noteNameToChromaticIndex('Cb')).toBe(11);
    expect(normalizeChromaticIndex(-1)).toBe(11);
    expect(buildNoteName('F', 2)).toBe('F##');
    expect(() => buildNoteName('C', 3)).toThrow(RangeError);
    expect(simplifyNoteName('B#')).toBe('C');
    expect(enharmonicsForNoteName('C#')).toEqual(expect.arrayContaining(['Db', 'B##']));
    expect(SHARP_PREFERRED_NOTE_NAMES[6]).toBe('F#');
  });

  it('converts between note names, MIDI keys, and frequencies', () => {
    const midi = noteNameToMidi('C', createOctave(4));
    expect(midi).toBe(60);
    expect(noteNameToMidi('B#', createOctave(3))).toBe(60);
    expect(noteNameToMidi('Cb', createOctave(4))).toBe(59);
    expect(midiToNoteNameWithOctave(createMidiKey(61))).toEqual({ note: 'C#', octave: 4 });
    expect(Number(midiToFrequency(createMidiKey(69)))).toBe(440);
    expect(frequencyToNearestMidi(440)).toBe(69);
    expect(STANDARD_TUNING.frequency).toBe(440);
  });

  it('resolves interval, chord, and scale aliases', () => {
    expect(INTERVALS.tone.semitones).toBe(2);
    expect(resolveInterval('unison')).toBe('perfectUnison');
    expect(resolveInterval('halfStep')).toBe('minorSecond');
    expect(resolveInterval('wholeStep')).toBe('majorSecond');
    expect(resolveInterval('tritone')).toBe('augmentedFourth');
    expect(resolveInterval('octave')).toBe('perfectOctave');
    expect(resolveInterval('flatNine')).toBe('minorNinth');
    expect(resolveInterval('ninth')).toBe('majorNinth');
    expect(resolveInterval('eleventh')).toBe('perfectEleventh');
    expect(resolveInterval('sharpEleven')).toBe('augmentedEleventh');
    expect(resolveInterval('twelfth')).toBe('perfectTwelfth');
    expect(resolveInterval('flatThirteen')).toBe('minorThirteenth');
    expect(resolveInterval('thirteenth')).toBe('majorThirteenth');
    expect(resolveInterval('tone')).toBe('majorSecond');
    expect(findCanonicalIntervalBySemitonesAndDegree(6, 5)).toBe('diminishedFifth');
    expect(isInterval('sharpEleven')).toBe(true);
    expect(isInterval('fakeInterval')).toBe(false);

    expect(resolveChordSuffix('maj7')).toBe('majorSeventh');
    expect(resolveChordSuffix('7')).toBe('dominantSeventh');
    expect(() => Reflect.apply(resolveChordSuffix, undefined, ['sus9'])).toThrow(TypeError);
    expect(findChordSuffixByIntervals(['perfectUnison', 'majorThird', 'perfectFifth'])).toBe(
      'major',
    );
    expect(findChordSuffixByIntervals(['perfectUnison'])).toBeNull();
    expect(chordQualityForSuffix('major')).toBe('major');
    expect(chordQualityForSuffix('dominantNinth')).toBe('dominant');
    expect(chordQualityForSuffix('minor')).toBe('minor');
    expect(chordQualityForSuffix('minorSeventh')).toBe('minor');
    expect(chordQualityForSuffix('diminished')).toBe('diminished');
    expect(chordQualityForSuffix('augmented')).toBe('augmented');
    expect(chordQualityForSuffix('suspendedFourth')).toBe('suspended');
    expect(CHORDS.sixNine.symbol).toBe('6/9');
    expect(isChordSuffix('minorTriad')).toBe(true);
    expect(isChordSuffix('powerChord')).toBe(false);
    expect(isChordSymbol('m7b5')).toBe(true);
    expect(isChordSymbol('sus9')).toBe(false);

    expect(resolveScaleType('aeolian')).toBe('naturalMinor');
    expect(resolveScaleType('pentatonicMajor')).toBe('majorPentatonic');
    expect(resolveScaleType('pentatonicMinor')).toBe('minorPentatonic');
    expect(resolveScaleType('minorBlues')).toBe('blues');
    expect(resolveScaleType('octatonic')).toBe('diminished');
    expect(resolveScaleType('wholeHalfDiminished')).toBe('diminished');
    expect(scaleTypeForMode('aeolian')).toBe('naturalMinor');
    expect(isDiatonicModeFamily('major')).toBe(true);
    expect(isDiatonicModeFamily('chromatic')).toBe(false);
    expect(SCALES.ionian.aliases).toContain('major');
    expect(isScaleType('octatonic')).toBe(true);
    expect(isScaleType('superLocrian')).toBe(false);
  });
});
