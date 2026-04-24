import type { NoteName } from './note-spellings.js';
import type { ScaleType } from './scales.js';

/**
 * The preferred accidental family to use when spelling a key.
 */
export type AccidentalPreference = 'sharps' | 'flats' | 'theoretical';

/**
 * A simple key signature descriptor.
 */
export type KeySignature = {
  readonly tonic: NoteName;
  readonly scale: ScaleType;
  readonly accidentalPreference: AccidentalPreference;
};
