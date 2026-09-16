import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import ChordChart from './chord-chart.svelte';

describe('ChordChart', () => {
	it('renders the standard six-string C shape by default', async () => {
		render(ChordChart);
		await expect.element(page.getByTestId('chord-chart')).toBeVisible();
		expect(document.querySelectorAll('svg line')).toHaveLength(11);
		expect(page.getByRole('img', { name: 'Chord diagram' })).toBeInTheDocument();
		expect(document.querySelectorAll('.open')).toHaveLength(2);
		expect(document.querySelector('.muted')).toBeInTheDocument();
	});

	it('supports custom tuning, fret windows, and finger labels', async () => {
		render(ChordChart, {
			tuning: [36, 43, 50, 55],
			frets: [5, 7, 7, 6],
			fingers: [1, 3, 4, 2],
			startingFret: 5,
			fretCount: 3,
			label: 'A shape'
		});
		expect(page.getByRole('img', { name: 'A shape' })).toBeInTheDocument();
		expect(document.querySelectorAll('.finger')).toHaveLength(4);
		expect([...document.querySelectorAll('svg text')].map((node) => node.textContent)).toContain(
			'5'
		);
	});

	it('adapts the default shape to a shorter custom tuning', async () => {
		render(ChordChart, { tuning: [40, 45, 50] });
		expect(page.getByRole('img', { name: 'Chord diagram' })).toBeInTheDocument();
		expect(document.querySelectorAll('.tuning')).toHaveLength(3);
	});

	it('renders barres and emits controlled fret edits', async () => {
		const changes: Array<[number, number | null]> = [];
		render(ChordChart, {
			frets: [null, 3, 2, 0, 1, 0],
			barres: [{ finger: 1, fret: 1, fromString: 0, toString: 5 }],
			onFretChange: (stringIndex, fret) => changes.push([stringIndex, fret])
		});
		expect(document.querySelector('.barre')).toBeInTheDocument();
		await page.getByTestId('chord-cell-1-3').click();
		expect(changes).toEqual([[1, null]]);
	});

	it('renders a barre as one rounded shape without duplicate dots or finger labels', () => {
		render(ChordChart, {
			frets: [3, 5, 5, 3, 3, 3],
			fingers: [1, 3, 4, 1, 1, 1],
			barres: [{ finger: 1, fret: 3, fromString: 0, toString: 5 }]
		});
		expect(document.querySelectorAll('.dot')).toHaveLength(2);
		expect(document.querySelectorAll('.finger')).toHaveLength(2);
		expect(document.querySelectorAll('.barre-finger')).toHaveLength(1);
		const barre = document.querySelector('.barre')!;
		expect(getComputedStyle(barre).strokeWidth).toBe('18px');
		expect(getComputedStyle(barre).strokeLinecap).toBe('round');
	});

	it('toggles open and muted strings directly', async () => {
		const changes: Array<[number, number | null]> = [];
		render(ChordChart, {
			frets: [null, 3, 2, 0, 1, 0],
			onFretChange: (stringIndex, fret) => changes.push([stringIndex, fret])
		});
		await page.getByTestId('chord-string-toggle-0').click();
		await page.getByTestId('chord-string-toggle-3').click();
		expect(changes).toEqual([
			[0, 0],
			[3, null]
		]);
	});

	it('creates a barre from two same-fret cells', async () => {
		let created: unknown;
		render(ChordChart, {
			onFretChange: () => undefined,
			onBarreChange: (barre) => (created = barre)
		});
		await page.getByTestId('chord-cell-1-3').click({ modifiers: ['Shift'] });
		await page.getByTestId('chord-cell-4-3').click({ modifiers: ['Shift'] });
		expect(created).toEqual({ finger: 1, fret: 3, fromString: 1, toString: 4 });
	});

	it('aligns the clickable cell with its displayed string and fret', async () => {
		render(ChordChart, { onFretChange: () => {} });
		const cell = page.getByTestId('chord-cell-1-3').element().getBoundingClientRect();
		const dot = document.querySelector('.dot')!.getBoundingClientRect();
		expect(Math.abs(cell.left + cell.width / 2 - dot.left - dot.width / 2)).toBeLessThan(1);
		expect(Math.abs(cell.top + cell.height / 2 - dot.top - dot.height / 2)).toBeLessThan(1);
	});

	it('reports invalid props accessibly without throwing', async () => {
		render(ChordChart, { tuning: [40], fretCount: 0 });
		await expect.element(page.getByRole('alert')).toBeVisible();
		expect(page.getByRole('alert').element().textContent).toContain('2 to 8 strings');
	});

	it('rejects oversized tunings and mismatched fret arrays', async () => {
		render(ChordChart, { tuning: [40, 41, 42, 43, 44, 45, 46, 47, 48] });
		await expect.element(page.getByRole('alert')).toBeVisible();
		expect(page.getByRole('alert').element().textContent).toContain('2 to 8 strings');
	});
});
