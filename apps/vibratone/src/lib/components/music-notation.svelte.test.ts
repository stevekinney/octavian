import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import MusicNotation from './music-notation.svelte';

const waitForNotation = () => expect.element(page.getByTestId('measure-0')).toContainHTML('<svg');

describe('MusicNotation', () => {
	it('renders the default treble clef with an accessible description', async () => {
		render(MusicNotation);
		await waitForNotation();
		await expect
			.element(page.getByRole('img', { name: 'Music notation in treble clef, key C' }))
			.toBeVisible();
	});

	it('supports every VexFlow clef and an answer-safe label override', async () => {
		const result = await render(MusicNotation, { ariaLabel: 'Identify this notation' });
		for (const clef of [
			'treble',
			'bass',
			'alto',
			'tenor',
			'percussion',
			'soprano',
			'mezzo-soprano',
			'baritone-c',
			'baritone-f',
			'subbass',
			'french',
			'tab'
		] as const) {
			await result.rerender({ clef, ariaLabel: 'Identify this notation' });
			await waitForNotation();
		}
		await expect
			.element(page.getByRole('img', { name: 'Identify this notation' }).last())
			.toBeVisible();
	});

	it('renders single notes and chords with typed durations', async () => {
		render(MusicNotation, {
			notes: [
				{ keys: ['c/4'], duration: 'q' },
				{ keys: ['c/4', 'e/4', 'g/4'], duration: 'h', dots: 1 }
			]
		});
		await waitForNotation();
		await expect.element(page.getByTestId('measure-0')).toContainHTML('vf-stavenote');
		await expect.element(page.getByTestId('measure-0')).toContainHTML('vf-notehead');
	});

	it('renders multiple measures and applies key and time signatures', async () => {
		render(MusicNotation, {
			keySignature: 'Bb',
			timeSignature: '3/4',
			measures: [
				{ notes: [{ keys: ['c/4'], duration: 'q' }] },
				{ notes: [{ keys: ['d/4'], duration: 'q' }] }
			]
		});
		await waitForNotation();
		await expect.element(page.getByTestId('measure-1')).toContainHTML('<svg');
		expect(
			page.getByTestId('measure-0').element().querySelector('.vf-timesignature')
		).not.toBeNull();
		expect(
			page.getByTestId('measure-0').element().querySelector('.vf-keysignature')
		).not.toBeNull();
	});

	it('updates rendered notes and keeps each stave at a readable width', async () => {
		const result = await render(MusicNotation, {
			notes: [{ keys: ['c/4'], duration: 'q' }]
		});
		await waitForNotation();
		await result.rerender({
			notes: [
				{ keys: ['c/4', 'e/4', 'g/4'], duration: 'h', dots: 1 },
				{ keys: ['b/4'], duration: '8' }
			]
		});
		await expect.element(page.getByTestId('measure-0')).toContainHTML('vf-stavenote');
		expect(page.getByTestId('measure-0').element().querySelectorAll('.vf-notehead')).toHaveLength(
			4
		);
		expect(page.getByTestId('measure-0').element().querySelectorAll('.vf-accidental')).toHaveLength(
			0
		);
	});
	it('resizes without clipping glyphs and contains dense measures in a scroll region', async () => {
		const result = await render(MusicNotation, {
			keySignature: 'C#',
			measures: [
				{ notes: Array.from({ length: 24 }, () => ({ keys: ['c/6'], duration: '16' as const })) }
			]
		});
		result.container.style.width = '260px';
		await waitForNotation();
		await expect
			.poll(() => page.getByTestId('measure-0').element().getBoundingClientRect().width)
			.toBe(260);
		const measure = page.getByTestId('measure-0').element();
		expect(getComputedStyle(measure).overflowX).toBe('auto');
		expect(measure.scrollWidth).toBeGreaterThan(measure.clientWidth);
		const svg = measure.querySelector('svg')!;
		const bounds = svg.getBBox();
		expect(bounds.y).toBeGreaterThanOrEqual(svg.viewBox.baseVal.y);
		expect(bounds.y + bounds.height).toBeLessThanOrEqual(
			svg.viewBox.baseVal.y + svg.viewBox.baseVal.height
		);
		result.container.style.width = '520px';
		await expect
			.poll(() => page.getByTestId('measure-0').element().getBoundingClientRect().width)
			.toBe(520);
		expect(result.container.querySelectorAll('svg')).toHaveLength(1);
	});
});
