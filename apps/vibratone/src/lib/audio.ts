/**
 * Web Audio synthesis for Vibratone. The synthesis *parameters* (envelope
 * breakpoints, additive-partial gains, the piano filter sweep) are pure,
 * exported, and unit tested; the node wiring that consumes them is browser-only
 * and thin. The `AudioContext` is constructed lazily, the first time audio is
 * requested inside a user gesture — never at module load, where browsers would
 * auto-suspend it and break the gesture association.
 */

/** The available timbres. The app hard-codes `'sine'`, but all three work. */
export type Tone = 'sine' | 'warm' | 'piano';

/** Options for a single note. */
export type PlayOptions = {
	tone: Tone;
	/** Sustain length in seconds (the hold portion of the envelope). */
	length: number;
};

/** A linear amplitude breakpoint: `gain` reached `time` seconds after onset. */
export type EnvelopePoint = { time: number; gain: number };

/**
 * The sustained ADSR envelope used by the sine and warm tones: a fast attack to
 * a peak, a slight decay, a hold across the note length, then a release to zero.
 * Returned as absolute-time breakpoints (seconds from note onset).
 */
export function sustainedEnvelope(length: number, peak: number, release: number): EnvelopePoint[] {
	const attack = 0.02;
	const decay = 0.06;
	const sustainLevel = peak * 0.85;
	const holdEnd = Math.max(attack + decay, length);
	return [
		{ time: 0, gain: 0 },
		{ time: attack, gain: peak },
		{ time: attack + decay, gain: sustainLevel },
		{ time: holdEnd, gain: sustainLevel },
		{ time: holdEnd + release, gain: 0 }
	];
}

/**
 * The percussive piano envelope: a 6 ms attack to near-full gain followed by an
 * exponential-style decay toward silence. We model the decay target as a small
 * non-zero floor so it can drive `exponentialRampToValueAtTime`, which cannot
 * ramp to exactly zero.
 */
export function pluckEnvelope(length: number): EnvelopePoint[] {
	const attack = 0.006;
	const peak = 0.95;
	const end = Math.max(1.4, length + 0.3);
	return [
		{ time: 0, gain: 0.0001 },
		{ time: attack, gain: peak },
		{ time: end, gain: 0.0001 }
	];
}

/** Additive sine-partial gains for the warm (organ) tone, harmonics 1–6. */
export const WARM_PARTIAL_GAINS = [1, 0.55, 0.34, 0.2, 0.12, 0.07] as const;

/** Peak gain and release for each sustained tone. */
export const TONE_ENVELOPE = {
	sine: { peak: 0.3, release: 0.35 },
	warm: { peak: 0.28, release: 0.45 }
} as const;

/** The piano lowpass sweep: start/end cutoff (Hz) and sweep duration (s). */
export const PIANO_FILTER_SWEEP = { startHz: 5200, endHz: 750, durationSeconds: 1.1 } as const;

/**
 * The lowpass cutoff for the piano tone at a given time after onset, sweeping
 * linearly from the start cutoff down to the end cutoff over the sweep duration
 * and holding there afterward.
 */
export function pianoFilterCutoff(secondsSinceOnset: number): number {
	const { startHz, endHz, durationSeconds } = PIANO_FILTER_SWEEP;
	if (secondsSinceOnset <= 0) return startHz;
	if (secondsSinceOnset >= durationSeconds) return endHz;
	const progress = secondsSinceOnset / durationSeconds;
	return startHz + (endHz - startHz) * progress;
}

/** The default note length, in seconds (no Tweaks panel). */
export const DEFAULT_NOTE_LENGTH = 1.2;
/** The default tone (no Tweaks panel). */
export const DEFAULT_TONE: Tone = 'sine';

// --- Browser-only node wiring below. Not unit tested; covered by e2e + manual. ---

type ActiveVoice = { gain: GainNode; sources: AudioScheduledSourceNode[] };

/**
 * A thin synthesizer around a single shared `AudioContext`. Construct it lazily
 * inside a user gesture via {@link getSynth}. Tracks active voices so a rapid
 * replay can ramp the previous note down before starting the next.
 */
export class Synth {
	#context: AudioContext;
	#master: GainNode;
	#voices = new Set<ActiveVoice>();

	constructor(context: AudioContext) {
		this.#context = context;
		this.#master = context.createGain();
		this.#master.gain.value = 0.9;
		this.#master.connect(context.destination);
	}

	/** Resume a suspended context (Chrome/Safari start suspended until a gesture). */
	resume(): Promise<void> {
		if (this.#context.state === 'suspended') {
			return this.#context.resume();
		}
		return Promise.resolve();
	}

	get state(): AudioContextState {
		return this.#context.state;
	}

	get context(): AudioContext {
		return this.#context;
	}

	/** Ramp every active voice down quickly so replays don't pile up. */
	stopAll(): void {
		const now = this.#context.currentTime;
		for (const voice of this.#voices) {
			voice.gain.gain.cancelScheduledValues(now);
			voice.gain.gain.setValueAtTime(Math.max(voice.gain.gain.value, 0.0001), now);
			voice.gain.gain.linearRampToValueAtTime(0, now + 0.06);
			for (const source of voice.sources) {
				try {
					source.stop(now + 0.07);
				} catch {
					// Already stopped — ignore.
				}
			}
		}
		this.#voices.clear();
	}

	/** Play a frequency with the given tone, ramping any current note down first. */
	play(frequency: number, options: PlayOptions): void {
		this.stopAll();
		const now = this.#context.currentTime;
		if (options.tone === 'piano') {
			this.#playPluck(frequency, options.length, now);
		} else {
			this.#playSustained(frequency, options, now);
		}
	}

	#registerVoice(gain: GainNode, sources: AudioScheduledSourceNode[]): void {
		const voice: ActiveVoice = { gain, sources };
		this.#voices.add(voice);
		const last = sources[sources.length - 1];
		last.addEventListener('ended', () => this.#voices.delete(voice));
	}

	#applyEnvelope(param: AudioParam, points: EnvelopePoint[], now: number): void {
		param.cancelScheduledValues(now);
		param.setValueAtTime(points[0].gain, now);
		for (const point of points.slice(1)) {
			param.linearRampToValueAtTime(point.gain, now + point.time);
		}
	}

	#playSustained(frequency: number, options: PlayOptions, now: number): void {
		const config = options.tone === 'warm' ? TONE_ENVELOPE.warm : TONE_ENVELOPE.sine;
		const points = sustainedEnvelope(options.length, config.peak, config.release);
		const envelope = this.#context.createGain();
		envelope.connect(this.#master);
		this.#applyEnvelope(envelope.gain, points, now);

		const sources: AudioScheduledSourceNode[] = [];
		const end = now + points[points.length - 1].time;
		if (options.tone === 'warm') {
			WARM_PARTIAL_GAINS.forEach((gain, index) => {
				const oscillator = this.#context.createOscillator();
				oscillator.type = 'sine';
				oscillator.frequency.value = frequency * (index + 1);
				const partialGain = this.#context.createGain();
				partialGain.gain.value = gain / WARM_PARTIAL_GAINS.length;
				oscillator.connect(partialGain).connect(envelope);
				oscillator.start(now);
				oscillator.stop(end);
				sources.push(oscillator);
			});
		} else {
			const oscillator = this.#context.createOscillator();
			oscillator.type = 'sine';
			oscillator.frequency.value = frequency;
			oscillator.connect(envelope);
			oscillator.start(now);
			oscillator.stop(end);
			sources.push(oscillator);
		}
		this.#registerVoice(envelope, sources);
	}

	#playPluck(frequency: number, length: number, now: number): void {
		const points = pluckEnvelope(length);
		const envelope = this.#context.createGain();
		const filter = this.#context.createBiquadFilter();
		filter.type = 'lowpass';
		filter.frequency.setValueAtTime(PIANO_FILTER_SWEEP.startHz, now);
		filter.frequency.linearRampToValueAtTime(
			PIANO_FILTER_SWEEP.endHz,
			now + PIANO_FILTER_SWEEP.durationSeconds
		);
		filter.connect(envelope);
		envelope.connect(this.#master);

		envelope.gain.cancelScheduledValues(now);
		envelope.gain.setValueAtTime(points[0].gain, now);
		envelope.gain.linearRampToValueAtTime(points[1].gain, now + points[1].time);
		envelope.gain.exponentialRampToValueAtTime(points[2].gain, now + points[2].time);

		const end = now + points[2].time;
		const triangle = this.#context.createOscillator();
		triangle.type = 'triangle';
		triangle.frequency.value = frequency;
		triangle.connect(filter);
		triangle.start(now);
		triangle.stop(end);

		const octave = this.#context.createOscillator();
		octave.type = 'sine';
		octave.frequency.value = frequency * 2;
		const octaveGain = this.#context.createGain();
		octaveGain.gain.value = 0.32;
		octave.connect(octaveGain).connect(filter);
		octave.start(now);
		octave.stop(end);

		this.#registerVoice(envelope, [triangle, octave]);
	}
}

let synth: Synth | null = null;

/**
 * Get the shared {@link Synth}, constructing the `AudioContext` on first call.
 * MUST be called synchronously inside a user gesture so the context is allowed
 * to start. Returns `null` outside the browser or if Web Audio is unavailable.
 */
export function getSynth(): Synth | null {
	if (synth) return synth;
	if (typeof window === 'undefined') return null;
	const AudioContextClass =
		window.AudioContext ??
		(window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
	if (!AudioContextClass) return null;
	synth = new Synth(new AudioContextClass());
	return synth;
}

/** Reset the shared synth — used by tests; harmless in production. */
export function resetSynth(): void {
	synth = null;
}
