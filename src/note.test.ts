import { describe, expect, it } from 'bun:test';

import { createFrequency, createMidiKey, createSemitones } from './branded-types.ts';
import { midiToFrequency } from './music-utilities.ts';
import { Note, applyInterval, noteToFrequency } from './note.ts';
import { STANDARD_TUNING } from './tuning.ts';

describe('Note', () => {
  it('creates notes from constructors and note-like inputs', () => {
    const note = Note.create('C#4');
    expect(note.note).toBe('C#');
    expect(note.octave).toBe(4);
    expect(note.chromaticIndex).toBe(1);
    expect(note.midi).toBe(61);
    expect(Number(note.frequency)).toBeCloseTo(277.1826309768721, 10);
    expect(note.enharmonics).toEqual(expect.arrayContaining(['Db', 'B##']));

    expect(Note.create(note)).toBe(note);
    expect(Note.create('Db').toString()).toBe('Db4');
    expect(Note.create('Db4').toString()).toBe('Db4');
    expect(Note.create({ note: 'F#', octave: 3 }).toString()).toBe('F#3');
    expect(Note.create(note.toJSON()).toString()).toBe('C#4');
    expect(() =>
      Note.create({
        ...note.toJSON(),
        midi: createMidiKey(60),
      }),
    ).toThrow(TypeError);
    expect(() =>
      Note.create({
        ...note.toJSON(),
        midi: createMidiKey(60),
      }),
    ).toThrow(/does not match/i);
    expect(() =>
      Note.create({
        ...note.toJSON(),
        frequency: createFrequency(880),
      }),
    ).toThrow(TypeError);
    expect(() =>
      Note.create({
        ...note.toJSON(),
        frequency: createFrequency(880),
      }),
    ).toThrow(/does not match/i);
    expect(() => Reflect.apply(Note.create, Note, ['H'])).toThrow(TypeError);
    expect(() => Reflect.apply(Note.create, Note, ['H'])).toThrow(/unsupported/i);
  });

  it('validates note-like values and compares notes', () => {
    expect(Note.isNoteLike(Note.create('C4'))).toBe(true);
    expect(Note.isNoteLike('Bb4')).toBe(true);
    expect(Note.isNoteLike({ note: 'A', octave: 2 })).toBe(true);
    expect(Note.isNoteLike({ note: 'A', octave: 99 })).toBe(false);
    expect(Note.isNoteLike({ note: 'H' })).toBe(false);
    expect(Note.compare('C4', 'C4')).toBe(0);
    expect(Note.compare('C4', 'D4')).toBe(-1);
    expect(Note.compare('D4', 'C4')).toBe(1);
  });

  it('builds notes from MIDI and frequency inputs', () => {
    expect(Note.fromMidi(60).toString()).toBe('C4');
    expect(Note.fromMidi(createMidiKey(69)).toString()).toBe('A4');
    expect(Note.nearestTo(440).toString()).toBe('A4');
    expect(Note.nearestTo(createFrequency(261.6255653005986)).toString()).toBe('C4');
    expect(() => Note.fromMidi(200)).toThrow(RangeError);
    expect(() => Note.fromMidi(200)).toThrow(/range 0\.\.127/i);
    expect(() => Note.nearestTo(-1)).toThrow(RangeError);
    expect(() => Note.nearestTo(-1)).toThrow(/positive finite/i);
  });

  describe('frequencyAt and noteToFrequency', () => {
    const tunings = [
      STANDARD_TUNING,
      { reference: 'A4', frequency: createFrequency(432) },
      { reference: 'A4', frequency: createFrequency(442) },
    ] as const;

    it('matches midiToFrequency across the full MIDI range for supported tunings', () => {
      for (let midi = 0; midi <= 127; midi += 1) {
        for (const tuning of tunings) {
          expect(
            Math.abs(
              Number(Note.fromMidi(midi).frequencyAt(tuning)) -
                Number(midiToFrequency(midi, tuning)),
            ),
          ).toBeLessThan(1e-9);
        }
      }
    });

    it('round-trips nearestTo across the full MIDI range for supported tunings', () => {
      for (let midi = 0; midi <= 127; midi += 1) {
        for (const tuning of tunings) {
          const frequency = midiToFrequency(midi, tuning);
          expect(Note.nearestTo(Number(frequency), tuning).midi).toBe(midi);
        }
      }
    });

    it('keeps the frequency getter pinned to standard tuning', () => {
      expect(Number(Note.create('A4').frequency)).toBe(440);
    });

    it('returns the tuned frequency through frequencyAt', () => {
      expect(
        Math.abs(
          Number(
            Note.create('A4').frequencyAt({
              reference: 'A4',
              frequency: createFrequency(432),
            }),
          ) - 432,
        ),
      ).toBeLessThan(1e-9);
    });

    it('preserves standard frequency while exposing alternate tuning through frequencyAt', () => {
      const tuning432 = { reference: 'A4', frequency: createFrequency(432) } as const;
      const note = Note.nearestTo(432, tuning432);

      expect(note.note).toBe('A');
      expect(note.octave).toBe(4);
      expect(Math.abs(Number(note.frequency) - 440)).toBeLessThan(1e-9);
      expect(Math.abs(Number(note.frequencyAt(tuning432)) - 432)).toBeLessThan(1e-9);
    });

    it('accepts note-like inputs in noteToFrequency', () => {
      const note = Note.create('A4');
      const inputs = ['A4', { note: 'A', octave: 4 }, note] as const;

      for (const input of inputs) {
        expect(
          Math.abs(
            Number(noteToFrequency(input)) -
              Number(Note.create(input).frequencyAt(STANDARD_TUNING)),
          ),
        ).toBeLessThan(1e-9);
      }

      expect(Number(noteToFrequency(Note.create('A4')))).toBe(440);
    });
  });

  it('transposes by intervals and semitones', () => {
    expect(Note.create('C4').transpose('minorThird').toString()).toBe('Eb4');
    expect(applyInterval(Note.create('F#4'), 'majorThird').toString()).toBe('A#4');
    expect(Note.create('Db4').transposeBy(1).toString()).toBe('D4');
    expect(Note.create('C4').transpose(createSemitones(12)).toString()).toBe('C5');
  });

  it('moves by octaves and compares enharmonic relationships', () => {
    const note = Note.create('B#3');
    expect(note.up().toString()).toBe('B#4');
    expect(note.down().toString()).toBe('B#2');
    expect(() => note.up(-1)).toThrow(RangeError);
    expect(() => note.up(-1)).toThrow(/non-negative integer/i);
    expect(() => note.down(-1)).toThrow(RangeError);
    expect(() => note.down(-1)).toThrow(/non-negative integer/i);

    expect(Note.create('C#4').equals('C#4')).toBe(true);
    expect(Note.create('C#4').equals('Db4')).toBe(false);
    expect(Note.create('C#4').isEnharmonicTo('Db4')).toBe(true);
    expect(note.simplify().toString()).toBe('C4');
    expect(note.withOctave(4).toString()).toBe('B#4');
  });

  it('measures intervals and distances', () => {
    const note = Note.create('C4');

    expect(note.distanceTo('E4')).toBe('majorThird');
    expect(Note.create('E4').distanceTo('C4')).toBe('minorSixth');
    expect(Note.create('B4').distanceTo('B3')).toBe('perfectOctave');
    expect(Note.create('C#4').distanceTo('Db4')).toBe('diminishedSecond');
    expect(note.semitonesTo('A4')).toBe(9);
  });

  it('serializes and coerces notes', () => {
    const note = Note.create('G4');
    expect(note.toTuple()).toEqual([note.note, note.octave, note.midi, note.frequency]);
    expect(note.toString()).toBe('G4');
    expect(note.valueOf()).toBe(67);
    expect(note.toJSON()).toEqual({
      note: 'G',
      octave: 4,
      midi: 67,
      frequency: note.frequency,
    });
    expect(String(note)).toBe('G4');
    expect(Number(note)).toBe(67);
    expect(note[Symbol.toPrimitive]('default')).toBe('G4');
    expect(Object.prototype.toString.call(note)).toBe('[object Note(G4)]');
    expect([...note]).toEqual([note.note, note.octave, note.midi, note.frequency]);
  });
});
