import { describe, expect, it } from 'bun:test';

import { Chord } from './chord.ts';
import { Note } from './note.ts';

describe('Chord', () => {
  it('creates chords from symbols, suffixes, and serialized input', () => {
    const chord = new Chord('C4', 'maj7');
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
    expect(Chord.create('D4', chord.toJSON()).equals(chord)).toBe(true);
    expect(() =>
      Chord.fromJSON({
        ...chord.toJSON(),
        notes: chord.toJSON().notes.slice(0, 3),
      }),
    ).toThrow(TypeError);
  });

  it('indexes notes and chord members', () => {
    const chord = new Chord('C4', 'maj7');
    expect(chord.at(1).toString()).toBe('E4');
    expect(() => chord.at(99)).toThrow(RangeError);
    expect(chord.degree(5)?.toString()).toBe('G4');
    expect(chord.degree(2)).toBeNull();
    expect(chord.interval('majorThird')?.toString()).toBe('E4');
    expect(chord.interval('minorThird')).toBeNull();
  });

  it('transposes, changes roots, and inverts chords', () => {
    const chord = new Chord('C4', 'maj7');
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
    expect(() => chord.inversion(6)).toThrow(RangeError);
    expect(() => new Chord('C4', 'major', 3)).toThrow(RangeError);
  });

  it('supports slash chords and catalog-backed interval edits', () => {
    const chord = new Chord('C4', 'maj7');
    expect(chord.slash('E4').equals(chord.inversion(1))).toBe(true);
    expect(() => chord.slash('F4')).toThrow(RangeError);

    expect(chord.omit('majorSeventh').suffix).toBe('major');
    expect(new Chord('C4', 'major').add('majorSeventh').suffix).toBe('majorSeventh');
    expect(new Chord('C4', 'major').alter('perfectFifth', 'augmentedFifth').suffix).toBe(
      'augmented',
    );
    expect(() => new Chord('C4', 'major').add('minorSecond')).toThrow(RangeError);
  });

  it('validates and derives voicings', () => {
    const chord = new Chord('C4', 'maj7');
    const voicing = chord.voicing([
      new Note('C', 4),
      new Note('E', 4),
      new Note('G', 4),
      new Note('B', 4),
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
    expect(() => chord.voicing([new Note('C', 4)])).toThrow(RangeError);
    expect(() =>
      chord.voicing([new Note('C', 4), new Note('E', 4), new Note('G', 4), new Note('A', 4)]),
    ).toThrow(RangeError);
    expect(() => chord.lowerFromTop(0)).toThrow(RangeError);
    expect(() => chord.lowerFromTop(1, 0)).toThrow(RangeError);
  });

  it('compares chords and checks membership', () => {
    const cMajorSix = new Chord('C4', 'majorSixth');
    const aMinorSeven = new Chord('A3', 'minorSeventh');

    expect(cMajorSix.equals(new Chord('C4', 'majorSixth'))).toBe(true);
    expect(cMajorSix.equals(aMinorSeven)).toBe(false);
    expect(cMajorSix.sameChromaticIndexes(aMinorSeven)).toBe(true);
    expect(cMajorSix.isEnharmonicTo(aMinorSeven)).toBe(false);
    expect(new Chord('C#4', 'major').isEnharmonicTo(new Chord('Db4', 'major'))).toBe(true);
    expect(cMajorSix.has('A4')).toBe(true);
    expect(cMajorSix.has('minorSeventh')).toBe(false);
    expect(cMajorSix.has('majorSixth')).toBe(true);
  });

  it('serializes and iterates chords', () => {
    const chord = new Chord('C4', 'maj7');
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
});
