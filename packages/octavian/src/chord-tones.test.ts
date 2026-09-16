import { describe, expect, it } from 'bun:test';
import { chordRequirements, omittedIntervalsFor, normalizePlayedNotes } from './chord-tones.js';

describe('shared chord tone requirements', () => {
  it('allows only the documented omissions', () => {
    expect(omittedIntervalsFor(chordRequirements('C'), [0, 4])).toEqual(['perfectFifth']);
    expect(omittedIntervalsFor(chordRequirements('C', 'none'), [0, 4])).toBeNull();
    expect(omittedIntervalsFor(chordRequirements('C13'), [0, 4, 10, 9])).toEqual([
      'perfectFifth',
      'majorNinth',
      'perfectEleventh',
    ]);
    expect(omittedIntervalsFor(chordRequirements('Csus4'), [0, 5])).toBeNull();
    expect(omittedIntervalsFor(chordRequirements('C5'), [0])).toBeNull();
    expect(omittedIntervalsFor(chordRequirements('C7sus4'), [0, 5, 7, 10])).toEqual([]);
    expect(omittedIntervalsFor(chordRequirements('C'), [0, 4, 7, 1])).toBeNull();
    expect(omittedIntervalsFor(chordRequirements('C'), [4, 7])).toBeNull();
  });
  it('normalizes actual pitches without losing octave doublings', () => {
    expect(normalizePlayedNotes(['C4', 60, 'C5', 'E4']).map((note) => Number(note.midi))).toEqual([
      60, 64, 72,
    ]);
    expect(() => normalizePlayedNotes(['C'])).toThrow();
    expect(() => normalizePlayedNotes([128])).toThrow();
    expect(() => chordRequirements('C', 'invalid' as never)).toThrow();
    expect(() => chordRequirements({} as never)).toThrow(TypeError);
  });
});
