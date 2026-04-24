/**
 * A nominal brand used to distinguish validated numeric domains.
 */
export type Brand<T, Name extends string> = T & {
  readonly __brand: Name;
};

/**
 * Supported octave values for scientific pitch notation.
 */
export const OCTAVES = [-1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

const OCTAVE_SET = new Set<number>(OCTAVES);

/**
 * A supported octave value for scientific pitch notation.
 */
export type Octave = Brand<number, 'Octave'>;

/**
 * The twelve pitch classes in an equal-tempered octave.
 */
export const CHROMATIC_INDEXES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;

const CHROMATIC_INDEX_SET = new Set<number>(CHROMATIC_INDEXES);

/**
 * A pitch-class index in the range `0..11`.
 */
export type ChromaticIndex = (typeof CHROMATIC_INDEXES)[number];

/**
 * A validated MIDI key number in the range `0..127`.
 */
export type MidiKey = Brand<number, 'MidiKey'>;

/**
 * A validated frequency in hertz.
 */
export type Frequency = Brand<number, 'Frequency'>;

/**
 * A validated integer semitone distance.
 */
export type Semitones = Brand<number, 'Semitones'>;

/**
 * Creates a validated octave value.
 *
 * @param value The octave number to validate.
 * @returns The validated octave value.
 * @throws {RangeError} When the octave is not one of the supported values.
 */
export function createOctave(value: number): Octave {
  if (OCTAVE_SET.has(value)) {
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
    return value as Octave;
  }

  throw new RangeError(`Expected an octave in the range -1..9, received ${value}.`);
}

/**
 * Creates a validated chromatic index.
 *
 * @param value The pitch-class index to validate.
 * @returns The validated chromatic index.
 * @throws {RangeError} When the value is not an integer in the range `0..11`.
 */
export function createChromaticIndex(value: number): ChromaticIndex {
  if (CHROMATIC_INDEX_SET.has(value)) {
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
    return value as ChromaticIndex;
  }

  throw new RangeError(`Expected a chromatic index in the range 0..11, received ${value}.`);
}

/**
 * Creates a validated MIDI key number.
 *
 * @param value The MIDI key to validate.
 * @returns The validated MIDI key number.
 * @throws {RangeError} When the value is not an integer in the range `0..127`.
 */
export function createMidiKey(value: number): MidiKey {
  if (Number.isInteger(value) && value >= 0 && value <= 127) {
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
    return value as MidiKey;
  }

  throw new RangeError(`Expected a MIDI key in the range 0..127, received ${value}.`);
}

/**
 * Creates a validated frequency in hertz.
 *
 * @param value The frequency to validate.
 * @returns The validated frequency.
 * @throws {RangeError} When the value is not a positive finite number.
 */
export function createFrequency(value: number): Frequency {
  if (Number.isFinite(value) && value > 0) {
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
    return value as Frequency;
  }

  throw new RangeError(`Expected a positive finite frequency, received ${value}.`);
}

/**
 * Creates a validated semitone distance.
 *
 * @param value The semitone distance to validate.
 * @returns The validated semitone distance.
 * @throws {RangeError} When the value is not a finite integer.
 */
export function createSemitones(value: number): Semitones {
  if (Number.isInteger(value)) {
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
    return value as Semitones;
  }

  throw new RangeError(`Expected an integer semitone distance, received ${value}.`);
}
