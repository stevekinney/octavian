import { describe, expect, it } from 'vitest';
import { pitchToFrequency } from '../../music.ts';
import { isAttemptEvent, pitchClassEquals, type AttemptEvent, type DrillConfig } from './schema.ts';
import { drillPromptFromPitch } from './seeded-session.ts';

const config: DrillConfig = {
	drillId: 'note-trainer',
	seed: '2026-06-11',
	eligiblePitchClasses: [0, 4, 7],
	octaveLo: 4,
	octaveHi: 5,
	timbre: 'sine'
};

function createAttemptEvent(): AttemptEvent {
	return {
		version: 1,
		drillId: 'note-trainer',
		promptId: '0:4:seed',
		sessionId: '00000000-0000-4000-8000-000000000000',
		timestamp: 1_800_000_000_000,
		responseTimeMs: 250,
		answer: 0,
		correctAnswer: 0,
		correct: true,
		pitchClass: 0,
		octave: 4,
		timbre: 'sine',
		frequencyHz: pitchToFrequency({ pc: 0, octave: 4 }),
		referenceAvailable: true,
		stimulusType: 'synthesized'
	};
}

describe('drill-schema', () => {
	it('DrillPrompt round-trips through JSON without losing field types', () => {
		const prompt = drillPromptFromPitch(config, { pc: 0, octave: 4 });
		const parsed = JSON.parse(JSON.stringify(prompt));

		expect(parsed).toEqual(prompt);
		expect(parsed.promptId).toBe('note-trainer:2026-06-11:0:0:4');
		expect(parsed.stimulusType).toBe('synthesized');
	});

	it('AttemptEvent.version is the literal 1', () => {
		const event = createAttemptEvent();
		const version: 1 = event.version;

		expect(version).toBe(1);
	});

	it('AttemptEvent contains all required fields after a synthesized-note guess', () => {
		const event = createAttemptEvent();

		expect(isAttemptEvent(event)).toBe(true);
		expect(Object.keys(event).sort()).toEqual(
			[
				'answer',
				'correct',
				'correctAnswer',
				'drillId',
				'frequencyHz',
				'octave',
				'pitchClass',
				'promptId',
				'referenceAvailable',
				'responseTimeMs',
				'sessionId',
				'stimulusType',
				'timbre',
				'timestamp',
				'version'
			].sort()
		);
	});

	it('DrillConfig round-trips through JSON with all optional fields populated', () => {
		expect(JSON.parse(JSON.stringify(config))).toEqual(config);
	});

	it('pitchClassEquals returns true for enharmonically equal pitch classes', () => {
		expect(pitchClassEquals(0, 12)).toBe(true);
		expect(pitchClassEquals(-1, 11)).toBe(true);
	});

	it('pitchClassEquals returns false for distinct pitch classes', () => {
		expect(pitchClassEquals(0, 1)).toBe(false);
	});

	it('rejects impossible AttemptEvent numeric boundaries', () => {
		expect(isAttemptEvent({ ...createAttemptEvent(), timestamp: -1 })).toBe(false);
		expect(isAttemptEvent({ ...createAttemptEvent(), responseTimeMs: -1 })).toBe(false);
		expect(isAttemptEvent({ ...createAttemptEvent(), frequencyHz: 0 })).toBe(false);
		expect(isAttemptEvent({ ...createAttemptEvent(), answer: 12 })).toBe(false);
		expect(isAttemptEvent({ ...createAttemptEvent(), pitchClass: 999 })).toBe(false);
		expect(isAttemptEvent({ ...createAttemptEvent(), octave: 100 })).toBe(false);
	});
});
