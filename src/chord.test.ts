import { describe, expect, it } from 'bun:test';

import { Chord } from './chord.ts';
import { Note } from './note.ts';

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
