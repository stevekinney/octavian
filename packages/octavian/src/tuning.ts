import { createFrequency, type Frequency } from './branded-types.js';

/**
 * A tuning reference used to convert between MIDI keys and frequencies.
 */
export type Tuning = {
  readonly reference: 'A4';
  readonly frequency: Frequency;
};

/**
 * The standard orchestral tuning reference of A4 = 440Hz.
 */
export const STANDARD_TUNING: Tuning = {
  reference: 'A4',
  frequency: createFrequency(440),
} satisfies Tuning;
