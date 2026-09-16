import { pitchToFrequency, type Pitch } from '../../music.ts';
import { createPrompt, poolSize } from '../../round.ts';
import type { DrillConfig, DrillPrompt } from './schema.ts';
import { seededRandomInt } from './seeded-random.ts';

export const DEFAULT_SESSION_PROMPT_COUNT = 64;

function promptId(config: DrillConfig, pitch: Pitch, sequenceIndex: number): string {
	return `${config.drillId}:${config.seed ?? 'random'}:${sequenceIndex}:${pitch.pc}:${pitch.octave}`;
}

export function drillPromptFromPitch(
	config: DrillConfig,
	pitch: Pitch,
	sequenceIndex = 0
): DrillPrompt {
	return {
		promptId: promptId(config, pitch, sequenceIndex),
		pitchClass: pitch.pc,
		octave: pitch.octave,
		timbre: config.timbre,
		frequencyHz: pitchToFrequency(pitch),
		stimulusType: 'synthesized'
	};
}

export function createSeededSession(
	config: DrillConfig,
	count = DEFAULT_SESSION_PROMPT_COUNT,
	startIndex = 0
): DrillPrompt[] {
	if (poolSize(config.eligiblePitchClasses, config.octaveLo, config.octaveHi) === 0 || count <= 0) {
		return [];
	}

	const randomInt =
		config.seed !== undefined ? seededRandomInt(config.seed, startIndex) : undefined;
	const prompts: DrillPrompt[] = [];

	for (let index = 0; index < count; index++) {
		const pitch = createPrompt({
			eligiblePitchClasses: config.eligiblePitchClasses,
			octaveLo: config.octaveLo,
			octaveHi: config.octaveHi,
			randomInt
		});
		if (!pitch) break;
		prompts.push(drillPromptFromPitch(config, pitch, startIndex + index));
	}

	return prompts;
}
