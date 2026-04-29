import { describe, expect, it } from 'bun:test';

import { Chord } from './chord.ts';
import { Note } from './note.ts';

const alteredDominantSeventhCases = [
  {
    suffix: 'dominantSevenFlatNine',
    symbol: '7♭9',
    asciiSymbol: '7b9',
    alias: 'sevenFlatNine',
    notes: ['C4', 'E4', 'G4', 'Bb4', 'Db5'],
    transposedName: 'D7♭9',
    firstInversionName: 'C7♭9/E',
  },
  {
    suffix: 'dominantSevenSharpNine',
    symbol: '7♯9',
    asciiSymbol: '7#9',
    alias: 'sevenSharpNine',
    notes: ['C4', 'E4', 'G4', 'Bb4', 'D#5'],
    transposedName: 'D7♯9',
    firstInversionName: 'C7♯9/E',
  },
  {
    suffix: 'dominantSevenFlatFive',
    symbol: '7♭5',
    asciiSymbol: '7b5',
    alias: 'sevenFlatFive',
    notes: ['C4', 'E4', 'Gb4', 'Bb4'],
    transposedName: 'D7♭5',
    firstInversionName: 'C7♭5/E',
  },
  {
    suffix: 'dominantSevenSharpFive',
    symbol: '7♯5',
    asciiSymbol: '7#5',
    alias: 'sevenSharpFive',
    notes: ['C4', 'E4', 'G#4', 'Bb4'],
    transposedName: 'D7♯5',
    firstInversionName: 'C7♯5/E',
  },
  {
    suffix: 'dominantSevenSharpEleven',
    symbol: '7♯11',
    asciiSymbol: '7#11',
    alias: 'sevenSharpEleven',
    notes: ['C4', 'E4', 'G4', 'Bb4', 'D5', 'F#5'],
    transposedName: 'D7♯11',
    firstInversionName: 'C7♯11/E',
  },
  {
    suffix: 'dominantSevenFlatThirteen',
    symbol: '7♭13',
    asciiSymbol: '7b13',
    alias: 'sevenFlatThirteen',
    notes: ['C4', 'E4', 'G4', 'Bb4', 'D5', 'F5', 'Ab5'],
    transposedName: 'D7♭13',
    firstInversionName: 'C7♭13/E',
  },
] as const;

describe('Chord', () => {
  it('creates chords from symbols, suffixes, and serialized input', () => {
    const chord = Chord.create('C4', 'maj7');
    expect(chord.name).toBe('Cmaj7');
    expect(chord.symbol).toBe('maj7');
    expect(chord.suffix).toBe('majorSeventh');
    expect(chord.root.toString()).toBe('C4');
    expect(chord.bass.toString()).toBe('C4');
    expect(chord.notes.map((note) => note.toString())).toEqual(['C4', 'E4', 'G4', 'B4']);
    expect(chord.intervals).toEqual([
      'perfectUnison',
      'majorThird',
      'perfectFifth',
      'majorSeventh',
    ]);
    expect(chord.midi).toEqual([60, 64, 67, 71]);
    expect(chord.quality).toBe('major');
    expect(chord.size).toBe(4);

    expect(Chord.create('C4', 'maj7').equals(chord)).toBe(true);
    expect(Chord.fromJSON(chord.toJSON()).equals(chord)).toBe(true);
    expect(() =>
      Chord.fromJSON({
        ...chord.toJSON(),
        notes: chord.toJSON().notes.slice(0, 3),
      }),
    ).toThrow(TypeError);
    expect(() =>
      Chord.fromJSON({
        ...chord.toJSON(),
        notes: chord.toJSON().notes.slice(0, 3),
      }),
    ).toThrow(/do not match/i);
  });

  it('indexes notes and chord members', () => {
    const chord = Chord.create('C4', 'maj7');
    expect(chord.at(1).toString()).toBe('E4');
    expect(() => chord.at(99)).toThrow(RangeError);
    expect(() => chord.at(99)).toThrow(/out of range/i);
    expect(chord.degree(5)?.toString()).toBe('G4');
    expect(chord.degree(2)).toBeNull();
    expect(chord.interval('majorThird')?.toString()).toBe('E4');
    expect(chord.interval('minorThird')).toBeNull();
  });

  it('transposes, changes roots, and inverts chords', () => {
    const chord = Chord.create('C4', 'maj7');
    expect(chord.transpose('majorSecond').name).toBe('Dmaj7');
    expect(chord.transposeBy(1).name).toBe('C#maj7');
    expect(chord.withRoot('D4').name).toBe('Dmaj7');

    const firstInversion = chord.invert();
    expect(firstInversion.notes.map((note) => note.toString())).toEqual(['E4', 'G4', 'B4', 'C5']);
    expect(firstInversion.inversionIndex).toBe(1);
    expect(firstInversion.isSlashChord).toBe(true);
    expect(firstInversion.isRootPosition).toBe(false);
    expect(firstInversion.name).toBe('Cmaj7/E');
    expect(chord.inversion(2).bass.toString()).toBe('G4');
    expect(() => chord.invert(-1)).toThrow(RangeError);
    expect(() => chord.invert(-1)).toThrow(/non-negative inversion/i);
    expect(() => chord.inversion(6)).toThrow(RangeError);
    expect(() => chord.inversion(6)).toThrow(/cannot set inversion/i);
    expect(() => Chord.create('C4', 'major').inversion(3)).toThrow(RangeError);
    expect(() => Chord.create('C4', 'major').inversion(3)).toThrow(/cannot set inversion/i);
  });

  it.each(alteredDominantSeventhCases)(
    'supports altered dominant seventh catalog entry $suffix',
    ({ suffix, symbol, asciiSymbol, alias, notes, transposedName, firstInversionName }) => {
      const chord = Chord.create('C4', suffix);

      expect(chord.suffix).toBe(suffix);
      expect(chord.symbol).toBe(symbol);
      expect(chord.name).toBe(`C${symbol}`);
      expect(chord.quality).toBe('altered');
      expect(chord.notes.map((note) => note.toString())).toEqual(notes);

      expect(Chord.create('C4', symbol).suffix).toBe(suffix);
      expect(Chord.create('C4', asciiSymbol).suffix).toBe(suffix);
      expect(Chord.create('C4', alias).suffix).toBe(suffix);

      expect(chord.transpose('majorSecond').name).toBe(transposedName);
      const firstInversion = chord.invert();
      expect(firstInversion.inversionIndex).toBe(1);
      expect(firstInversion.bass.toString()).toBe('E4');
      expect(firstInversion.name).toBe(firstInversionName);
    },
  );

  it('supports slash chords and catalog-backed interval edits', () => {
    const chord = Chord.create('C4', 'maj7');
    expect(chord.slash('E4').equals(chord.inversion(1))).toBe(true);
    expect(() => chord.slash('F4')).toThrow(RangeError);
    expect(() => chord.slash('F4')).toThrow(/slash chords are restricted/i);

    expect(chord.omit('majorSeventh').suffix).toBe('major');
    expect(Chord.create('C4', 'major').add('majorSeventh').suffix).toBe('majorSeventh');
    expect(Chord.create('C4', 'major').alter('perfectFifth', 'augmentedFifth').suffix).toBe(
      'augmented',
    );
    expect(() => Chord.create('C4', 'major').add('minorSecond')).toThrow(RangeError);
    expect(() => Chord.create('C4', 'major').add('minorSecond')).toThrow(
      /does not match an exported chord/i,
    );
  });

  it('validates and derives voicings', () => {
    const chord = Chord.create('C4', 'maj7');
    const voicing = chord.voicing([
      Note.create('C4'),
      Note.create('E4'),
      Note.create('G4'),
      Note.create('B4'),
    ]);
    expect(voicing.bass.toString()).toBe('C4');
    expect(voicing.midi).toEqual([60, 64, 67, 71]);
    expect(chord.closeVoicing().notes.map((note) => note.toString())).toEqual([
      'C4',
      'E4',
      'G4',
      'B4',
    ]);
    expect(chord.lowerFromTop(2).notes.map((note) => note.toString())).toEqual([
      'G3',
      'C4',
      'E4',
      'B4',
    ]);
    expect(() => chord.voicing([Note.create('C4')])).toThrow(RangeError);
    expect(() => chord.voicing([Note.create('C4')])).toThrow(/expected \d+ notes/i);
    expect(() =>
      chord.voicing([Note.create('C4'), Note.create('E4'), Note.create('G4'), Note.create('A4')]),
    ).toThrow(RangeError);
    expect(() =>
      chord.voicing([Note.create('C4'), Note.create('E4'), Note.create('G4'), Note.create('A4')]),
    ).toThrow(/pitch classes/i);
    expect(() => chord.lowerFromTop(0)).toThrow(RangeError);
    expect(() => chord.lowerFromTop(0)).toThrow(/range 1\.\.\d+/i);
    expect(() => chord.lowerFromTop(1, 0)).toThrow(RangeError);
    expect(() => chord.lowerFromTop(1, 0)).toThrow(/positive octave/i);
  });

  it('compares chords and checks membership', () => {
    const cMajorSix = Chord.create('C4', 'majorSixth');
    const aMinorSeven = Chord.create('A3', 'minorSeventh');

    expect(cMajorSix.equals(Chord.create('C4', 'majorSixth'))).toBe(true);
    expect(cMajorSix.equals(aMinorSeven)).toBe(false);
    expect(cMajorSix.sameChromaticIndexes(aMinorSeven)).toBe(true);
    expect(cMajorSix.isEnharmonicTo(aMinorSeven)).toBe(false);
    expect(Chord.create('C#4', 'major').isEnharmonicTo(Chord.create('Db4', 'major'))).toBe(true);
    expect(cMajorSix.has('A4')).toBe(true);
    expect(cMajorSix.has('minorSeventh')).toBe(false);
    expect(cMajorSix.has('majorSixth')).toBe(true);
  });

  it('serializes and iterates chords', () => {
    const chord = Chord.create('C4', 'maj7');
    expect(chord.toJSON()).toEqual({
      name: 'Cmaj7',
      symbol: 'maj7',
      suffix: 'majorSeventh',
      intervals: ['perfectUnison', 'majorThird', 'perfectFifth', 'majorSeventh'],
      notes: chord.notes.map((note) => note.toJSON()),
      root: chord.root.toJSON(),
      bass: chord.bass.toJSON(),
      inversion: 0,
    });
    expect([...chord].map((note) => note.toString())).toEqual(['C4', 'E4', 'G4', 'B4']);
  });

  // ---------------------------------------------------------------------------
  // M8 — Chord editor no-op branch tests
  // ---------------------------------------------------------------------------

  it('returns the same instance when omit, add, or alter are no-ops', () => {
    const cMajor = Chord.create('C4', 'major');

    // omit: interval not present in chord → no-op → same reference
    const afterOmitAbsent = cMajor.omit('minorSecond');
    expect(afterOmitAbsent).toBe(cMajor);

    // add: interval already present → no-op → same reference
    const afterAddPresent = cMajor.add('majorThird');
    expect(afterAddPresent).toBe(cMajor);

    // alter: from and to resolve to the same interval → no-op → same reference
    const afterAlterSame = cMajor.alter('perfectFifth', 'perfectFifth');
    expect(afterAlterSame).toBe(cMajor);
  });
});
