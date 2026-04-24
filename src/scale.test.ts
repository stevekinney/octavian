import { describe, expect, it } from 'bun:test';

import { Scale } from './scale.ts';

describe('Scale', () => {
  it('creates scales and recreates them from serialized data', () => {
    const scale = new Scale('C4', 'ionian');
    expect(scale.root.toString()).toBe('C4');
    expect(scale.type).toBe('major');
    expect(scale.notes.map((note) => note.toString())).toEqual([
      'C4',
      'D4',
      'E4',
      'F4',
      'G4',
      'A4',
      'B4',
    ]);
    expect(scale.intervals).toEqual([
      'perfectUnison',
      'majorSecond',
      'majorThird',
      'perfectFourth',
      'perfectFifth',
      'majorSixth',
      'majorSeventh',
    ]);
    expect(scale.size).toBe(7);
    expect(Scale.create('C4', 'major').equals(scale)).toBe(true);
    expect(Scale.fromJSON(scale.toJSON()).equals(scale)).toBe(true);
    expect(() =>
      Scale.fromJSON({
        ...scale.toJSON(),
        notes: scale.toJSON().notes.slice(0, 6),
      }),
    ).toThrow(TypeError);
  });

  it('indexes and queries scale membership', () => {
    const scale = new Scale('C4', 'major');
    expect(scale.at(0).toString()).toBe('C4');
    expect(() => scale.at(99)).toThrow(RangeError);
    expect(scale.has('E5')).toBe(true);
    expect(scale.has('F#4')).toBe(false);
    expect(scale.degree(3).toString()).toBe('E4');
    expect(() => scale.degree(0)).toThrow(RangeError);
    expect(scale.degreeOf('Bb4')).toBeNull();
    expect(scale.degreeOf('A4')).toBe(6);
    expect(scale.interval('F4')).toBe('perfectFourth');
    expect(() => scale.interval('F#4')).toThrow(RangeError);
  });

  it('transposes, finds relatives, and derives modes', () => {
    const scale = new Scale('C4', 'major');
    expect(scale.transpose('majorSecond').toString()).toBe('D major');
    expect(scale.transposeBy(1).toString()).toBe('C# major');
    expect(scale.relative('naturalMinor').toString()).toBe('A naturalMinor');
    expect(scale.parallel('naturalMinor').toString()).toBe('C naturalMinor');
    expect(scale.mode('dorian').toString()).toBe('D dorian');
    expect(scale.modes().map((mode) => mode.toString())).toEqual([
      'C major',
      'D dorian',
      'E phrygian',
      'F lydian',
      'G mixolydian',
      'A naturalMinor',
      'B locrian',
    ]);
    expect(scale.rotate(1).toString()).toBe('D dorian');
    expect(() => new Scale('C4', 'majorPentatonic').mode('dorian')).toThrow(RangeError);
    expect(() => new Scale('C4', 'blues').rotate(1)).toThrow(RangeError);
    expect(() => scale.rotate(99)).toThrow(RangeError);
    expect(() => new Scale('C4', 'chromatic').relative('major')).toThrow(RangeError);
  });

  it('navigates through notes in the scale', () => {
    const scale = new Scale('C4', 'major');
    expect(scale.next('C4').toString()).toBe('D4');
    expect(scale.next('B4').toString()).toBe('C5');
    expect(scale.previous('C4').toString()).toBe('B3');
    expect(scale.previous('D4').toString()).toBe('C4');
    expect(scale.nearest('C4').toString()).toBe('C4');
    expect(scale.nearest('C#4').toString()).toBe('C4');
    expect(scale.ascendingFrom('E4').map((note) => note.toString())).toEqual([
      'E4',
      'F4',
      'G4',
      'A4',
      'B4',
      'C5',
      'D5',
    ]);
    expect(scale.descendingFrom('E4').map((note) => note.toString())).toEqual([
      'E4',
      'D4',
      'C4',
      'B3',
      'A3',
      'G3',
      'F3',
    ]);
  });

  it('builds tertian chords from supported scales', () => {
    const scale = new Scale('C4', 'major');
    expect(scale.triad(1).name).toBe('C');
    expect(scale.chord(2, 'seventh').name).toBe('Dm7');
    expect(scale.chords().map((chord) => chord.name)).toEqual([
      'C',
      'Dm',
      'Em',
      'F',
      'G',
      'Am',
      'Bdim',
    ]);
    expect(scale.seventhChords().map((chord) => chord.name)).toEqual([
      'Cmaj7',
      'Dm7',
      'Em7',
      'Fmaj7',
      'G7',
      'Am7',
      'Bm7b5',
    ]);
    expect(() => new Scale('C4', 'chromatic').triad(1)).toThrow(RangeError);
  });

  it('compares, serializes, and iterates scales', () => {
    const cMajor = new Scale('C4', 'major');
    const aMinor = new Scale('A3', 'naturalMinor');
    expect(cMajor.samePitchClasses(aMinor)).toBe(true);
    expect(cMajor.equals(new Scale('C4', 'ionian'))).toBe(true);
    expect(cMajor.equals(aMinor)).toBe(false);
    expect([...cMajor].map((note) => note.toString())).toEqual([
      'C4',
      'D4',
      'E4',
      'F4',
      'G4',
      'A4',
      'B4',
    ]);
    expect(cMajor.toString()).toBe('C major');
    expect(cMajor.toJSON()).toEqual({
      root: cMajor.root.toJSON(),
      type: 'major',
      notes: cMajor.notes.map((note) => note.toJSON()),
      intervals: cMajor.intervals,
    });
    expect(cMajor.spellings()).toEqual(['C', 'D', 'E', 'F', 'G', 'A', 'B']);
    expect(Object.prototype.toString.call(cMajor)).toBe('[object Scale(C major)]');
  });
});
