import { describe, expect, it } from 'bun:test';
import { keyboardRange } from './piano-keyboard.js';
import { pianoVoicingsFor } from './piano-voicings.js';

type OracleEntry = [number[], number];

function validOracleSplit(notes: number[], split: number): boolean {
  const left = notes.slice(0, split);
  const right = notes.slice(split);
  return (
    left.length <= 2 &&
    right.length <= 2 &&
    (left.at(-1) ?? 0) - (left[0] ?? 0) <= 12 &&
    (right.at(-1) ?? 0) - (right[0] ?? 0) <= 12
  );
}

function compareOracleEntries(
  [leftNotes, leftSplit]: OracleEntry,
  [rightNotes, rightSplit]: OracleEntry,
): number {
  for (let index = 0; index < Math.min(leftNotes.length, rightNotes.length); index += 1) {
    if (leftNotes[index] !== rightNotes[index]) return leftNotes[index]! - rightNotes[index]!;
  }
  return leftNotes.length - rightNotes.length || leftSplit - rightSplit;
}

function bruteForceOracle(): OracleEntry[] {
  const candidateMidis = [60, 64, 67, 72];
  const expected: OracleEntry[] = [];
  for (let mask = 1; mask < 1 << candidateMidis.length; mask += 1) {
    const notes = candidateMidis.filter((_, index) => mask & (1 << index));
    const pitchClasses = notes.map((midi) => midi % 12);
    if (notes.length > 4 || ![0, 4, 7].every((pitchClass) => pitchClasses.includes(pitchClass)))
      continue;
    for (let split = 0; split <= notes.length; split += 1) {
      if (validOracleSplit(notes, split)) expected.push([notes, split]);
    }
  }
  return expected.toSorted(compareOracleEntries);
}

describe('pianoVoicingsFor', () => {
  it('yields sorted, distinct keys with every required tone', () => {
    const voicings = [
      ...pianoVoicingsFor('C', {
        range: keyboardRange(60, 67),
        maxNotesPerHand: 3,
        maxHandSpan: 12,
      }),
    ];

    expect(voicings.length).toBeGreaterThan(0);
    for (const voicing of voicings) {
      const midis = voicing.notes.map((note) => Number(note.midi));
      expect(midis).toEqual(midis.toSorted((a, b) => a - b));
      expect(new Set(midis).size).toBe(midis.length);
      expect(voicing.leftHand.every((key) => key.midi < (voicing.rightHand[0]?.midi ?? 128))).toBe(
        true,
      );
      expect(Object.isFrozen(voicing)).toBe(true);
      expect(Object.isFrozen(voicing.notes)).toBe(true);
      expect(Object.isFrozen(voicing.leftHand)).toBe(true);
      expect(Object.isFrozen(voicing.rightHand)).toBe(true);
      expect(Object.isFrozen(voicing.omittedIntervals)).toBe(true);
      for (const key of [...voicing.leftHand, ...voicing.rightHand])
        expect(Object.isFrozen(key)).toBe(true);
    }
  });

  it('supports one hand, exact omissions, and slash basses', () => {
    const left = [
      ...pianoVoicingsFor('Cmaj7', {
        range: keyboardRange(60, 72),
        hands: 'left',
        omissions: 'none',
        maxNotesPerHand: 5,
      }),
    ];
    expect(left.length).toBeGreaterThan(0);
    expect(
      left.every(
        (voicing) => voicing.rightHand.length === 0 && voicing.omittedIntervals.length === 0,
      ),
    ).toBe(true);

    const slash = [
      ...pianoVoicingsFor('C/E', {
        range: keyboardRange(60, 72),
        maxNotesPerHand: 3,
      }),
    ];
    expect(slash.length).toBeGreaterThan(0);
    expect(slash.every((voicing) => voicing.bass.chromaticIndex === 4)).toBe(true);
  });

  it('validates bounds before iteration and snapshots options', () => {
    expect(() => pianoVoicingsFor('C', { maxNotesPerHand: 0 })).toThrow(RangeError);
    expect(() => pianoVoicingsFor('C', { maxNotesPerHand: 6 })).toThrow(RangeError);
    expect(() => pianoVoicingsFor('C', { maxHandSpan: -1 })).toThrow(RangeError);
    expect(() => pianoVoicingsFor('C', { hands: 'nope' as 'both' })).toThrow(TypeError);

    const range = keyboardRange(60, 64);
    const iterator = pianoVoicingsFor('C', { range, maxNotesPerHand: 3 });
    expect(iterator.next().done).toBe(false);

    expect(() => pianoVoicingsFor('C', { range: { from: 65, to: 60 } as never })).toThrow(
      RangeError,
    );
    expect(() => pianoVoicingsFor('C', { maxHandSpan: 128 })).toThrow(RangeError);
    expect(
      [...pianoVoicingsFor('C', { range: keyboardRange(60, 72), hands: 'right' })].every(
        (voicing) => voicing.leftHand.length === 0,
      ),
    ).toBe(true);
    expect([...pianoVoicingsFor('C', { range: keyboardRange(60, 62), omissions: 'none' })]).toEqual(
      [],
    );
    expect([
      ...pianoVoicingsFor('C', {
        range: keyboardRange(60, 67),
        hands: 'left',
        maxNotesPerHand: 2,
        maxHandSpan: 3,
      }),
    ]).toEqual([]);
  });

  it('matches an independent brute-force oracle and preserves prefix ordering', () => {
    const range = keyboardRange(60, 72);
    const actual = [
      ...pianoVoicingsFor('C', {
        range,
        omissions: 'none',
        maxNotesPerHand: 2,
        maxHandSpan: 12,
      }),
    ].map((voicing) => [voicing.notes.map((note) => Number(note.midi)), voicing.leftHand.length]);
    expect(actual).toEqual(bruteForceOracle());
  });

  it('returns immediately from a full keyboard iterator', () => {
    const iterator = pianoVoicingsFor('C', { maxNotesPerHand: 1, maxHandSpan: 0 });
    const first = iterator.next();
    expect(first.done).toBe(false);
    expect(first.value?.notes.length).toBe(2);
    expect(iterator.return!().done).toBe(true);
    expect(iterator.next().done).toBe(true);
  });

  it('snapshots mutable keyboard bounds and hand settings at call time', () => {
    const range = { ...keyboardRange(60, 67) };
    const options = { range, maxNotesPerHand: 3, maxHandSpan: 12 };
    const expected = [...pianoVoicingsFor('C', options)];
    const iterator = pianoVoicingsFor('C', options);
    range.from = keyboardRange(0, 0).from;
    range.to = range.from;
    options.maxNotesPerHand = 1;
    options.maxHandSpan = 0;
    expect([...iterator]).toEqual(expected);
  });
});
