import { describe, expect, it } from 'vitest';
import {
	DEFAULT_NOTE_LENGTH,
	DEFAULT_TONE,
	PIANO_FILTER_SWEEP,
	TONE_ENVELOPE,
	WARM_PARTIAL_GAINS,
	pianoFilterCutoff,
	pluckEnvelope,
	sustainedEnvelope
} from './audio.ts';

describe('sustainedEnvelope', () => {
	it('starts and ends at silence', () => {
		const points = sustainedEnvelope(1.2, 0.3, 0.35);
		expect(points[0]).toEqual({ time: 0, gain: 0 });
		expect(points.at(-1)?.gain).toBe(0);
	});

	it('reaches the peak after the attack', () => {
		const points = sustainedEnvelope(1.2, 0.3, 0.35);
		expect(points[1]).toEqual({ time: 0.02, gain: 0.3 });
	});

	it('decays to 85% of the peak for the sustain', () => {
		const points = sustainedEnvelope(1.2, 0.3, 0.35);
		expect(points[2].gain).toBeCloseTo(0.255, 6);
	});

	it('holds the sustain across the note length', () => {
		const points = sustainedEnvelope(1.2, 0.3, 0.35);
		expect(points[3].time).toBe(1.2);
		expect(points[3].gain).toBeCloseTo(0.255, 6);
	});

	it('releases after the hold', () => {
		const points = sustainedEnvelope(1.2, 0.3, 0.35);
		expect(points.at(-1)?.time).toBeCloseTo(1.2 + 0.35, 6);
	});

	it('clamps a very short note to at least the attack+decay window', () => {
		const points = sustainedEnvelope(0.01, 0.3, 0.35);
		expect(points[3].time).toBeCloseTo(0.08, 6);
	});

	it('rises then is non-increasing through release', () => {
		const points = sustainedEnvelope(1.2, 0.3, 0.35);
		expect(points[1].gain).toBeGreaterThan(points[0].gain);
		for (let i = 2; i < points.length; i++) {
			expect(points[i].gain).toBeLessThanOrEqual(points[i - 1].gain);
		}
	});
});

describe('pluckEnvelope', () => {
	it('attacks in 6 ms to near-full gain', () => {
		const points = pluckEnvelope(1.2);
		expect(points[1]).toEqual({ time: 0.006, gain: 0.95 });
	});

	it('never ramps to exactly zero (exponential ramp safety)', () => {
		const points = pluckEnvelope(1.2);
		expect(points[0].gain).toBeGreaterThan(0);
		expect(points.at(-1)?.gain).toBeGreaterThan(0);
	});

	it('decays no sooner than 1.4 s', () => {
		expect(pluckEnvelope(0.5).at(-1)?.time).toBe(1.4);
	});

	it('extends the decay for long notes (length + 0.3)', () => {
		expect(pluckEnvelope(2.5).at(-1)?.time).toBeCloseTo(2.8, 6);
	});
});

describe('warm partials', () => {
	it('uses six descending harmonic gains', () => {
		expect(WARM_PARTIAL_GAINS).toEqual([1, 0.55, 0.34, 0.2, 0.12, 0.07]);
		for (let i = 1; i < WARM_PARTIAL_GAINS.length; i++) {
			expect(WARM_PARTIAL_GAINS[i]).toBeLessThan(WARM_PARTIAL_GAINS[i - 1]);
		}
	});
});

describe('pianoFilterCutoff', () => {
	it('starts at the high cutoff', () => {
		expect(pianoFilterCutoff(0)).toBe(PIANO_FILTER_SWEEP.startHz);
		expect(pianoFilterCutoff(-1)).toBe(PIANO_FILTER_SWEEP.startHz);
	});

	it('ends at the low cutoff once the sweep completes', () => {
		expect(pianoFilterCutoff(PIANO_FILTER_SWEEP.durationSeconds)).toBe(PIANO_FILTER_SWEEP.endHz);
		expect(pianoFilterCutoff(5)).toBe(PIANO_FILTER_SWEEP.endHz);
	});

	it('interpolates linearly at the midpoint', () => {
		const mid = pianoFilterCutoff(PIANO_FILTER_SWEEP.durationSeconds / 2);
		expect(mid).toBeCloseTo((PIANO_FILTER_SWEEP.startHz + PIANO_FILTER_SWEEP.endHz) / 2, 6);
	});

	it('descends monotonically across the sweep', () => {
		const a = pianoFilterCutoff(0.2);
		const b = pianoFilterCutoff(0.6);
		const c = pianoFilterCutoff(1.0);
		expect(a).toBeGreaterThan(b);
		expect(b).toBeGreaterThan(c);
	});
});

describe('tone envelope config and defaults', () => {
	it('defines peak and release for sine and warm', () => {
		expect(TONE_ENVELOPE.sine).toEqual({ peak: 0.3, release: 0.35 });
		expect(TONE_ENVELOPE.warm).toEqual({ peak: 0.28, release: 0.45 });
	});

	it('hard-codes sensible defaults (no Tweaks panel)', () => {
		expect(DEFAULT_TONE).toBe('sine');
		expect(DEFAULT_NOTE_LENGTH).toBe(1.2);
	});
});
