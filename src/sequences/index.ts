/**
 * Timed music-event and sequence primitives.
 *
 * Import as `octavian/sequences` (this is a subpath export, not part of the
 * root barrel at `octavian`). The root `src/index.ts` MUST NOT re-export
 * from this module.
 *
 * Convention: Each subpath lives in `src/<name>/index.ts`. To add one:
 *   1. Add `src/<name>/index.ts` to `entry` in `tsdown.config.ts`.
 *   2. Add a matching `"./<name>"` block to the `"exports"` map in `package.json`
 *      (types/browser/import/default, with `types` first).
 *   3. Import the subpath in `scripts/smoke-consumer-check.mjs` and add an
 *      assertion in `scripts/smoke-checks.mjs` so the tarball smoke test
 *      exercises the new exports-map entry at runtime.
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
