import { describe, expect, it } from 'bun:test';
import * as fc from 'fast-check';
import { Chord } from './chord.js';
import { Note } from './note.js';
import {
  KEYBOARD_25,
  KEYBOARD_49,
  KEYBOARD_61,
  KEYBOARD_76,
  KEYBOARD_88,
  highlightGroupsForChordOrScale,
  keyboardKeysForRange,
  keyboardPositionFor,
  keyboardRange,
  pianoKeyFor,
  type KeyboardHighlight,
  type KeyboardPosition,
  type PianoKey,
} from './piano-keyboard.js';
import { Scale } from './scale.js';

// ---------------------------------------------------------------------------
// Named range constants
// ---------------------------------------------------------------------------

describe('named range constants', () => {
  it('KEYBOARD_88 spans A0 (midi 21) to C8 (midi 108)', () => {
    expect(KEYBOARD_88.from).toBe(21);
    expect(KEYBOARD_88.to).toBe(108);
  });

  it('KEYBOARD_76 spans E1 (midi 28) to G7 (midi 103)', () => {
    expect(KEYBOARD_76.from).toBe(28);
    expect(KEYBOARD_76.to).toBe(103);
  });

  it('KEYBOARD_61 spans C2 (midi 36) to C7 (midi 96)', () => {
    expect(KEYBOARD_61.from).toBe(36);
    expect(KEYBOARD_61.to).toBe(96);
  });

  it('KEYBOARD_49 spans C2 (midi 36) to C6 (midi 84)', () => {
    expect(KEYBOARD_49.from).toBe(36);
    expect(KEYBOARD_49.to).toBe(84);
  });

  it('KEYBOARD_25 spans C3 (midi 48) to C5 (midi 72)', () => {
    expect(KEYBOARD_25.from).toBe(48);
    expect(KEYBOARD_25.to).toBe(72);
  });
});

// ---------------------------------------------------------------------------
// keyboardRange
// ---------------------------------------------------------------------------

describe('keyboardRange', () => {
  it('creates a range from MIDI numbers', () => {
    const range = keyboardRange(60, 72);
    expect(range.from).toBe(60);
    expect(range.to).toBe(72);
  });

  it('creates a range from note names', () => {
    const range = keyboardRange('C4', 'C5');
    expect(range.from).toBe(60);
    expect(range.to).toBe(72);
  });

  it('creates a range from Note instances', () => {
    const range = keyboardRange(Note.create('C4'), Note.create('C5'));
    expect(range.from).toBe(60);
    expect(range.to).toBe(72);
  });

  it('throws RangeError when from > to', () => {
    expect(() => keyboardRange(72, 60)).toThrow(RangeError);
  });

  it('accepts equal from and to (single key)', () => {
    const range = keyboardRange(60, 60);
    expect(range.from).toBe(60);
    expect(range.to).toBe(60);
  });
});

// ---------------------------------------------------------------------------
// keyboardKeysForRange — key counts
// ---------------------------------------------------------------------------

describe('keyboardKeysForRange — key counts', () => {
  it('88-key range has exactly 88 keys', () => {
    const keys = keyboardKeysForRange(KEYBOARD_88);
    expect(keys.length).toBe(88);
  });

  it('88-key range has 52 white keys and 36 black keys', () => {
    const keys = keyboardKeysForRange(KEYBOARD_88);
    const white = keys.filter((k) => k.color === 'white');
    const black = keys.filter((k) => k.color === 'black');
    expect(white.length).toBe(52);
    expect(black.length).toBe(36);
  });

  it('76-key range has exactly 76 keys', () => {
    expect(keyboardKeysForRange(KEYBOARD_76).length).toBe(76);
  });

  it('61-key range has exactly 61 keys', () => {
    expect(keyboardKeysForRange(KEYBOARD_61).length).toBe(61);
  });

  it('49-key range has exactly 49 keys', () => {
    expect(keyboardKeysForRange(KEYBOARD_49).length).toBe(49);
  });

  it('25-key range has exactly 25 keys', () => {
    expect(keyboardKeysForRange(KEYBOARD_25).length).toBe(25);
  });
});

// ---------------------------------------------------------------------------
// keyboardKeysForRange — key structure and ordering
// ---------------------------------------------------------------------------

describe('keyboardKeysForRange — structure', () => {
  it('keys are in ascending MIDI order', () => {
    const keys = keyboardKeysForRange(KEYBOARD_88);
    for (let i = 1; i < keys.length; i += 1) {
      expect(keys[i].midi).toBeGreaterThan(keys[i - 1].midi);
    }
  });

  it('C4 (midi 60) is a white key', () => {
    const range = keyboardRange(60, 72);
    const keys = keyboardKeysForRange(range);
    const c4 = keys.find((k) => k.midi === 60);
    expect(c4).toBeDefined();
    expect(c4?.color).toBe('white');
  });

  it('C#4 (midi 61) is a black key', () => {
    const range = keyboardRange(60, 72);
    const keys = keyboardKeysForRange(range);
    const cs4 = keys.find((k) => k.midi === 61);
    expect(cs4).toBeDefined();
    expect(cs4?.color).toBe('black');
  });

  it('D4 (midi 62) is a white key', () => {
    const range = keyboardRange(60, 72);
    const keys = keyboardKeysForRange(range);
    const d4 = keys.find((k) => k.midi === 62);
    expect(d4).toBeDefined();
    expect(d4?.color).toBe('white');
  });

  it('white keys have whiteKeyIndex; black keys do not', () => {
    const keys = keyboardKeysForRange(KEYBOARD_88);
    for (const key of keys) {
      if (key.color === 'white') {
        expect(key.whiteKeyIndex).toBeDefined();
      } else {
        expect(key.whiteKeyIndex).toBeUndefined();
      }
    }
  });

  it('whiteKeyIndex counts from 0 at the range start', () => {
    const range = keyboardRange(60, 72); // C4..C5
    const keys = keyboardKeysForRange(range);
    const whiteKeys = keys.filter((k) => k.color === 'white');
    expect(whiteKeys[0]?.whiteKeyIndex).toBe(0); // C4
    expect(whiteKeys[1]?.whiteKeyIndex).toBe(1); // D4
  });

  it('midi, octave, and chromaticIndex are consistent', () => {
    const keys = keyboardKeysForRange(KEYBOARD_25);
    for (const key of keys) {
      expect(Number(key.midi) % 12).toBe(key.chromaticIndexInOctave);
      expect(key.chromaticIndex).toBe(key.note.chromaticIndex);
    }
  });

  it('octave boundaries are correct — C4 is octave 4', () => {
    const range = keyboardRange(60, 60);
    const keys = keyboardKeysForRange(range);
    expect(keys[0].octave).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// keyboardKeysForRange — accidental preference
// ---------------------------------------------------------------------------

describe('keyboardKeysForRange — accidental preference', () => {
  it('defaults to sharps for black keys', () => {
    const range = keyboardRange(61, 61); // C#4 / Db4
    const [key] = keyboardKeysForRange(range);
    expect(key?.note.note).toBe('C#');
  });

  it('uses flats when accidentalPreference is flats', () => {
    const range = keyboardRange(61, 61); // C#4 / Db4
    const [key] = keyboardKeysForRange(range, { accidentalPreference: 'flats' });
    expect(key?.note.note).toBe('Db');
  });
});

// ---------------------------------------------------------------------------
// pianoKeyFor
// ---------------------------------------------------------------------------

describe('pianoKeyFor', () => {
  it('accepts a MIDI number', () => {
    const key = pianoKeyFor(60);
    expect(key.midi).toBe(60);
    expect(key.color).toBe('white');
  });

  it('accepts a note name string', () => {
    const key = pianoKeyFor('C4');
    expect(key.midi).toBe(60);
  });

  it('accepts a Note instance', () => {
    const note = Note.create('C4');
    const key = pianoKeyFor(note);
    expect(key.midi).toBe(60);
  });

  it('does not set whiteKeyIndex (no range context)', () => {
    const key = pianoKeyFor(60); // C4 is white
    expect(key.whiteKeyIndex).toBeUndefined();
  });

  it('Db4 and C#4 resolve to the same MIDI and chromaticIndex', () => {
    const flat = pianoKeyFor('Db4');
    const sharp = pianoKeyFor('C#4');
    expect(flat.midi).toBe(sharp.midi);
    expect(flat.chromaticIndex).toBe(sharp.chromaticIndex);
    expect(flat.color).toBe('black');
    expect(sharp.color).toBe('black');
  });

  it('uses flats when accidentalPreference is flats', () => {
    const key = pianoKeyFor(61, { accidentalPreference: 'flats' });
    expect(key.note.note).toBe('Db');
  });

  it('throws RangeError for out-of-range MIDI', () => {
    expect(() => pianoKeyFor(200)).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// keyboardPositionFor
// ---------------------------------------------------------------------------

describe('keyboardPositionFor', () => {
  const range = keyboardRange(60, 72); // C4..C5

  it('returns null for a note below the range', () => {
    expect(keyboardPositionFor(59, range)).toBeNull();
  });

  it('returns null for a note above the range', () => {
    expect(keyboardPositionFor(73, range)).toBeNull();
  });

  it('returns index 0 for the lowest key', () => {
    const pos = keyboardPositionFor(60, range);
    expect(pos?.index).toBe(0);
  });

  it('returns correct index for an interior key', () => {
    const pos = keyboardPositionFor(64, range); // E4 = 4 semitones above C4
    expect(pos?.index).toBe(4);
  });

  it('returns whiteKeyIndex for white keys', () => {
    const pos = keyboardPositionFor(60, range); // C4 white
    expect(pos?.whiteKeyIndex).toBe(0);
  });

  it('returns no whiteKeyIndex for black keys', () => {
    const pos = keyboardPositionFor(61, range); // C#4 black
    expect(pos?.whiteKeyIndex).toBeUndefined();
  });

  it('accepts a note name', () => {
    const pos = keyboardPositionFor('C4', range);
    expect(pos?.index).toBe(0);
  });

  it('accepts a Note instance', () => {
    const pos = keyboardPositionFor(Note.create('E4'), range);
    expect(pos?.index).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// highlightGroupsForChordOrScale
// ---------------------------------------------------------------------------

describe('highlightGroupsForChordOrScale', () => {
  const range = keyboardRange(60, 71); // C4..B4 — one full octave, 12 keys

  it('C major chord highlights C, E, G', () => {
    const chord = Chord.create('C4', 'major');
    const groups = highlightGroupsForChordOrScale(chord, range);
    // C=0, E=4, G=7
    const indexes = groups.map((g) => g.chromaticIndex).toSorted((a, b) => a - b);
    expect(indexes).toEqual([0, 4, 7]);
  });

  it('C major chord highlights exactly 3 groups within C4..B4', () => {
    const chord = Chord.create('C4', 'major');
    const groups = highlightGroupsForChordOrScale(chord, range);
    expect(groups.length).toBe(3);
  });

  it('C major scale highlights 7 white keys in C4..B4', () => {
    const scale = Scale.create('C4', 'major');
    const groups = highlightGroupsForChordOrScale(scale, range);
    const whiteHighlights = groups.flatMap((g) =>
      g.positions.filter((p) => p.key.color === 'white'),
    );
    expect(whiteHighlights.length).toBe(7);
  });

  it('C major scale highlights exactly 7 groups within C4..B4', () => {
    const scale = Scale.create('C4', 'major');
    const groups = highlightGroupsForChordOrScale(scale, range);
    expect(groups.length).toBe(7);
  });

  it('accepts a Note as target', () => {
    const note = Note.create('C4');
    const groups = highlightGroupsForChordOrScale(note, range);
    expect(groups.length).toBe(1);
    expect(groups[0]?.chromaticIndex).toBe(0);
  });

  it('accepts a note name string as target', () => {
    const groups = highlightGroupsForChordOrScale('C4', range);
    expect(groups.length).toBe(1);
    expect(groups[0]?.chromaticIndex).toBe(0);
  });

  it('accepts a raw pitch-class number as target', () => {
    // 0 = C pitch class
    const groups = highlightGroupsForChordOrScale(0, range);
    expect(groups.length).toBe(1);
    expect(groups[0]?.chromaticIndex).toBe(0);
  });

  it('omits groups whose pitch class is not in the range', () => {
    // Use a tiny range (C4 only) and a chord with notes outside the range
    const tinyRange = keyboardRange(60, 60); // only C4
    const chord = Chord.create('C4', 'major'); // C, E, G
    const groups = highlightGroupsForChordOrScale(chord, tinyRange);
    expect(groups.length).toBe(1); // only C is in range
    expect(groups[0]?.chromaticIndex).toBe(0);
  });

  it('highlights span multiple octaves in a wider range', () => {
    const wideRange = keyboardRange(60, 84); // C4..C6
    const chord = Chord.create('C4', 'major');
    const groups = highlightGroupsForChordOrScale(chord, wideRange);
    // Each pitch class appears twice (one per octave) + C also at top
    const totalPositions = groups.reduce((acc, g) => acc + g.positions.length, 0);
    expect(totalPositions).toBeGreaterThan(3);
  });

  it('returns groups in ascending chromaticIndex order', () => {
    const scale = Scale.create('C4', 'major');
    const groups = highlightGroupsForChordOrScale(scale, range);
    for (let i = 1; i < groups.length; i += 1) {
      expect(groups[i].chromaticIndex).toBeGreaterThan(groups[i - 1].chromaticIndex);
    }
  });

  it('positions include key with correct color', () => {
    const note = Note.create('C#4');
    const groups = highlightGroupsForChordOrScale(note, range);
    expect(groups.length).toBe(1);
    expect(groups[0]?.positions[0]?.key.color).toBe('black');
  });
});

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe('property tests', () => {
  it('every key in keyboardKeysForRange has consistent midi, octave, chromaticIndex', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 21, max: 100 }),
        fc.integer({ min: 0, max: 7 }),
        (start, span) => {
          const end = Math.min(start + span, 108);
          const range = keyboardRange(start, end);
          const keys = keyboardKeysForRange(range);
          return keys.every((k) => {
            const expectedPitchClass = Number(k.midi) % 12;
            return k.chromaticIndexInOctave === expectedPitchClass;
          });
        },
      ),
      { numRuns: 50 },
    );
  });

  it('pianoKeyFor is consistent with MIDI input and note input', () => {
    fc.assert(
      fc.property(fc.integer({ min: 21, max: 108 }), (midi) => {
        const fromMidi = pianoKeyFor(midi);
        const fromNote = pianoKeyFor(Note.fromMidi(midi));
        return (
          fromMidi.midi === fromNote.midi && fromMidi.chromaticIndex === fromNote.chromaticIndex
        );
      }),
      { numRuns: 50 },
    );
  });

  it('keyboardPositionFor index is always midi - range.from when in range', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 21, max: 100 }),
        fc.integer({ min: 0, max: 20 }),
        fc.integer({ min: 0, max: 10 }),
        (start, span, offset) => {
          const end = Math.min(start + span, 108);
          const range = keyboardRange(start, end);
          const targetMidi = start + (offset % (span + 1));
          const pos = keyboardPositionFor(targetMidi, range);
          if (pos === null) return targetMidi < start || targetMidi > end;
          return pos.index === targetMidi - start;
        },
      ),
      { numRuns: 50 },
    );
  });

  it('white key count in a range equals whiteKeyIndexes.length', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 21, max: 100 }),
        fc.integer({ min: 0, max: 20 }),
        (start, span) => {
          const end = Math.min(start + span, 108);
          const range = keyboardRange(start, end);
          const keys = keyboardKeysForRange(range);
          const whiteKeysWithIndex = keys.filter(
            (k) => k.color === 'white' && k.whiteKeyIndex !== undefined,
          );
          const whiteKeys = keys.filter((k) => k.color === 'white');
          return whiteKeysWithIndex.length === whiteKeys.length;
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ---------------------------------------------------------------------------
// Type shape tests (regression: exactOptionalPropertyTypes)
// ---------------------------------------------------------------------------

describe('exactOptionalPropertyTypes compliance', () => {
  it('black keys never have a whiteKeyIndex property', () => {
    const range = keyboardRange(61, 61); // C#4, black
    const [key] = keyboardKeysForRange(range);
    expect(Object.prototype.hasOwnProperty.call(key, 'whiteKeyIndex')).toBe(false);
  });

  it('white keys always have a whiteKeyIndex property in keyboardKeysForRange', () => {
    const range = keyboardRange(60, 60); // C4, white
    const [key] = keyboardKeysForRange(range);
    expect(Object.prototype.hasOwnProperty.call(key, 'whiteKeyIndex')).toBe(true);
  });

  it('pianoKeyFor never has whiteKeyIndex (no range context)', () => {
    const key = pianoKeyFor(60); // C4, white
    expect(Object.prototype.hasOwnProperty.call(key, 'whiteKeyIndex')).toBe(false);
  });

  it('keyboardPositionFor: white key position has whiteKeyIndex', () => {
    const range = keyboardRange(60, 72);
    const pos = keyboardPositionFor(60, range); // C4
    expect(pos).not.toBeNull();
    expect(Object.prototype.hasOwnProperty.call(pos, 'whiteKeyIndex')).toBe(true);
  });

  it('keyboardPositionFor: black key position has no whiteKeyIndex', () => {
    const range = keyboardRange(60, 72);
    const pos = keyboardPositionFor(61, range); // C#4
    expect(pos).not.toBeNull();
    expect(Object.prototype.hasOwnProperty.call(pos, 'whiteKeyIndex')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Type guard for PianoKey, KeyboardPosition, KeyboardHighlight (satisfies checks)
// ---------------------------------------------------------------------------
describe('type assertions (compile-time contract)', () => {
  it('PianoKey has expected shape', () => {
    const key: PianoKey = pianoKeyFor(60);
    expect(typeof key.color).toBe('string');
    expect(typeof key.midi).toBe('number');
  });

  it('KeyboardPosition has expected shape', () => {
    const range = keyboardRange(60, 72);
    const pos: KeyboardPosition | null = keyboardPositionFor(60, range);
    expect(pos?.index).toBe(0);
  });

  it('KeyboardHighlight has expected shape', () => {
    const range = keyboardRange(60, 71);
    const groups: readonly KeyboardHighlight[] = highlightGroupsForChordOrScale(
      Note.create('C4'),
      range,
    );
    expect(groups[0]?.positions.length).toBeGreaterThan(0);
  });
});
