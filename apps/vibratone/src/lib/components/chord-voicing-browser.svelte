<script lang="ts">
	import { onDestroy } from 'svelte';
	import { Chord } from 'octavian';
	import Button from '@lostgradient/cinder/button';
	import Input from '@lostgradient/cinder/input';
	import Select from '@lostgradient/cinder/select';
	import Checkbox from '@lostgradient/cinder/checkbox';
	import Card from '@lostgradient/cinder/card';
	import ChordChart from './chord-chart.svelte';
	import type {
		ChordShape,
		VoicingRequest,
		VoicingResponse,
		VoicingSearch
	} from '$lib/chord-voicings';

	let { tuning }: { tuning: readonly number[] } = $props();
	let chordName = $state('C');
	let minFret = $state(0);
	let maxFret = $state(22);
	let maxFretSpan = $state(3);
	let availableFingers = $state('4');
	let allowBarres = $state(true);
	let allowOpen = $state(true);
	let allowMuted = $state(true);
	let omissions = $state<'practical' | 'none'>('none');
	let bass = $state('any');
	let shapes = $derived.by<ChordShape[]>(() => {
		void settingsKey;
		return [];
	});
	let busy = $derived.by<boolean>(() => {
		void settingsKey;
		return false;
	});
	let done = $derived.by<boolean>(() => {
		void settingsKey;
		return false;
	});
	let searched = $derived.by<boolean>(() => {
		void settingsKey;
		return false;
	});
	let error = $derived.by<string>(() => {
		void settingsKey;
		return '';
	});
	let resultChord = $state('');
	let resultTuning = $state<readonly number[]>([]);
	let worker: Worker | undefined;
	const parsed = $derived.by(() => {
		try {
			return Chord.parse(chordName);
		} catch {
			return null;
		}
	});
	const bassOptions = $derived([
		{ value: 'any', label: 'Any inversion' },
		...(parsed?.notes ?? []).map((note, index) => ({
			value: String(note.chromaticIndex),
			label: `${note.toString()} bass${note.chromaticIndex === parsed?.root.chromaticIndex ? ' (root position)' : ` (inversion ${index})`}`
		}))
	]);
	const selectedBass = $derived(bassOptions.some((option) => option.value === bass) ? bass : 'any');
	const settingsKey = $derived(
		JSON.stringify([
			tuning,
			chordName,
			minFret,
			maxFret,
			maxFretSpan,
			availableFingers,
			allowBarres,
			allowOpen,
			allowMuted,
			omissions,
			selectedBass
		])
	);
	// Results describe one immutable search. Editing constraints cancels that search.
	$effect(() => {
		void settingsKey;
		worker?.terminate();
		worker = undefined;
	});
	onDestroy(() => worker?.terminate());
	function search() {
		worker?.terminate();
		shapes = [];
		error = '';
		searched = true;
		done = false;
		if (!parsed) {
			error = 'Enter a chord such as C, Dm7, F#maj7, or C/E.';
			return;
		}
		busy = true;
		resultChord = chordName;
		resultTuning = [...tuning];
		const configuration: VoicingSearch = {
			chord: chordName,
			tuning: [...tuning],
			minFret,
			maxFret,
			maxFretSpan,
			availableFingers: Number(availableFingers),
			allowBarres,
			allowOpen,
			allowMuted,
			omissions,
			bassPitchClass: selectedBass === 'any' ? null : Number(selectedBass)
		};
		try {
			const activeWorker = new Worker(new URL('../chord-voicings.worker.ts', import.meta.url), {
				type: 'module'
			});
			worker = activeWorker;
			activeWorker.onmessage = (event: MessageEvent<VoicingResponse>) => {
				if (worker !== activeWorker) return;
				shapes = [...shapes, ...event.data.shapes];
				done = event.data.done;
				busy = false;
				error = event.data.error ?? '';
				if (done) {
					activeWorker.terminate();
					worker = undefined;
				}
			};
			activeWorker.onerror = () => {
				if (worker === activeWorker) {
					error = 'Unable to search for voicings. Try a narrower fret range.';
					busy = false;
					done = true;
					activeWorker.terminate();
					worker = undefined;
				}
			};
			const request: VoicingRequest = { type: 'start', search: configuration };
			activeWorker.postMessage(request);
		} catch {
			error = 'Background search is unavailable in this browser.';
			busy = false;
			done = true;
		}
	}
	function more() {
		if (!worker || busy) return;
		busy = true;
		const request: VoicingRequest = { type: 'more' };
		worker.postMessage(request);
	}
	function cancel() {
		worker?.terminate();
		worker = undefined;
		busy = false;
		done = true;
		error = 'Search canceled. Refine the settings or search again to continue.';
	}
	function startingFret(shape: ChordShape) {
		const stopped = shape.frets.filter((fret): fret is number => fret !== null && fret > 0);
		return stopped.length ? Math.max(1, Math.min(...stopped)) : 1;
	}
</script>

<div class="voicings">
	<div class="controls">
		<Input id="voicing-chord" label="Chord" bind:value={chordName} placeholder="Cmaj7 or C/E" />
		<Select
			id="voicing-bass"
			label="Bass / inversion"
			options={bassOptions}
			value={selectedBass}
			onchange={(event) => (bass = event.currentTarget.value)}
		/>
		<Input
			id="voicing-first-fret"
			label="First fret"
			type="number"
			min={0}
			max={24}
			value={String(minFret)}
			onValueChange={(value) => (minFret = Number(value))}
		/>
		<Input
			id="voicing-last-fret"
			label="Last fret"
			type="number"
			min={0}
			max={24}
			value={String(maxFret)}
			onValueChange={(value) => (maxFret = Number(value))}
		/>
		<Input
			id="voicing-fret-span"
			label="Maximum fret span"
			type="number"
			min={0}
			max={5}
			value={String(maxFretSpan)}
			onValueChange={(value) => (maxFretSpan = Number(value))}
		/>
		<Select
			id="voicing-fingers"
			label="Fretting fingers"
			options={[1, 2, 3, 4].map((count) => ({ value: String(count), label: String(count) }))}
			bind:value={availableFingers}
		/>
		<Select
			id="voicing-omissions"
			label="Chord tones"
			options={[
				{ value: 'none', label: 'All chord tones' },
				{ value: 'practical', label: 'Allow conventional omissions' }
			]}
			bind:value={omissions}
		/>
	</div>
	<div class="switches">
		<Checkbox label="Allow barres" bind:checked={allowBarres} />
		<Checkbox label="Allow open strings" bind:checked={allowOpen} />
		<Checkbox label="Allow muted strings" bind:checked={allowMuted} />
	</div>
	<div class="actions">
		<Button variant="primary" onclick={search}>Find voicings</Button>{#if busy}<Button
				onclick={cancel}>Cancel search</Button
			>{/if}
	</div>
	{#if error}<p role="alert">{error}</p>{/if}
	<p role="status">
		{#if busy}Finding playable shapes…{:else if searched && !error}{shapes.length}
			{done ? 'matching' : 'loaded'} shapes{done ? '.' : '; more available.'}{/if}
	</p>
	{#if searched && done && !error && shapes.length === 0}<p>
			No shapes match these constraints. Try a wider fret range, another inversion, or allowing
			barres and omissions.
		</p>{/if}
	<div class="gallery">
		{#each shapes as shape, index (`${index}:${shape.frets.join(',')}`)}
			<Card>
				<ChordChart
					tuning={resultTuning}
					frets={shape.frets}
					fingers={shape.fingers}
					barres={shape.barres}
					startingFret={startingFret(shape)}
					fretCount={Math.max(4, maxFretSpan + 1)}
					label={`${resultChord}, shape ${index + 1}`}
				/>
				<p>Bass: {shape.bass}</p>
				{#if shape.omittedIntervals.length}<p>Omitted: {shape.omittedIntervals.join(', ')}</p>{/if}
			</Card>
		{/each}
	</div>
	{#if shapes.length && !done}<Button disabled={busy} onclick={more}>Load more shapes</Button>{/if}
</div>

<style>
	.voicings {
		display: grid;
		gap: var(--cinder-space-4);
	}
	.controls {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr));
		gap: var(--cinder-space-4);
	}
	.switches,
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--cinder-space-4);
	}
	.gallery {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
		gap: var(--cinder-space-4);
	}
	p {
		margin: 0;
		color: var(--cinder-text-muted);
	}
</style>
