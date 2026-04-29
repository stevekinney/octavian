import { Chord, type ChordVoicing } from './chord.js';
import type { ChordQuality } from './chords.js';
import type { Key } from './key.js';
import { type Note, type NoteLike } from './note.js';
import {
  RomanNumeral,
  type RomanNumeralDegree,
  type RomanNumeralInversion,
  type RomanNumeralLike,
  type RomanNumeralQuality,
} from './roman-numeral.js';

/**
 * Common-practice cadence categories recognized by Octavian.
 *
 * `'authentic-perfect'` and `'authentic-imperfect'` both describe
 * dominant-to-tonic motion. With explicit voicing, the final chord's
 * soprano determines whether the authentic cadence is perfect: tonic
 * in the soprano is perfect; any other soprano is imperfect. Without
 * voicing, root-position V→I is treated as the chord-symbol best
 * effort for a perfect authentic cadence.
 */
export type CadenceType =
  | 'authentic-perfect'
  | 'authentic-imperfect'
  | 'half'
  | 'plagal'
  | 'deceptive'
  | 'phrygian';

/**
 * Explicit voice-leading context for a chord in cadence analysis.
 *
 * Passing a raw note list validates the note collection with
 * {@link Chord.voicing}; passing a {@link ChordVoicing} reuses its
 * already-normalized notes.
 */
export type CadenceVoicing = ChordVoicing | readonly NoteLike[];

/**
 * A chord plus optional voicing context for cadence analysis.
 */
export type VoicedCadenceChord = {
  readonly chord: Chord;
  readonly voicing?: CadenceVoicing;
};

/**
 * Inputs accepted by cadence detection: concrete chords, voiced chords,
 * or Roman-numeral values/strings/snapshots.
 */
export type CadenceInput = Chord | VoicedCadenceChord | RomanNumeralLike;

/**
 * A cadence located between two adjacent entries in a longer progression.
 */
export type CadenceOccurrence = {
  readonly type: CadenceType;
  readonly startIndex: number;
  readonly endIndex: number;
  readonly from: CadenceInput;
  readonly to: CadenceInput;
};

type CadenceHarmony = {
  readonly degree: RomanNumeralDegree | null;
  readonly quality: RomanNumeralQuality | null;
  readonly inversion: RomanNumeralInversion;
  readonly soprano: Note | null;
};

const SCALE_DEGREES: readonly RomanNumeralDegree[] = [1, 2, 3, 4, 5, 6, 7];
const TRIAD_INVERSION_BY_INDEX: readonly RomanNumeralInversion[] = ['5/3', '6', '6/4'];
const SEVENTH_INVERSION_BY_INDEX: readonly RomanNumeralInversion[] = ['7', '6/5', '4/3', '4/2'];

/**
 * Identifies the cadence formed by two adjacent harmony inputs in a key.
 *
 * Inputs may be {@link Chord} instances, voiced chord objects, or
 * Roman numerals such as `'V'`, `'I6'`, and `'iv⁶'`. Altered and
 * applied Roman numerals are intentionally not interpreted as v1
 * cadence endpoints.
 */
export function identifyCadence(
  key: Key,
  firstInput: CadenceInput,
  secondInput: CadenceInput,
): CadenceType | null {
  const first = cadenceHarmonyForInput(key, firstInput);
  const second = cadenceHarmonyForInput(key, secondInput);

  if (isPhrygianCadence(key, first, second)) {
    return 'phrygian';
  }
  if (isDominant(key, first) && isTonic(key, second)) {
    return isPerfectAuthenticCadence(key, first, second)
      ? 'authentic-perfect'
      : 'authentic-imperfect';
  }
  if (isDominant(key, second)) {
    return 'half';
  }
  if (isSubdominant(key, first) && isTonic(key, second)) {
    return 'plagal';
  }
  if (isDominant(key, first) && isSubmediant(key, second)) {
    return 'deceptive';
  }

  return null;
}

/**
 * Scans a progression for cadences between adjacent harmony inputs.
 */
export function identifyCadenceSequence(
  key: Key,
  inputs: readonly CadenceInput[],
): readonly CadenceOccurrence[] {
  const cadences: CadenceOccurrence[] = [];
  for (let startIndex = 0; startIndex < inputs.length - 1; startIndex += 1) {
    const first = inputs[startIndex];
    const second = inputs[startIndex + 1];
    if (first === undefined || second === undefined) {
      continue;
    }
    const type = identifyCadence(key, first, second);
    if (type === null) {
      continue;
    }
    cadences.push(
      Object.freeze({
        type,
        startIndex,
        endIndex: startIndex + 1,
        from: first,
        to: second,
      }),
    );
  }
  return Object.freeze(cadences);
}

function cadenceHarmonyForInput(key: Key, input: CadenceInput): CadenceHarmony {
  if (input instanceof Chord) {
    return cadenceHarmonyForChord(key, input);
  }
  if (isVoicedCadenceChord(input)) {
    return cadenceHarmonyForChord(key, input.chord, input.voicing);
  }
  return cadenceHarmonyForRomanNumeral(RomanNumeral.create(input));
}

function isVoicedCadenceChord(input: CadenceInput): input is VoicedCadenceChord {
  if (typeof input !== 'object' || input === null || !('chord' in input)) {
    return false;
  }
  return input.chord instanceof Chord;
}

function cadenceHarmonyForRomanNumeral(numeral: RomanNumeral): CadenceHarmony {
  if (numeral.alteration !== undefined || numeral.applied !== undefined) {
    return {
      degree: null,
      quality: null,
      inversion: numeral.inversion,
      soprano: null,
    };
  }
  return {
    degree: numeral.degree,
    quality: numeral.quality,
    inversion: numeral.inversion,
    soprano: null,
  };
}

function cadenceHarmonyForChord(key: Key, chord: Chord, voicing?: CadenceVoicing): CadenceHarmony {
  return {
    degree: degreeForChordRoot(key, chord),
    quality: romanQualityForChordQuality(chord.quality),
    inversion: inversionForChord(chord),
    soprano: sopranoForVoicing(chord, voicing),
  };
}

function degreeForChordRoot(key: Key, chord: Chord): RomanNumeralDegree | null {
  for (const degree of SCALE_DEGREES) {
    if (key.scale.degree(degree).chromaticIndex === chord.root.chromaticIndex) {
      return degree;
    }
  }
  return null;
}

function romanQualityForChordQuality(quality: ChordQuality): RomanNumeralQuality | null {
  switch (quality) {
    case 'major':
    case 'dominant':
      return 'major';
    case 'minor':
      return 'minor';
    case 'diminished':
      return 'diminished';
    case 'augmented':
      return 'augmented';
    case 'suspended':
    case 'altered':
      return null;
  }
}

function inversionForChord(chord: Chord): RomanNumeralInversion {
  const table = chord.size === 4 ? SEVENTH_INVERSION_BY_INDEX : TRIAD_INVERSION_BY_INDEX;
  return table[chord.inversionIndex] ?? '5/3';
}

function sopranoForVoicing(chord: Chord, voicing: CadenceVoicing | undefined): Note | null {
  if (voicing === undefined) {
    return null;
  }
  const notes = isNoteLikeArray(voicing) ? voicing : voicing.notes;
  const normalized = chord.voicing(notes);
  const soprano = normalized.notes.at(-1);
  if (soprano === undefined) {
    throw new RangeError('Cadence voicing must contain at least one note.');
  }
  return soprano;
}

function isNoteLikeArray(voicing: CadenceVoicing): voicing is readonly NoteLike[] {
  return Array.isArray(voicing);
}

function isPhrygianCadence(key: Key, first: CadenceHarmony, second: CadenceHarmony): boolean {
  return (
    key.mode === 'minor' &&
    isSubdominant(key, first) &&
    first.inversion === '6' &&
    isDominant(key, second)
  );
}

function isDominant(_key: Key, harmony: CadenceHarmony): boolean {
  return harmony.degree === 5 && harmony.quality === 'major';
}

function isTonic(key: Key, harmony: CadenceHarmony): boolean {
  return harmony.degree === 1 && harmony.quality === (key.mode === 'major' ? 'major' : 'minor');
}

function isSubdominant(key: Key, harmony: CadenceHarmony): boolean {
  return harmony.degree === 4 && harmony.quality === (key.mode === 'major' ? 'major' : 'minor');
}

function isSubmediant(key: Key, harmony: CadenceHarmony): boolean {
  return harmony.degree === 6 && harmony.quality === (key.mode === 'major' ? 'minor' : 'major');
}

function isRootPosition(harmony: CadenceHarmony): boolean {
  return harmony.inversion === '5/3' || harmony.inversion === '7';
}

function isPerfectAuthenticCadence(
  key: Key,
  first: CadenceHarmony,
  second: CadenceHarmony,
): boolean {
  if (!isRootPosition(first) || !isRootPosition(second)) {
    return false;
  }
  if (second.soprano === null) {
    return true;
  }
  return second.soprano.chromaticIndex === key.tonic.chromaticIndex;
}
