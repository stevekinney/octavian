/**
 * Verifies that Note can be imported in isolation without Chord or Scale.
 * This test intentionally does NOT import from ./chord or ./scale.
 */
import { describe, expect, it } from 'bun:test';
import { Note, applyInterval } from './note.ts';

describe('Note in isolation (no Chord or Scale imports)', () => {
  it('constructs notes and accesses all independent properties', () => {
    const c = Note.create('C4');
    expect(c.note).toBe('C');
    expect(c.octave).toBe(4);
    expect(c.midi).toBe(60);
    expect(typeof Number(c.frequency)).toBe('number');
    expect(c.chromaticIndex).toBe(0);
    expect(c.enharmonics).toEqual(expect.arrayContaining(['B#', 'Dbb']));
  });

  it('uses all remaining instance methods without error', () => {
    const c = Note.create('C4');
    expect(c.transpose('majorThird').toString()).toBe('E4');
    expect(c.transposeBy(7).toString()).toBe('G4');
    expect(c.up().toString()).toBe('C5');
    expect(c.down().toString()).toBe('C3');
    expect(c.equals('C4')).toBe(true);
    expect(c.isEnharmonicTo('B#3')).toBe(true);
    expect(c.simplify().toString()).toBe('C4');
    expect(c.withOctave(5).toString()).toBe('C5');
    expect(c.distanceTo('G4')).toBe('perfectFifth');
    expect(c.semitonesTo('G4')).toBe(7);
    expect(c.toTuple()).toEqual(['C', 4, 60, c.frequency]);
    expect(c.toString()).toBe('C4');
    expect(c.valueOf()).toBe(60);
    expect(JSON.stringify(c)).toContain('"note":"C"');
  });

  it('uses Note static methods without error', () => {
    expect(Note.fromMidi(60).toString()).toBe('C4');
    expect(Note.nearestTo(440).toString()).toBe('A4');
    expect(Note.create('C#4').toString()).toBe('C#4');
    expect(Note.isNoteLike('C4')).toBe(true);
    expect(Note.compare('C4', 'D4')).toBe(-1);
    expect(applyInterval(Note.create('C4'), 'perfectFifth').toString()).toBe('G4');
  });
});
