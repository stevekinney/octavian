import { Chord, Note, createMidiKey, guitarFingeringsFor, type GuitarBarre } from 'octavian';

/** Serializable search constraints; tuning order is low string to high string. */
export type VoicingSearch = {
	chord: string;
	tuning: readonly number[];
	minFret: number;
	maxFret: number;
	maxFretSpan: number;
	availableFingers: number;
	allowBarres: boolean;
	allowOpen: boolean;
	allowMuted: boolean;
	omissions: 'practical' | 'none';
	bassPitchClass: number | null;
};
export type ChordShape = {
	frets: readonly (number | null)[];
	fingers: readonly (number | null)[];
	barres: readonly GuitarBarre[];
	bass: string;
	midi: readonly number[];
	omittedIntervals: readonly string[];
};
export type VoicingRequest = { type: 'start'; search: VoicingSearch } | { type: 'more' };
export type VoicingResponse = { shapes: ChordShape[]; done: boolean; error?: string };

/** Enumerate every matching shape lazily; filtering never imposes a result cap. */
export function* findVoicings(search: VoicingSearch): Generator<ChordShape> {
	if (
		search.tuning.length < 2 ||
		search.tuning.length > 8 ||
		search.tuning.some((midi) => !Number.isInteger(midi) || midi < 0 || midi > 103)
	) {
		throw new Error('Choose a tuning with 2–8 strings and open pitches from MIDI 0–103.');
	}
	if (
		!Number.isInteger(search.minFret) ||
		!Number.isInteger(search.maxFret) ||
		search.minFret < 0 ||
		search.maxFret > 24 ||
		search.minFret > search.maxFret
	) {
		throw new Error('Choose a fret range from 0–24 with the first fret no higher than the last.');
	}
	const chord = Chord.parse(search.chord);
	const shapes = guitarFingeringsFor(chord, {
		tuning: { strings: search.tuning.map((midi) => Note.fromMidi(createMidiKey(midi))) },
		minFret: search.minFret,
		maxFret: search.maxFret,
		maxFretSpan: search.maxFretSpan,
		availableFingers: search.availableFingers,
		allowBarres: search.allowBarres,
		omissions: search.omissions
	});
	for (const shape of shapes) {
		if (!search.allowOpen && shape.frets.includes(0)) continue;
		if (!search.allowMuted && shape.frets.includes(null)) continue;
		if (search.bassPitchClass !== null && shape.bass.chromaticIndex !== search.bassPitchClass)
			continue;
		yield {
			frets: shape.frets,
			fingers: shape.fingers,
			barres: shape.barres,
			bass: shape.bass.toString(),
			midi: shape.notes.map((note) => Number(note.midi)),
			omittedIntervals: shape.omittedIntervals
		};
	}
}
