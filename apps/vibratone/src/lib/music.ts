/**
 * Pure music-theory helpers for Vibratone.
 *
 * Pitch classes are integers 0–11 mapping to C…B. Everything here is
 * side-effect free and framework-agnostic so it can be exhaustively unit
 * tested without a DOM or an audio context. Frequencies and scales are
 * derived through `octavian` rather than hand-rolled equal-temperament math.
 */

import { Note, Scale, createMidiKey, midiToFrequency } from 'octavian';
import type { KeySignature } from './notation.ts';

/** A pitch class: an integer 0–11 where 0 = C and 11 = B. */
export type PitchClass = number;

/** How accidentals (the black keys) should be spelled. */
export type Spelling = 'sharp' | 'flat' | 'both';

/** A concrete pitch: a pitch class anchored to a scientific-pitch octave. */
export type Pitch = { pc: PitchClass; octave: number };

/** Sharp spelling of every pitch class, indexed 0–11. */
export const SHARP_NAMES = [
	'C',
	'C♯',
	'D',
	'D♯',
	'E',
	'F',
	'F♯',
	'G',
	'G♯',
	'A',
	'A♯',
	'B'
] as const;

/** Flat spelling of every pitch class, indexed 0–11. */
export const FLAT_NAMES = [
	'C',
	'D♭',
	'D',
	'E♭',
	'E',
	'F',
	'G♭',
	'G',
	'A♭',
	'A',
	'B♭',
	'B'
] as const;

/** The five accidental (black-key) pitch classes. */
export const BLACK_PITCH_CLASSES: ReadonlySet<PitchClass> = new Set([1, 3, 6, 8, 10]);

/** The intervals, in semitones, that make up a major scale. */
export const MAJOR_SCALE_INTERVALS = [0, 2, 4, 5, 7, 9, 11] as const;

/** The seven natural pitch classes, in left-to-right white-key order. */
export const WHITE_PITCH_CLASSES = [0, 2, 4, 5, 7, 9, 11] as const;

export type ModeName =
	'major' | 'dorian' | 'phrygian' | 'lydian' | 'mixolydian' | 'aeolian' | 'locrian';

export const MODES: readonly { value: ModeName; label: string }[] = [
	{ value: 'major', label: 'Major' },
	{ value: 'dorian', label: 'Dorian' },
	{ value: 'phrygian', label: 'Phrygian' },
	{ value: 'lydian', label: 'Lydian' },
	{ value: 'mixolydian', label: 'Mixolydian' },
	{ value: 'aeolian', label: 'Natural minor (Aeolian)' },
	{ value: 'locrian', label: 'Locrian' }
] as const;

/** A selectable tonic and diatonic mode, or the chromatic "no key" option. */
export type KeyDefinition = {
	/** Stable identifier used in persistence and `<Select>` options. */
	id: string;
	/** Human-facing label, e.g. "B♭ Major" or "Chromatic". */
	label: string;
	/** Compact label for the header meta line, e.g. "C" or "Chromatic". */
	short: string;
	/** The tonic pitch class, or `null` for Chromatic. */
	tonicPc: PitchClass | null;
	/** Which spelling the keyboard and chips should use. */
	spelling: Spelling;
	mode: ModeName;
	/** The major key signature used to notate this mode. */
	signature: KeySignature;
};

/**
 * The selectable keys: Chromatic plus the eleven common major keys from the
 * handoff. Sharp keys (G/D/A/E/B) prefer sharp spelling; flat keys
 * (F/B♭/E♭/A♭/D♭) prefer flats; C is a no-op natural key spelled with sharps.
 */
const ROOT_DEFINITIONS = [
	['C', 'C', 0, 'sharp', 'C'],
	['G', 'G', 7, 'sharp', 'G'],
	['D', 'D', 2, 'sharp', 'D'],
	['A', 'A', 9, 'sharp', 'A'],
	['E', 'E', 4, 'sharp', 'E'],
	['B', 'B', 11, 'sharp', 'B'],
	['F', 'F', 5, 'flat', 'F'],
	['F#', 'F♯', 6, 'sharp', 'F#'],
	['Bb', 'B♭', 10, 'flat', 'Bb'],
	['Eb', 'E♭', 3, 'flat', 'Eb'],
	['Ab', 'A♭', 8, 'flat', 'Ab'],
	['Db', 'D♭', 1, 'flat', 'Db']
] as const satisfies readonly [string, string, PitchClass, Spelling, KeySignature][];

const ROOT_BY_PC = new Map<number, (typeof ROOT_DEFINITIONS)[number]>(
	ROOT_DEFINITIONS.map((root) => [root[2], root])
);
const modeIntervals = [0, 2, 4, 5, 7, 9, 11] as const;

function makeKey(root: (typeof ROOT_DEFINITIONS)[number], mode: ModeName): KeyDefinition {
	const [rootId, rootLabel, tonicPc, spelling] = root;
	const modeIndex = MODES.findIndex((entry) => entry.value === mode);
	const parentPc = normalizePitchClass(tonicPc - modeIntervals[modeIndex]);
	const parent = ROOT_BY_PC.get(parentPc) ?? root;
	const id = mode === 'major' ? rootId : `${rootId}:${mode}`;
	return {
		id,
		label: mode === 'major' ? `${rootLabel} Major` : `${rootLabel} ${MODES[modeIndex].label}`,
		short: rootLabel,
		tonicPc,
		spelling,
		mode,
		signature: parent[4]
	};
}

const CHROMATIC_KEY: KeyDefinition = {
	id: 'chromatic',
	label: 'Chromatic',
	short: 'Chromatic',
	tonicPc: null,
	spelling: 'both',
	mode: 'major',
	signature: 'C'
};

export const ROOT_KEYS: readonly KeyDefinition[] = [
	CHROMATIC_KEY,
	...ROOT_DEFINITIONS.map((root) => makeKey(root, 'major'))
];

export const KEYS: readonly KeyDefinition[] = [
	CHROMATIC_KEY,
	...ROOT_DEFINITIONS.flatMap((root) => MODES.map(({ value }) => makeKey(root, value)))
];

const KEYS_BY_ID = new Map(KEYS.map((key) => [key.id, key]));

/** Look up a key definition by id, falling back to Chromatic for unknown ids. */
export function keyById(id: string): KeyDefinition {
	const normalizedId = id.endsWith(':major') ? id.slice(0, -':major'.length) : id;
	return KEYS_BY_ID.get(normalizedId) ?? CHROMATIC_KEY;
}

export function modeForKey(key: KeyDefinition): ModeName {
	return key.mode;
}

/** Wrap any integer into the 0–11 pitch-class range. */
export function normalizePitchClass(value: number): PitchClass {
	return ((Math.trunc(value) % 12) + 12) % 12;
}

/** True if the pitch class is a black (accidental) key. */
export function isBlackPitchClass(pc: PitchClass): boolean {
	return BLACK_PITCH_CLASSES.has(normalizePitchClass(pc));
}

/**
 * The pitch classes of the major scale built on `tonicPc`, in ascending order
 * starting from the tonic. Uses `octavian` so the diatonic spelling logic stays
 * in the library, then maps each spelled note back to its pitch class.
 */
export function majorScalePitchClasses(tonicPc: PitchClass): PitchClass[] {
	const tonic = normalizePitchClass(tonicPc);
	return Scale.create(Note.fromMidi(createMidiKey(60 + tonic)), 'major').notes.map(
		(note) => note.chromaticIndex
	);
}

/** The set of eligible pitch classes for a key — its diatonic major scale. */
export function scalePitchClassSet(key: KeyDefinition): Set<PitchClass> {
	if (key.tonicPc === null) {
		return new Set(Array.from({ length: 12 }, (_, pc) => pc));
	}
	const root = Note.fromMidi(createMidiKey(60 + normalizePitchClass(key.tonicPc)));
	return new Set(Scale.create(root, key.mode).notes.map((note) => note.chromaticIndex));
}

/**
 * The label for a pitch class under a given spelling. White keys are spelled
 * identically in both; black keys differ. `'both'` returns the sharp name —
 * use {@link bothSpellings} when you need the stacked chromatic label.
 */
export function noteLabel(pc: PitchClass, spelling: Spelling): string {
	const index = normalizePitchClass(pc);
	return spelling === 'flat' ? FLAT_NAMES[index] : SHARP_NAMES[index];
}

/**
 * Both enharmonic spellings of a pitch class, sharp first. For natural pitch
 * classes the two entries are identical (e.g. `['C', 'C']`); callers can detect
 * that to render a single label.
 */
export function bothSpellings(pc: PitchClass): [sharp: string, flat: string] {
	const index = normalizePitchClass(pc);
	return [SHARP_NAMES[index], FLAT_NAMES[index]];
}

/** The MIDI number for a pitch in scientific pitch notation (C4 = 60). */
export function pitchToMidi(pitch: Pitch): number {
	return (pitch.octave + 1) * 12 + normalizePitchClass(pitch.pc);
}

/** The frequency, in Hz, for a pitch — equal temperament, A4 = 440. */
export function pitchToFrequency(pitch: Pitch): number {
	return midiToFrequency(createMidiKey(pitchToMidi(pitch)));
}

/** Format a pitch for display, e.g. `{ pc: 1, octave: 4 }` → "C♯4". */
export function formatPitch(pitch: Pitch, spelling: Spelling): string {
	return `${noteLabel(pitch.pc, spelling)}${pitch.octave}`;
}
