import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';
import Fretboard from './fretboard.svelte';

describe('Fretboard', () => {
	it('renders six strings and every fret including the open position', async () => {
		render(Fretboard, { orientation: 'horizontal' });

		await expect.element(page.getByTestId('fretboard')).toBeVisible();
		expect(page.getByRole('gridcell')).toHaveLength(6 * 23);
		expect(page.getByRole('row')).toHaveLength(7);
		expect(page.getByRole('gridcell', { name: 'String 6 fret 0' })).toBeInTheDocument();
		expect(page.getByRole('gridcell', { name: 'String 1 fret 0' })).toBeInTheDocument();
	});

	it('places the highest string at the top and exposes open tuning labels', async () => {
		render(Fretboard, { tuning: [40, 45, 50] });

		const rows = page.getByRole('row');
		expect(rows.nth(1).element().textContent).toContain('D3');
		expect(rows.nth(3).element().textContent).toContain('E2');
		await expect.element(page.getByRole('rowheader', { name: 'String 3, E2' })).toBeInTheDocument();
		await expect.element(page.getByText('E2', { exact: true })).toBeInTheDocument();
	});

	it('renders editable open string tuning labels', async () => {
		render(Fretboard, {
			tuning: [40, 45, 60],
			ontuningchange: () => undefined
		});

		expect(page.getByRole('button', { name: 'Tune string 1' }).element().textContent).toContain(
			'C4'
		);
	});

	it('keeps open tuning labels read-only without a tuning callback', async () => {
		render(Fretboard, { tuning: [40, 45, 50] });
		expect(page.getByRole('button', { name: 'Tune string 3' })).not.toBeInTheDocument();
		await expect.element(page.getByRole('rowheader', { name: 'String 3, E2' })).toBeInTheDocument();
	});

	it('renders editable labels in vertical orientation and rejects out-of-range MIDI', async () => {
		render(Fretboard, {
			orientation: 'vertical',
			tuning: [0],
			ontuningchange: () => undefined
		});

		await expect.element(page.getByRole('button', { name: 'Tune string 1' })).toBeInTheDocument();
		expect(page.getByRole('button', { name: 'Tune string 1' }).element().textContent).toContain(
			'C-1'
		);
	});

	it('renders the nut and standard fret markers', async () => {
		render(Fretboard, { fretCount: 24 });

		expect(document.querySelectorAll('.fretboard .inlay')).toHaveLength(10);
		expect(document.querySelectorAll('.nut')).toHaveLength(6);
		expect(document.querySelectorAll('.inlay.double')).toHaveLength(2);
	});

	it('selects positions with a callback and moves the roving tab stop with arrows', async () => {
		const selected: unknown[] = [];
		render(Fretboard, {
			orientation: 'horizontal',
			onselect: (position) => selected.push(position)
		});

		const open = page.getByRole('gridcell', { name: 'String 6 fret 0' });
		await open.click();
		expect(selected).toEqual([{ stringIndex: 0, fret: 0, midi: 40 }]);
		await open.click();
		await userEvent.keyboard('{ArrowRight}');
		expect(document.activeElement?.getAttribute('aria-label')).toBe('String 6 fret 1');
		await userEvent.keyboard('{ArrowUp}');
		expect(document.activeElement?.getAttribute('aria-label')).toBe('String 5 fret 1');
	});

	it('supports the three allowed fret ranges', async () => {
		const result = await render(Fretboard, { fretCount: 21 });
		expect(page.getByRole('gridcell')).toHaveLength(6 * 22);
		await result.rerender({ fretCount: 22 });
		expect(page.getByRole('gridcell')).toHaveLength(6 * 23);
		await result.rerender({ fretCount: 24 });
		expect(page.getByRole('gridcell')).toHaveLength(6 * 25);
	});

	it('does not reveal note answers in accessible position labels', async () => {
		render(Fretboard, {
			highlighted: { stringIndex: 2, fret: 5 },
			selected: { stringIndex: 2, fret: 5 }
		});

		const labels = [...document.querySelectorAll('[role="gridcell"]')].map((cell) =>
			cell.getAttribute('aria-label')
		);
		expect(labels.every((label) => /^String [1-9] fret (?:\d+)$/.test(label ?? ''))).toBe(true);
	});
	it('keeps a keyboard entry point after reducing strings and frets', async () => {
		const result = await render(Fretboard, { fretCount: 24 });
		await page.getByRole('gridcell', { name: 'String 1 fret 24', exact: true }).click();
		await result.rerender({ tuning: [40, 45], fretCount: 21 });
		const stops = result.container.querySelectorAll('[role="gridcell"][tabindex="0"]');
		expect(stops).toHaveLength(1);
		expect(stops[0].getAttribute('aria-label')).toBe('String 1 fret 21');
	});

	it('reveals changing targets beyond the sticky labels and supports Home navigation', async () => {
		const result = await render(Fretboard, {
			orientation: 'horizontal',
			highlighted: { stringIndex: 0, fret: 0 },
			disabled: true
		});
		result.container.style.width = '264px';
		const pageTop = window.scrollY;
		await result.rerender({ highlighted: { stringIndex: 0, fret: 19 }, disabled: true });
		await expect
			.poll(() => {
				const target = result.container
					.querySelector('[data-highlighted="true"]')!
					.getBoundingClientRect();
				const label = result.container.querySelector('.axis-label')!.getBoundingClientRect();
				const viewport = result.container
					.querySelector('.fretboard-scroll')!
					.getBoundingClientRect();
				return target.left >= label.right && target.right <= viewport.right;
			})
			.toBe(true);
		expect(window.scrollY).toBe(pageTop);
		page.getByRole('gridcell', { name: 'String 6 fret 19', exact: true }).element().focus();
		await userEvent.keyboard('{Home}');
		expect(document.activeElement?.getAttribute('aria-label')).toBe('String 6 fret 0');
		await expect
			.poll(() => result.container.querySelector('.fretboard-scroll')!.scrollLeft)
			.toBe(0);
	});
	it('uses vertical spatial arrow directions and reveals an off-screen selection', async () => {
		const result = await render(Fretboard, { orientation: 'vertical' });
		const open = page.getByRole('gridcell', { name: 'String 6 fret 0', exact: true });
		await open.click();
		await userEvent.keyboard('{ArrowDown}{ArrowRight}');
		expect(document.activeElement?.getAttribute('aria-label')).toBe('String 5 fret 1');
		await result.rerender({ selected: { stringIndex: 1, fret: 20 } });
		await expect
			.poll(() => {
				const selected = result.container
					.querySelector('[aria-selected="true"]')!
					.getBoundingClientRect();
				const viewport = result.container
					.querySelector('.fretboard-scroll')!
					.getBoundingClientRect();
				return selected.top >= viewport.top + 36 && selected.bottom <= viewport.bottom;
			})
			.toBe(true);
	});
});
