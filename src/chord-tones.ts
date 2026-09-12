import { Chord } from './chord.js';
import { INTERVALS, type Interval } from './intervals.js';
import { parseNoteNameWithOctave } from './music-utilities.js';
import { Note } from './note.js';

/** A played pitch, retaining its octave. Numeric values are MIDI keys. */
export type PlayedNote = Note | string | number;
/** Whether conventional missing chord tones are accepted. */
export type ChordOmissions = 'practical' | 'none';

export type ChordRequirements = {
  readonly chord: Chord;
  readonly pitchClasses: readonly number[];
  readonly requiredPitchClasses: readonly number[];
  readonly intervals: readonly Interval[];
};

export function validateOmissions(omissions: ChordOmissions): void {
  if (omissions !== 'practical' && omissions !== 'none') {
    throw new TypeError('Expected omissions to be practical or none.');
  }
}

export function normalizePlayedNotes(values: readonly PlayedNote[]): readonly Note[] {
  const byMidi = new Map<number, Note>();
  for (const value of values) {
    let note: Note;
    if (typeof value === 'number') {
      note = Note.fromMidi(value);
    } else if (value instanceof Note) {
      note = value;
    } else {
      const parsed = parseNoteNameWithOctave(value);
      note = Note.create(parsed);
    }
    byMidi.set(Number(note.midi), note);
  }
  return Object.freeze([...byMidi.values()].toSorted((left, right) => left.midi - right.midi));
}

function optionalInterval(interval: Interval, chord: Chord): boolean {
  if (interval === 'perfectFifth') return chord.quality !== 'suspended' && chord.symbol !== '5';
  const highestDegree = Math.max(...chord.intervals.map((entry) => INTERVALS[entry].degree));
  if (interval === 'majorNinth') return highestDegree >= 11;
  return interval === 'perfectEleventh' && highestDegree === 13;
}

export function chordRequirements(
  value: Chord | string,
  omissions: ChordOmissions = 'practical',
): ChordRequirements {
  validateOmissions(omissions);
  const chord = typeof value === 'string' ? Chord.parse(value) : value;
  if (!(chord instanceof Chord)) throw new TypeError('Expected a Chord or chord name.');
  const intervals = chord.intervals;
  const pitchClasses = intervals.map(
    (interval) => (chord.root.chromaticIndex + INTERVALS[interval].semitones) % 12,
  );
  const requiredPitchClasses = intervals.flatMap((interval, index) => {
    if (omissions === 'practical' && optionalInterval(interval, chord)) return [];
    return pitchClasses.slice(index, index + 1);
  });
  return Object.freeze({
    chord,
    intervals,
    pitchClasses: Object.freeze(pitchClasses),
    requiredPitchClasses: Object.freeze(requiredPitchClasses),
  });
}

/** Returns missing intervals, or null when the pitches do not satisfy the chord. */
export function omittedIntervalsFor(
  requirements: ChordRequirements,
  pitches: readonly number[],
): readonly Interval[] | null {
  const present = new Set(pitches);
  if (pitches.some((pitch) => !requirements.pitchClasses.includes(pitch))) return null;
  if (requirements.requiredPitchClasses.some((pitch) => !present.has(pitch))) return null;
  return Object.freeze(
    requirements.intervals.filter(
      (interval) =>
        !present.has((requirements.chord.root.chromaticIndex + INTERVALS[interval].semitones) % 12),
    ),
  );
}
