import { Note, compareNotes, createMidiKey } from 'octavian';
import { normalizePitchClass, type PitchClass } from '../../music.ts';
import { MAX_OCTAVE, MIN_OCTAVE } from '../../round.ts';

export type StimulusType = 'synthesized' | 'sampled' | 'sequence';

export type DrillConfig = {
	drillId: string;
	seed?: string;
	eligiblePitchClasses: PitchClass[];
	octaveLo: number;
	octaveHi: number;
	timbre: string;
};

export type DrillPrompt = {
	promptId: string;
	pitchClass: PitchClass;
	octave: number;
	timbre: string;
	frequencyHz: number;
	stimulusType: StimulusType;
};

export type AttemptEvent = {
	version: 1;
	drillId: string;
	promptId: string;
	sessionId: string;
	timestamp: number;
	responseTimeMs: number;
	answer: PitchClass;
	correctAnswer: PitchClass;
	correct: boolean;
	pitchClass: PitchClass;
	octave: number;
	timbre: string;
	frequencyHz: number;
	referenceAvailable: boolean;
	stimulusType: StimulusType;
};

export type DrillResult = {
	event: AttemptEvent;
	wasCorrect: boolean;
};

const STIMULUS_TYPES: ReadonlySet<StimulusType> = new Set(['synthesized', 'sampled', 'sequence']);

function noteForPitchClass(pitchClass: PitchClass): Note {
	return Note.fromMidi(createMidiKey(60 + normalizePitchClass(pitchClass)));
}

export function pitchClassEquals(a: PitchClass, b: PitchClass): boolean {
	return compareNotes(noteForPitchClass(a), noteForPitchClass(b)).pitchClassMatch;
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === 'string' && value.length > 0;
}

function isFiniteNonNegativeNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isPitchClass(value: unknown): value is PitchClass {
	return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 11;
}

function isOctave(value: unknown): value is number {
	return (
		Number.isInteger(value) && (value as number) >= MIN_OCTAVE && (value as number) <= MAX_OCTAVE
	);
}

export function isAttemptEvent(value: unknown): value is AttemptEvent {
	if (typeof value !== 'object' || value === null) return false;
	const candidate = value as Record<string, unknown>;
	return (
		candidate.version === 1 &&
		isNonEmptyString(candidate.drillId) &&
		isNonEmptyString(candidate.promptId) &&
		isNonEmptyString(candidate.sessionId) &&
		isFiniteNonNegativeNumber(candidate.timestamp) &&
		isFiniteNonNegativeNumber(candidate.responseTimeMs) &&
		isPitchClass(candidate.answer) &&
		isPitchClass(candidate.correctAnswer) &&
		typeof candidate.correct === 'boolean' &&
		isPitchClass(candidate.pitchClass) &&
		isOctave(candidate.octave) &&
		isNonEmptyString(candidate.timbre) &&
		typeof candidate.frequencyHz === 'number' &&
		Number.isFinite(candidate.frequencyHz) &&
		candidate.frequencyHz > 0 &&
		typeof candidate.referenceAvailable === 'boolean' &&
		typeof candidate.stimulusType === 'string' &&
		STIMULUS_TYPES.has(candidate.stimulusType as StimulusType)
	);
}
