import { Chord } from './chord.js';
import { chordRequirements, omittedIntervalsFor, type ChordOmissions } from './chord-tones.js';
import { assignGuitarFingers } from './guitar-fingering-assignment.js';
import { STANDARD_GUITAR_TUNING, noteAtFret, type StringInstrumentTuning } from './fretboard.js';
import type { Interval } from './intervals.js';
import { Note } from './note.js';

/** Options controlling guitar fingering generation. */
export type GuitarFingeringOptions = {
  /** Instrument tuning in string order. Defaults to standard guitar tuning, low to high. */
  readonly tuning?: StringInstrumentTuning;
  /** Lowest fret to search, inclusive. Defaults to `0`. */
  readonly minFret?: number;
  /** Highest requested fret, inclusive. Defaults to `24`; internally clamped to reachable MIDI notes. */
  readonly maxFret?: number;
  /** Maximum distance between stopped frets, ignoring open strings. Defaults to `3`. */
  readonly maxFretSpan?: number;
  /** Available fretting fingers, numbered from `1`; must be in `1..4`. Defaults to `4`. */
  readonly availableFingers?: number;
  /** Whether fingers `1..3` may form straight barres. Defaults to `true`. */
  readonly allowBarres?: boolean;
  /** Whether conventional chord-tone omissions are accepted. Defaults to `'practical'`. */
  readonly omissions?: ChordOmissions;
};

/** A straight barre formed by one finger over a contiguous string range. */
export type GuitarBarre = {
  /** Fretting finger number. */
  readonly finger: number;
  /** Fret held by the barre. */
  readonly fret: number;
  /** First string index covered by the barre. */
  readonly fromString: number;
  /** Last string index covered by the barre. */
  readonly toString: number;
};

/** A playable guitar chord shape with its sounding notes and preferred finger assignment. */
export type GuitarFingering = {
  /** One entry per string: `null` means muted, `0` means open, positive numbers are frets. */
  readonly frets: readonly (number | null)[];
  /** Sounding notes sorted from lowest to highest pitch. */
  readonly notes: readonly Note[];
  /** Lowest sounding note. */
  readonly bass: Note;
  /** Accepted chord intervals that are omitted by this shape. */
  readonly omittedIntervals: readonly Interval[];
  /** Preferred fretting finger per string; muted and open strings are `null`. */
  readonly fingers: readonly (number | null)[];
  /** Preferred straight barres used by the assignment. */
  readonly barres: readonly GuitarBarre[];
};

type Snapshot = {
  readonly tuning: StringInstrumentTuning;
  readonly openNotes: readonly Note[];
  readonly minFret: number;
  readonly maxFret: number;
  readonly maxSearchFret: number;
  readonly maxFretSpan: number;
  readonly availableFingers: number;
  readonly allowBarres: boolean;
  readonly omissions: ChordOmissions;
};

type FingeringContext = {
  readonly settings: Snapshot;
  readonly pitchClasses: readonly number[];
  readonly requiredChord: Chord;
  readonly choices: readonly (readonly (number | null)[])[];
};

function integerAtLeast(value: unknown, name: string, minimum: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < minimum) {
    throw new RangeError(`Expected ${name} to be an integer at least ${minimum}.`);
  }

  return value;
}

function validateOmissions(value: ChordOmissions): void {
  if (value !== 'practical' && value !== 'none') {
    throw new TypeError('Expected omissions to be practical or none.');
  }
}

function validateTuning(tuning: StringInstrumentTuning): readonly Note[] {
  if (!Array.isArray(tuning.strings) || tuning.strings.length === 0) {
    throw new TypeError('Expected tuning.strings to be a non-empty array.');
  }

  return Object.freeze(
    tuning.strings.map((_value, stringIndex) => noteAtFret(tuning, stringIndex, 0)),
  );
}

function validateRange(minFret: number, maxFret: number): void {
  if (minFret > maxFret) {
    throw new RangeError('Expected minFret to be at most maxFret.');
  }
}

function validateAvailableFingers(value: number): void {
  if (value > 4) {
    throw new RangeError('Expected availableFingers to be at most 4.');
  }
}

function validateAllowBarres(value: unknown): void {
  if (value !== undefined && typeof value !== 'boolean') {
    throw new TypeError('Expected allowBarres to be a boolean.');
  }
}

function highestReachableFret(openNotes: readonly Note[], maxFret: number): number {
  const midiRoom = Math.max(...openNotes.map((note) => 127 - Number(note.midi)));
  return Math.min(maxFret, midiRoom);
}

function snapshot(options: GuitarFingeringOptions): Snapshot {
  const tuning = options.tuning ?? STANDARD_GUITAR_TUNING;
  const openNotes = validateTuning(tuning);
  const minFret = integerAtLeast(options.minFret ?? 0, 'minFret', 0);
  const maxFret = integerAtLeast(options.maxFret ?? 24, 'maxFret', 0);
  const maxFretSpan = integerAtLeast(options.maxFretSpan ?? 3, 'maxFretSpan', 0);
  const availableFingers = integerAtLeast(options.availableFingers ?? 4, 'availableFingers', 1);
  const omissions = options.omissions ?? 'practical';

  validateRange(minFret, maxFret);
  validateAvailableFingers(availableFingers);
  validateAllowBarres(options.allowBarres);
  validateOmissions(omissions);

  return Object.freeze({
    tuning: Object.freeze({ ...tuning, strings: Object.freeze([...tuning.strings]) }),
    openNotes,
    minFret,
    maxFret,
    maxSearchFret: highestReachableFret(openNotes, maxFret),
    maxFretSpan,
    availableFingers,
    allowBarres: options.allowBarres ?? true,
    omissions,
  });
}

function noteFromOpenString(openNote: Note, fret: number): Note {
  return openNote.transposeBy(fret);
}

function fretChoicesForString(
  settings: Snapshot,
  stringIndex: number,
  pitchClasses: readonly number[],
): readonly (number | null)[] {
  const choices: (number | null)[] = [];
  const openNote = settings.openNotes[stringIndex]!;

  for (let fret = settings.minFret; fret <= settings.maxSearchFret; fret += 1) {
    if (Number(openNote.midi) + fret > 127) break;
    if (pitchClasses.includes(noteFromOpenString(openNote, fret).chromaticIndex)) {
      choices.push(fret);
    }
  }

  choices.push(null);
  return Object.freeze(choices);
}

function fretChoices(
  settings: Snapshot,
  pitchClasses: readonly number[],
): FingeringContext['choices'] {
  return Object.freeze(
    settings.openNotes.map((_note, stringIndex) =>
      fretChoicesForString(settings, stringIndex, pitchClasses),
    ),
  );
}

function stoppedFrets(frets: readonly (number | null)[]): readonly number[] {
  return frets.filter((fret): fret is number => fret !== null && fret > 0);
}

function stoppedFretAnchor(frets: readonly (number | null)[]): number | null {
  const fretted = stoppedFrets(frets);
  return fretted.length === 0 ? null : Math.min(...fretted);
}

function matchesAnchor(
  frets: readonly (number | null)[],
  anchor: number,
  settings: Snapshot,
): boolean {
  const lowestStopped = stoppedFretAnchor(frets);
  if (lowestStopped === null) return anchor === settings.minFret;
  return lowestStopped === anchor;
}

function withinStoppedSpan(frets: readonly (number | null)[], maxFretSpan: number): boolean {
  const fretted = stoppedFrets(frets);
  if (fretted.length === 0) return true;
  return Math.max(...fretted) - Math.min(...fretted) <= maxFretSpan;
}

function playedNotes(settings: Snapshot, frets: readonly (number | null)[]): readonly Note[] {
  return Object.freeze(
    settings.openNotes
      .flatMap((openNote, stringIndex) =>
        frets[stringIndex] === null ? [] : [noteFromOpenString(openNote, frets[stringIndex]!)],
      )
      .toSorted((left, right) => Number(left.midi) - Number(right.midi)),
  );
}

function chordAcceptsBass(chord: Chord, bass: Note): boolean {
  return !chord.isSlashChord || bass.chromaticIndex === chord.bass.chromaticIndex;
}

function completedFingering(
  context: FingeringContext,
  frets: readonly (number | null)[],
): GuitarFingering | null {
  const notes = playedNotes(context.settings, frets);
  const bass = notes[0];
  if (!bass) return null;

  const omittedIntervals = omittedIntervalsFor(
    chordRequirements(context.requiredChord, context.settings.omissions),
    notes.map((note) => note.chromaticIndex),
  );
  if (!omittedIntervals || !chordAcceptsBass(context.requiredChord, bass)) return null;

  const assigned = assignGuitarFingers(frets, context.settings);
  if (!assigned) return null;

  return Object.freeze({
    frets: Object.freeze([...frets]),
    notes,
    bass,
    omittedIntervals,
    fingers: assigned.fingers,
    barres: assigned.barres,
  });
}

function fretAllowedForAnchor(fret: number | null, anchor: number, settings: Snapshot): boolean {
  return fret === null || fret === 0 || (fret >= anchor && fret <= anchor + settings.maxFretSpan);
}

function canCompleteAtPosition(
  frets: readonly (number | null)[],
  index: number,
  anchor: number,
  settings: Snapshot,
): boolean {
  if (index < frets.length) return true;
  return matchesAnchor(frets, anchor, settings) && withinStoppedSpan(frets, settings.maxFretSpan);
}

function* walkFingerings(
  context: FingeringContext,
  anchor: number,
  frets: (number | null)[],
  index: number,
): IterableIterator<GuitarFingering> {
  if (!canCompleteAtPosition(frets, index, anchor, context.settings)) return;

  if (index === frets.length) {
    const fingering = completedFingering(context, frets);
    if (fingering) yield fingering;
    return;
  }

  for (const fret of context.choices[index]!) {
    if (!fretAllowedForAnchor(fret, anchor, context.settings)) continue;
    frets[index] = fret;
    yield* walkFingerings(context, anchor, frets, index + 1);
  }

  frets[index] = null;
}

function* generateFingerings(context: FingeringContext): IterableIterator<GuitarFingering> {
  for (
    let anchor = context.settings.minFret;
    anchor <= context.settings.maxSearchFret;
    anchor += 1
  ) {
    yield* walkFingerings(
      context,
      anchor,
      Array<number | null>(context.settings.openNotes.length).fill(null),
      0,
    );
  }
}

/** Lazily yields playable fingerings for a chord on a fretted string instrument. */
export function guitarFingeringsFor(
  chord: Chord | string,
  options: GuitarFingeringOptions = {},
): IterableIterator<GuitarFingering> {
  const settings = snapshot(options);
  const requirements = chordRequirements(chord, settings.omissions);
  const context = Object.freeze({
    settings,
    pitchClasses: requirements.pitchClasses,
    requiredChord: requirements.chord,
    choices: fretChoices(settings, requirements.pitchClasses),
  });

  return generateFingerings(context);
}
