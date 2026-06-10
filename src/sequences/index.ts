/**
 * Timed music-event and sequence primitives.
 *
 * Import as `octavian/sequences` (this is a subpath export, not part of the
 * root barrel at `octavian`). The root `src/index.ts` MUST NOT re-export
 * from this module.
 *
 * Convention: Each subpath lives in `src/<name>/index.ts`. The matching entry
 * is added to `entry` in `tsdown.config.ts` and to the `"exports"` map in
 * `package.json` under `"./<name>"`.
 *
 * Import path: `octavian/sequences`
 */

export { musicalTime, Sequence } from './sequence.js';

export type {
  MusicalTime,
  MusicalDuration,
  MusicEvent,
  NoteEvent,
  ChordEvent,
  RestEvent,
  TimedMusicEvent,
  TimedNoteEvent,
  TimedChordEvent,
  TimedRestEvent,
  SequenceOptions,
  SerializedNoteEvent,
  SerializedChordEvent,
  SerializedRestEvent,
  SerializedMusicEvent,
  SerializedSequence,
} from './types.js';
