import { Note } from 'octavian';
import { keyById, normalizePitchClass } from './music.ts';

export type FretCount = 21 | 22 | 24;

export type FretPosition = {
	readonly stringIndex: number;
	readonly fret: number;
	readonly midi: number;
};

export type PositionScope = {
	readonly octaveLo?: number;
	readonly octaveHi?: number;
	readonly stringIndices?: readonly number[];
	readonly fretLo?: number;
	readonly fretHi?: number;
};

export type TuningPreset = {
	readonly id: string;
	readonly label: string;
	readonly notes: readonly number[];
};

export const TUNINGS: readonly TuningPreset[] = [
	{ id: 'standard', label: 'Standard', notes: [40, 45, 50, 55, 59, 64] },
	{ id: 'halfStepDown', label: 'Half Step Down', notes: [39, 44, 49, 54, 58, 63] },
	{ id: 'wholeStepDown', label: 'Whole Step Down', notes: [38, 43, 48, 53, 57, 62] },
	{ id: 'dropD', label: 'Drop D', notes: [38, 45, 50, 55, 59, 64] },
	{ id: 'dropC', label: 'Drop C', notes: [36, 43, 50, 55, 59, 64] },
	{ id: 'openD', label: 'Open D', notes: [38, 45, 50, 54, 57, 62] },
	{ id: 'openE', label: 'Open E', notes: [40, 47, 52, 56, 59, 64] },
	{ id: 'DADGAD', label: 'DADGAD', notes: [38, 45, 50, 55, 57, 62] },
	{ id: 'openG', label: 'Open G', notes: [38, 43, 50, 55, 59, 62] }
] as const;

const FRET_COUNTS: readonly number[] = [21, 22, 24];
const KEY_TONICS: Record<string, string> = {
	C: 'C',
	G: 'G',
	D: 'D',
	A: 'A',
	E: 'E',
	B: 'B',
	F: 'F',
	Bb: 'Bb',
	Eb: 'Eb',
	Ab: 'Ab',
	Db: 'Db'
};
const NATURAL_PITCH_CLASSES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;

function validTuning(tuning: readonly number[]): boolean {
	return (
		tuning.length >= 1 &&
		tuning.length <= 8 &&
		tuning.every((midi) => Number.isInteger(midi) && midi >= 0 && midi <= 103)
	);
}

function validFretCount(fretCount: number): fretCount is FretCount {
	return FRET_COUNTS.includes(fretCount);
}

/** Return every position from the open string through the requested fret. */
export function allPositions(tuning: readonly number[], fretCount: FretCount): FretPosition[] {
	if (!validTuning(tuning) || !validFretCount(fretCount)) return [];
	return tuning.flatMap((openMidi, stringIndex) =>
		Array.from({ length: fretCount + 1 }, (_, fret) => ({
			stringIndex,
			fret,
			midi: openMidi + fret
		}))
	);
}

/** Filter positions by pitch class; eligibility is octave independent. */
export function eligiblePositions(
	tuning: readonly number[],
	fretCount: FretCount,
	eligibleNotes: readonly number[],
	scope: PositionScope = {}
): FretPosition[] {
	const eligible = new Set(eligibleNotes.filter(Number.isFinite).map(normalizePitchClass));
	return allPositions(tuning, fretCount).filter(({ stringIndex, fret, midi }) => {
		const octave = Math.floor(midi / 12) - 1;
		return (
			eligible.has(midi % 12) &&
			(scope.octaveLo === undefined || octave >= scope.octaveLo) &&
			(scope.octaveHi === undefined || octave <= scope.octaveHi) &&
			(scope.stringIndices === undefined || scope.stringIndices.includes(stringIndex)) &&
			(scope.fretLo === undefined || fret >= scope.fretLo) &&
			(scope.fretHi === undefined || fret <= scope.fretHi)
		);
	});
}

/** Pick one position uniformly, allowing the same position on successive calls. */
export function pickPosition(
	positions: readonly FretPosition[],
	random: () => number = Math.random
): FretPosition | null {
	if (positions.length === 0) return null;
	const draw = random();
	const index = Math.min(positions.length - 1, Math.max(0, Math.floor(draw * positions.length)));
	return positions[index];
}

/** Convert a MIDI number to VexFlow's lowercase note key under a major key spelling. */
export function notationKey(midi: number, keyId: string): string {
	if (!Number.isInteger(midi) || midi < 0 || midi > 127) return '';
	const key = keyById(keyId);
	const tonic = KEY_TONICS[key.id];
	if (!tonic) return vexflowNote(Note.fromMidi(midi, 'sharps'));

	const tonicLetter = tonic[0];
	const tonicPc = normalizePitchClass(key.tonicPc ?? 0);
	const scaleLetters = Array.from(
		{ length: 7 },
		(_, degree) => LETTERS[(LETTERS.indexOf(tonicLetter as (typeof LETTERS)[number]) + degree) % 7]
	);
	const scaleIntervals = [0, 2, 4, 5, 7, 9, 11];
	const spellings = new Map<number, { letter: string; accidental: number }>();
	for (let degree = 0; degree < 7; degree++) {
		const letter = scaleLetters[degree];
		const naturalPc = NATURAL_PITCH_CLASSES[letter];
		const pc = normalizePitchClass(tonicPc + scaleIntervals[degree]);
		let accidental = pc - naturalPc;
		if (accidental > 6) accidental -= 12;
		if (accidental < -6) accidental += 12;
		spellings.set(pc, { letter, accidental });
	}
	const spelling = spellings.get(midi % 12);
	if (!spelling || Math.abs(spelling.accidental) > 2) {
		return vexflowNote(Note.fromMidi(midi, key.spelling === 'flat' ? 'flats' : 'sharps'));
	}
	const octave =
		Math.floor((midi - NATURAL_PITCH_CLASSES[spelling.letter] - spelling.accidental) / 12) - 1;
	return `${spelling.letter.toLowerCase()}${'#'.repeat(Math.max(0, spelling.accidental))}${'b'.repeat(Math.max(0, -spelling.accidental))}/${octave}`;
}

function vexflowNote(note: Note): string {
	const name = note.note.replace('♯', '#').replace('♭', 'b');
	return `${name.toLowerCase()}/${note.octave}`;
}

/** Parse space-separated scientific-pitch names into low-to-high MIDI notes. */
export function parseTuning(text: string): readonly number[] | null {
	if (typeof text !== 'string') return null;
	const tokens = text.trim().split(/\s+/);
	if (
		tokens.length < 2 ||
		tokens.length > 8 ||
		tokens.some((token) => !/^[A-Ga-g](?:#|b|♯|♭)?-?\d+$/.test(token))
	)
		return null;
	const notes: number[] = [];
	for (const token of tokens) {
		const match = /^([A-Ga-g])(#|b|♯|♭)?(-?\d+)$/.exec(token);
		if (!match) return null;
		const pc =
			NATURAL_PITCH_CLASSES[match[1].toUpperCase()] +
			(match[2] === '#' || match[2] === '♯' ? 1 : match[2] ? -1 : 0);
		const midi = (Number(match[3]) + 1) * 12 + pc;
		if (!Number.isInteger(midi) || midi < 0 || midi > 103) return null;
		notes.push(midi);
	}
	return notes;
}
