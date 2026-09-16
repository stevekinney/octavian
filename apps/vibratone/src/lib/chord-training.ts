import {
	CHORDS,
	Chord,
	Note,
	Scale,
	chordQualityForSuffix,
	resolveChordSuffix,
	type ChordQuality,
	type ModeName
} from 'octavian';
import { FLAT_NAMES, SHARP_NAMES, type KeyDefinition, keyById } from './music.ts';

export const CHORD_TYPES = [
	{ value: 'basic', label: 'Triads, suspended & power' },
	{ value: 'sevenths', label: 'Sevenths' },
	{ value: 'added', label: 'Sixths & added notes' },
	{ value: 'extended', label: 'Extended chords' }
] as const;
export type ChordType = (typeof CHORD_TYPES)[number]['value'];

export type ChordMode = 'fixed' | 'diatonic';
export type CanonicalChordSuffix = ReturnType<typeof resolveChordSuffix>;
export type ChordInversion = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type ChordDefinition = {
	id: CanonicalChordSuffix;
	label: string;
	symbol: string;
	quality: ChordQuality;
	size: number;
};
export type ChordQuestion = {
	chord: Chord;
	answer: string;
	label: string;
	root: string;
	quality: ChordQuality;
	inversion: ChordInversion;
	degree?: number;
};

const ROOT_NAMES = SHARP_NAMES.map((name, pc) => ({ pc, name }));
const canonicalSuffixes = [
	...new Set(Object.keys(CHORDS).map((suffix) => resolveChordSuffix(suffix as keyof typeof CHORDS)))
];

export const CHORD_CATALOG: readonly ChordDefinition[] = canonicalSuffixes.map((suffix) => {
	const chord = Chord.create(Note.fromMidi(60), suffix);
	return {
		id: suffix,
		label: chord.name.replace(/^C/, '').trim() || 'Major triad',
		symbol: chord.symbol,
		quality: chordQualityForSuffix(suffix),
		size: chord.size
	};
});

export const CHORD_QUALITIES: readonly ChordQuality[] = [
	'major',
	'minor',
	'diminished',
	'augmented',
	'power',
	'dominant',
	'suspended',
	'altered'
];

const QUALITY_LABELS: Record<ChordQuality, string> = {
	major: 'Major',
	minor: 'Minor',
	diminished: 'Diminished',
	augmented: 'Augmented',
	power: 'Power',
	dominant: 'Dominant',
	suspended: 'Suspended',
	altered: 'Altered'
};

export function chordQualityLabel(quality: ChordQuality): string {
	return QUALITY_LABELS[quality];
}

export function chordRootName(pitchClass: number, spelling: 'sharp' | 'flat' = 'sharp'): string {
	const names = spelling === 'flat' ? FLAT_NAMES : SHARP_NAMES;
	return names[((pitchClass % 12) + 12) % 12];
}

export function chordAt(
	rootPitchClass: number,
	suffix: CanonicalChordSuffix,
	octave: number,
	inversion: ChordInversion
): Chord {
	const root = Note.fromMidi((octave + 1) * 12 + rootPitchClass);
	const chord = Chord.create(root, suffix);
	return chord.inversion(Math.min(inversion, chord.size - 1) as ChordInversion);
}

export function fixedChordOptions(
	qualities: readonly ChordQuality[],
	types: readonly ChordType[] = CHORD_TYPES.map((type) => type.value)
): readonly ChordDefinition[] {
	return CHORD_CATALOG.filter((chord) => {
		const type: ChordType =
			chord.size <= 3
				? 'basic'
				: /Seven/.test(chord.id)
					? 'sevenths'
					: /Sixth|Add|add/.test(chord.id)
						? 'added'
						: 'extended';
		return qualities.includes(chord.quality) && types.includes(type);
	});
}

function keyMode(key: KeyDefinition): ModeName {
	return key.mode as ModeName;
}

export function diatonicChords(
	keyId: string,
	octave: number,
	includeSevenths: boolean,
	inversion: ChordInversion
): readonly ChordQuestion[] {
	const key = keyById(keyId);
	if (key.tonicPc === null) return [];
	const scale = Scale.create(Note.fromMidi((octave + 1) * 12 + key.tonicPc), keyMode(key));
	const chords = includeSevenths ? scale.seventhChords() : scale.chords();
	return chords.map((chord, index) => {
		const selected = chord.inversion(Math.min(inversion, chord.size - 1) as ChordInversion);
		return {
			chord: selected,
			answer: `${selected.root.chromaticIndex}:${selected.suffix}`,
			label: `${index + 1}. ${selected.name}`,
			root: selected.root.toString(),
			quality: selected.quality,
			inversion: selected.inversionIndex,
			degree: index + 1
		};
	});
}

export function makeFixedQuestion(
	rootPitchClass: number,
	suffix: CanonicalChordSuffix,
	octave: number,
	inversion: ChordInversion
): ChordQuestion {
	const chord = chordAt(rootPitchClass, suffix, octave, inversion);
	return {
		chord,
		answer: suffix,
		label: chord.name.toString(),
		root: chord.root.toString(),
		quality: chordQualityForSuffix(suffix),
		inversion: chord.inversionIndex
	};
}

export function answerIsCorrect(question: ChordQuestion, answer: string): boolean {
	return question.answer === answer;
}

export function supportedInversions(
	chordSize: number
): readonly { value: ChordInversion; label: string }[] {
	const labels = [
		'Root position',
		'First inversion',
		'Second inversion',
		'Third inversion',
		'Fourth inversion',
		'Fifth inversion',
		'Sixth inversion'
	];
	return labels.slice(0, Math.max(1, Math.min(chordSize, labels.length))).map((label, value) => ({
		value: value as ChordInversion,
		label
	}));
}

export { ROOT_NAMES };
