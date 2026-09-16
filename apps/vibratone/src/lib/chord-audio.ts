export const CHORD_AUDIO_LENGTH_SECONDS = 1.2;
export const CHORD_AUDIO_RELEASE_SECONDS = 0.35;

export function normalizedChordGain(noteCount: number, peak = 0.34): number {
	return noteCount > 0 ? peak / Math.sqrt(noteCount) : 0;
}

type ActivePlayback = { gain: GainNode; sources: OscillatorNode[] };

/** Browser-only polyphonic playback with lazy context creation and cancellation. */
export class ChordAudio {
	#context: AudioContext | null = null;
	#master: GainNode | null = null;
	#active: ActivePlayback | null = null;
	#generation = 0;

	async play(frequencies: readonly number[]): Promise<boolean> {
		const generation = ++this.#generation;
		this.#stopActive();
		const context = this.#getContext();
		if (!context || frequencies.length === 0) return false;
		if (context.state === 'suspended') await context.resume();
		if (generation !== this.#generation) return false;
		const master = this.#master;
		if (!master) return false;
		const now = context.currentTime;
		const gain = context.createGain();
		const peak = normalizedChordGain(frequencies.length);
		gain.gain.setValueAtTime(0.0001, now);
		gain.gain.linearRampToValueAtTime(peak, now + 0.02);
		gain.gain.setValueAtTime(peak * 0.82, now + 0.08);
		gain.gain.setValueAtTime(peak * 0.82, now + CHORD_AUDIO_LENGTH_SECONDS);
		gain.gain.linearRampToValueAtTime(
			0,
			now + CHORD_AUDIO_LENGTH_SECONDS + CHORD_AUDIO_RELEASE_SECONDS
		);
		gain.connect(master);
		const sources = frequencies.map((frequency) => {
			const oscillator = context.createOscillator();
			oscillator.type = 'sine';
			oscillator.frequency.value = frequency;
			oscillator.connect(gain);
			oscillator.start(now);
			oscillator.stop(now + CHORD_AUDIO_LENGTH_SECONDS + CHORD_AUDIO_RELEASE_SECONDS + 0.02);
			return oscillator;
		});
		this.#active = { gain, sources };
		return true;
	}

	stop(): void {
		this.#generation += 1;
		this.#stopActive();
	}

	#stopActive(): void {
		const active = this.#active;
		this.#active = null;
		if (!active || !this.#context) return;
		const now = this.#context.currentTime;
		active.gain.gain.cancelScheduledValues(now);
		active.gain.gain.setValueAtTime(Math.max(active.gain.gain.value, 0.0001), now);
		active.gain.gain.linearRampToValueAtTime(0, now + 0.05);
		for (const source of active.sources) {
			try {
				source.stop(now + 0.06);
			} catch {
				// The source already ended.
			}
			source.disconnect();
		}
		active.gain.disconnect();
	}

	dispose(): void {
		this.stop();
		this.#master?.disconnect();
		this.#context?.close();
		this.#master = null;
		this.#context = null;
	}

	#getContext(): AudioContext | null {
		if (this.#context) return this.#context;
		if (typeof window === 'undefined') return null;
		const AudioContextClass =
			window.AudioContext ??
			(window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
		if (!AudioContextClass) return null;
		this.#context = new AudioContextClass();
		this.#master = this.#context.createGain();
		this.#master.gain.value = 0.9;
		this.#master.connect(this.#context.destination);
		return this.#context;
	}
}
