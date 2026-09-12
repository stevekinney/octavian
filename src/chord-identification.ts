import { Chord } from './chord.js';
import { CHORDS, resolveChordSuffix, type CanonicalChordSuffix } from './chords.js';
import {
  chordRequirements,
  normalizePlayedNotes,
  omittedIntervalsFor,
  validateOmissions,
  type ChordOmissions,
  type PlayedNote,
} from './chord-tones.js';
import { STANDARD_GUITAR_TUNING, noteAtFret, type StringInstrumentTuning } from './fretboard.js';
import type { Interval } from './intervals.js';
import { Key } from './key.js';
import { isChordSuffix } from './music-utilities.js';
import { Note } from './note.js';
import { ALL_NOTE_NAMES, type NoteName } from './note-spellings.js';

/** Context for interpreting played pitches. */
export type ChordIdentificationOptions = {
  readonly key?: Key | string;
  readonly omissions?: ChordOmissions;
};

/** Guitar strings follow the supplied tuning's array order. */
export type GuitarChordIdentificationOptions = ChordIdentificationOptions & {
  readonly tuning?: StringInstrumentTuning;
};

/** A catalog interpretation, with actual played pitches and explicit omissions. */
export type IdentifiedChord = {
  readonly name: string;
  readonly root: NoteName;
  readonly suffix: CanonicalChordSuffix;
  readonly bass: Note;
  readonly notes: readonly Note[];
  readonly omittedIntervals: readonly Interval[];
  readonly match: 'exact' | 'practical';
  readonly aliases: readonly string[];
};

const ROOT_NAMES = ALL_NOTE_NAMES.filter((name) => /^[A-G][#b]?$/.test(name));
const SUFFIXES = [...new Set(Object.keys(CHORDS).filter(isChordSuffix).map(resolveChordSuffix))];

function aliasesFor(suffix: CanonicalChordSuffix): readonly string[] {
  const signature = CHORDS[suffix].intervals.join(':');
  return Object.freeze(
    Object.keys(CHORDS)
      .filter(isChordSuffix)
      .filter((name) => CHORDS[name].intervals.join(':') === signature)
      .toSorted(),
  );
}

function candidateFor(
  root: NoteName,
  suffix: CanonicalChordSuffix,
  notes: readonly Note[],
  bass: Note,
  omissions: ChordOmissions,
): IdentifiedChord | null {
  const chord = representableChord(root, suffix);
  if (chord === null) return null;
  const missing = omittedIntervalsFor(
    chordRequirements(chord, omissions),
    notes.map((note) => note.chromaticIndex),
  );
  if (missing === null) return null;
  const bassName = chord.notes.find((note) => note.chromaticIndex === bass.chromaticIndex)!.note;
  const name = `${root}${chord.symbol}${chord.root.chromaticIndex === bass.chromaticIndex ? '' : `/${bassName}`}`;
  return Object.freeze({
    name,
    root,
    suffix,
    bass,
    notes,
    omittedIntervals: missing,
    match: missing.length === 0 ? 'exact' : 'practical',
    aliases: aliasesFor(suffix),
  });
}

function representableChord(root: NoteName, suffix: CanonicalChordSuffix): Chord | null {
  try {
    return Chord.create(root, suffix);
  } catch (error) {
    // A supported root can require unsupported fourth accidentals in some chord types.
    if (!(error instanceof RangeError)) throw error;
    return null;
  }
}

function spellingRank(name: NoteName, key: Key | undefined): readonly number[] {
  const inKey = key?.scale.notes.some((note) => note.note === name);
  const contraryAccidental = key?.signature.accidentalPreference === 'flats' ? '#' : 'b';
  return [
    key && !inKey ? 1 : 0,
    name.length - 1,
    key && name.includes(contraryAccidental) ? 1 : 0,
    name.includes('b') ? 1 : 0,
  ];
}

function rank(candidate: IdentifiedChord, key: Key | undefined): readonly number[] {
  const chord = Chord.create(candidate.root, candidate.suffix);
  return [
    candidate.omittedIntervals.length,
    key && chord.root.chromaticIndex !== key.tonic.chromaticIndex ? 1 : 0,
    key ? chord.notes.filter((note) => !key.scale.has(note)).length : 0,
    chord.root.chromaticIndex === candidate.bass.chromaticIndex ? 0 : 1,
    chord.size,
    ...spellingRank(candidate.root, key),
  ];
}

function compareRank(left: readonly number[], right: readonly number[]): number {
  for (let index = 0; index < left.length; index += 1) {
    const difference = left[index]! - right[index]!;
    if (difference !== 0) return difference;
  }
  return 0;
}

function resolveKey(value: Key | string | undefined): Key | undefined {
  const key = typeof value === 'string' ? Key.parse(value) : value;
  if (key !== undefined && !(key instanceof Key))
    throw new TypeError('Expected a Key or key name.');
  return key;
}

/** Identifies catalog chords, ordered by omissions, key context, bass, and spelling. */
export function identifyChords(
  values: readonly PlayedNote[],
  options: ChordIdentificationOptions = {},
): readonly IdentifiedChord[] {
  const omissions = options.omissions ?? 'practical';
  validateOmissions(omissions);
  const key = resolveKey(options.key);
  const notes = normalizePlayedNotes(values);
  const bass = notes[0];
  if (!bass) return Object.freeze([]);
  const suppliedRoots = values.flatMap((value) =>
    normalizePlayedNotes([value]).map((note) => note.note),
  );
  const roots = [...new Set([...ROOT_NAMES, ...suppliedRoots])].filter((root) =>
    notes.some((note) => note.chromaticIndex === Note.create(root).chromaticIndex),
  );
  const candidates = new Map<string, IdentifiedChord>();
  for (const root of roots) {
    for (const suffix of SUFFIXES) {
      const candidate = candidateFor(root, suffix, notes, bass, omissions);
      if (candidate && !candidates.has(candidate.name)) candidates.set(candidate.name, candidate);
    }
  }
  const ranked = [...candidates.values()].map((candidate) => ({
    candidate,
    order: rank(candidate, key),
  }));
  return Object.freeze(
    ranked
      .toSorted(
        (left, right) =>
          compareRank(left.order, right.order) ||
          left.candidate.name.localeCompare(right.candidate.name),
      )
      .map(({ candidate }) => candidate),
  );
}

/** Identifies a guitar shape: null is muted, zero is open, positive integers are frets. */
export function identifyGuitarChords(
  frets: readonly (number | null)[],
  options: GuitarChordIdentificationOptions = {},
): readonly IdentifiedChord[] {
  const tuning = options.tuning ?? STANDARD_GUITAR_TUNING;
  if (tuning.strings.length === 0 || tuning.strings.length !== frets.length)
    throw new RangeError('Expected one fret or mute per string in a nonempty tuning.');
  // Validate even muted strings, which otherwise would never reach noteAtFret.
  tuning.strings.forEach((_value, stringIndex) => noteAtFret(tuning, stringIndex, 0));
  const notes = frets.flatMap((fret, stringIndex) =>
    fret === null ? [] : [noteAtFret(tuning, stringIndex, fret)],
  );
  return identifyChords(notes, options);
}

/** Identifies pressed piano keys, supplied as MIDI numbers or pitches with octaves. */
export function identifyPianoChords(
  keys: readonly PlayedNote[],
  options: ChordIdentificationOptions = {},
): readonly IdentifiedChord[] {
  return identifyChords(keys, options);
}
