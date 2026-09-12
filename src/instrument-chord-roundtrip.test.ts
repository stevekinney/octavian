import { describe, expect, it } from 'bun:test';
import { identifyChords } from './chord-identification.js';
import { guitarFingeringsFor } from './guitar-fingerings.js';
import { pianoVoicingsFor } from './piano-voicings.js';
import { keyboardRange } from './piano-keyboard.js';

type Shape = readonly (number | null)[];

function anchor(shape: Shape): number {
  const stopped = shape.filter((fret): fret is number => fret !== null && fret > 0);
  return stopped.length === 0 ? 0 : Math.min(...stopped);
}

function compareShapes(left: Shape, right: Shape): number {
  const leftAnchor = anchor(left);
  const rightAnchor = anchor(right);
  if (leftAnchor !== rightAnchor) return leftAnchor - rightAnchor;
  for (let index = 0; index < left.length; index += 1) {
    const difference = (left[index] ?? 128) - (right[index] ?? 128);
    if (difference) return difference;
  }
  return 0;
}

// Intentionally independent of production tone and assignment helpers.
function referenceShapes(
  open: readonly number[],
  required: readonly number[],
  span: number,
): Shape[] {
  const valid: Shape[] = [];
  const options = [0, 1, 2, 3, null] as const;
  for (const first of options)
    for (const second of options)
      for (const third of options) {
        const shape = [first, second, third];
        const stopped = shape.filter((fret): fret is number => fret !== null && fret > 0);
        const sounding = shape.flatMap((fret, index) =>
          fret === null ? [] : [(open[index]! + fret) % 12],
        );
        const fitsHand =
          stopped.length <= 2 &&
          (stopped.length === 0 || Math.max(...stopped) - Math.min(...stopped) <= span);
        const fitsChord =
          sounding.every((pitch) => required.includes(pitch)) &&
          required.every((pitch) => sounding.includes(pitch));
        if (fitsHand && fitsChord) valid.push(shape);
      }
  return valid.toSorted(compareShapes);
}

describe('instrument chord completeness and round trips', () => {
  it('matches exhaustive independent no-barre enumeration on tiny instruments', () => {
    for (const span of [0, 1, 3]) {
      for (const [name, required] of [
        ['C', [0, 4, 7]],
        ['C5', [0, 7]],
      ] as const) {
        const tuning = { strings: ['C3', 'E3', 'G3'] };
        const shapes = [
          ...guitarFingeringsFor(name, {
            tuning,
            maxFret: 3,
            maxFretSpan: span,
            availableFingers: 2,
            allowBarres: false,
            omissions: 'none',
          }),
        ];
        expect(shapes.map((shape) => shape.frets)).toEqual(
          referenceShapes([48, 52, 55], required, span),
        );
        expect(new Set(shapes.map((shape) => JSON.stringify(shape.frets))).size).toBe(
          shapes.length,
        );
        for (const shape of shapes)
          expect(
            identifyChords(shape.notes).some(
              (candidate) =>
                candidate.name === `${name}${shape.bass.chromaticIndex === 0 ? '' : '/G'}`,
            ),
          ).toBe(true);
      }
    }
  });

  it('recognizes every generated piano interpretation in a bounded search', () => {
    for (const name of ['C', 'C5', 'C7sus2', 'C7sus4']) {
      const voicings = [
        ...pianoVoicingsFor(name, { range: keyboardRange(60, 72), maxNotesPerHand: 3 }),
      ];
      expect(voicings.length).toBeGreaterThan(0);
      for (const voicing of voicings) {
        expect(
          identifyChords(voicing.notes).some(
            (candidate) => candidate.root === 'C' && candidate.name.split('/')[0] === name,
          ),
        ).toBe(true);
      }
    }
  });
});
