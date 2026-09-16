import { describe, expect, it } from 'vitest';
import {
	CHORD_CATALOG,
	answerIsCorrect,
	chordAt,
	diatonicChords,
	fixedChordOptions,
	makeFixedQuestion,
	supportedInversions
} from './chord-training.ts';

describe('chord training catalog', () => {
	it('deduplicates the complete canonical Octavian catalog', () => {
		expect(CHORD_CATALOG.length).toBeGreaterThan(20);
		expect(new Set(CHORD_CATALOG.map((chord) => chord.id)).size).toBe(CHORD_CATALOG.length);
	});

	it('filters fixed questions by broad quality', () => {
		const options = fixedChordOptions(['major', 'minor']);
		expect(options.length).toBeGreaterThan(2);
		expect(options.every((chord) => chord.quality === 'major' || chord.quality === 'minor')).toBe(
			true
		);
	});

	it('creates playable inverted chords and scores only the chosen suffix', () => {
		const question = makeFixedQuestion(0, 'majorSeventh', 4, 1);
		expect(question.chord.notes).toHaveLength(4);
		expect(question.chord.inversionIndex).toBe(1);
		expect(answerIsCorrect(question, 'majorSeventh')).toBe(true);
		expect(answerIsCorrect(question, 'minorSeventh')).toBe(false);
	});

	it('limits inversion choices to the chord cardinality', () => {
		expect(supportedInversions(3)).toHaveLength(3);
		expect(supportedInversions(4)).toHaveLength(4);
	});

	it('generates seven diatonic triads for a major key', () => {
		const chords = diatonicChords('C', 4, false, 0);
		expect(chords).toHaveLength(7);
		expect(new Set(chords.map((chord) => chord.answer)).size).toBe(7);
		expect(chords[0].chord.name.toString()).toBe('C');
		expect(chords[1].chord.quality).toBe('minor');
	});

	it('clamps unsupported inversions to the last chord tone', () => {
		expect(chordAt(0, 'major', 4, 6).inversionIndex).toBe(2);
	});
});
