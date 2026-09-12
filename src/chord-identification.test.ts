import { describe, expect, it } from 'bun:test';
import {
  identifyChords,
  identifyGuitarChords,
  identifyPianoChords,
} from './chord-identification.js';
import { Key } from './key.js';
import { Note } from './note.js';

describe('chord identification', () => {
  it('breaks equal musical ranks deterministically by name', () => {
    const names = identifyChords(['G#3', 'C4', 'E4']).map((candidate) => candidate.name);
    expect(names.indexOf('Caug/G#')).toBeLessThan(names.indexOf('Eaug/G#'));
    expect(() => identifyChords([], { key: {} as never })).toThrow(TypeError);
  });
  it('identifies open guitar chords and sounding bass inversions', () => {
    expect(identifyGuitarChords([null, 3, 2, 0, 1, 0])[0]?.name).toBe('C');
    const candidate = identifyChords(['E3', 'C4', 'G4'])[0]!;
    expect(candidate.name).toBe('C/E');
    expect(candidate.bass.midi).toBe(52);
    expect(candidate.root).toBe('C');
    expect(candidate.match).toBe('exact');
  });
  it('retains alternatives and lets the key rank ambiguous chords', () => {
    const notes = ['C3', 'E3', 'G3', 'A3'];
    expect(identifyChords(notes)[0]?.name).toBe('C6');
    expect(identifyChords(notes).map((entry) => entry.name)).toContain('Am7/C');
    expect(identifyChords(notes, { key: 'A minor' })[0]?.name).toBe('Am7/C');
    expect(identifyChords(notes, { key: Key.parse('C major') })[0]?.name).toBe('C6');
  });
  it('preserves enharmonic alternatives and actual played octaves', () => {
    const candidates = identifyPianoChords([61, 65, 68, 73, 61]);
    expect(candidates.map((entry) => entry.name)).toContain('Db');
    expect(candidates.map((entry) => entry.name)).toContain('C#');
    expect(identifyChords([61, 65, 68], { key: 'Db major' })[0]?.name).toBe('Db');
    expect(identifyChords([61, 65, 68], { key: 'F major' })[0]?.name).toBe('Db');
    expect(candidates[0]?.notes.map((note) => Number(note.midi))).toEqual([61, 65, 68, 73]);
    expect(identifyChords([Note.fromMidi(60), 'E4', 'G4'])[0]?.name).toBe('C');
  });
  it('uses the shared omission policy and freezes results', () => {
    const candidates = identifyChords([60, 64]);
    expect(candidates[0]?.omittedIntervals).toEqual(['perfectFifth']);
    expect(candidates[0]?.match).toBe('practical');
    expect(identifyChords([60, 64], { omissions: 'none' })).toEqual([]);
    expect(Object.isFrozen(candidates)).toBe(true);
    expect(Object.isFrozen(candidates[0])).toBe(true);
    expect(Object.isFrozen(candidates[0]?.aliases)).toBe(true);
  });
  it('identifies power and suspended dominant seventh catalog entries with aliases', () => {
    const power = identifyChords(['C3', 'G3'])[0]!;
    expect(power.name).toBe('C5');
    expect(power.suffix).toBe('power');
    expect(power.aliases).toContain('powerChord');

    const suspendedSecond = identifyChords(['C3', 'D3', 'G3', 'Bb3']).find(
      (entry) => entry.suffix === 'dominantSeventhSuspendedSecond',
    );
    expect(suspendedSecond?.name).toBe('C7sus2');
    expect(suspendedSecond?.aliases).toContain('dominantSeventhSuspendedSecond');

    const suspendedFourth = identifyChords(['C3', 'F3', 'G3', 'Bb3']).find(
      (entry) => entry.suffix === 'dominantSeventhSuspendedFourth',
    );
    expect(suspendedFourth?.name).toBe('C7sus4');
    expect(suspendedFourth?.aliases).toContain('7sus');
  });
  it('supports custom and reentrant tunings', () => {
    expect(
      identifyGuitarChords([0, 0, 0], { tuning: { strings: ['G4', 'C3', 'E4'] } })[0]?.name,
    ).toBe('C');
  });
  it('distinguishes empty or unmatched input from malformed input', () => {
    expect(identifyChords([])).toEqual([]);
    expect(identifyChords([60])).toEqual([]);
    expect(identifyChords([60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71])).toEqual([]);
    expect(identifyGuitarChords([null, null, null, null, null, null])).toEqual([]);
    expect(() => identifyGuitarChords([0])).toThrow();
    expect(() => identifyGuitarChords([], { tuning: { strings: [] } })).toThrow();
    expect(() => identifyGuitarChords([-1], { tuning: { strings: ['C3'] } })).toThrow();
    expect(() => identifyGuitarChords([null], { tuning: { strings: ['bad'] } })).toThrow();
    expect(() => identifyChords([], { omissions: 'bad' as never })).toThrow();
    expect(() => identifyChords([], { key: 'bad' })).toThrow();
    expect(() => identifyChords(['C'])).toThrow();
    expect(() => identifyChords([128])).toThrow();
  });
});
