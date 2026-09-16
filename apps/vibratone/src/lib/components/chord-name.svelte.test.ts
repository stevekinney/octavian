import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ChordName from './chord-name.svelte';

describe('ChordName', () => {
	it.each([
		['Cadd9', 'C', 'add9', ''],
		['Bbmaj7/D', 'B♭', 'maj7', '/D'],
		['F#m7b5', 'F♯', '7♭5', ''],
		['C6/9', 'C', '6/9', ''],
		['Bdim7', 'B', '°7', ''],
		['Caug', 'C', '+', ''],
		['2. Dm7', 'D', '7', '']
	])('typesets %s without changing its accessible name', (name, root, extension, bass) => {
		render(ChordName, { name });
		expect(document.querySelector('.chord-name')).toHaveAttribute('aria-label', name);
		expect(document.querySelector('.root')).toHaveTextContent(root);
		expect(document.querySelector('sup')).toHaveTextContent(extension);
		expect(document.querySelector('.bass')?.textContent ?? '').toBe(bass);
	});
	it('renders standalone chord qualities', () => {
		render(ChordName, { name: 'mMaj7', suffixOnly: true });
		expect(document.querySelector('.minor')).toHaveTextContent('m');
		expect(document.querySelector('sup')).toHaveTextContent('Maj7');
	});
	it('preserves descriptive labels', () => {
		render(ChordName, { name: 'Major triad' });
		expect(document.querySelector('.chord-name')).toHaveTextContent('Major triad');
		expect(document.querySelector('sup')).toBeNull();
	});
});
