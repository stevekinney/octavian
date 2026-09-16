<script lang="ts">
	import { onMount } from 'svelte';
	import { identifyGuitarChords, Note, createMidiKey, type GuitarBarre } from 'octavian';
	import Card from '@lostgradient/cinder/card';
	import Checkbox from '@lostgradient/cinder/checkbox';
	import SegmentedControl, { Segment } from '@lostgradient/cinder/segmented-control';
	import ChordName from '$lib/components/chord-name.svelte';
	import ChordChart from '$lib/components/chord-chart.svelte';
	import ChordVoicingBrowser from '$lib/components/chord-voicing-browser.svelte';
	import TuningSettings from '$lib/components/tuning-settings.svelte';

	let utility = $state('identify');
	let tuning = $state<readonly number[]>([40, 45, 50, 55, 59, 64]);
	let frets = $state<readonly (number | null)[]>([null, 3, 2, 0, 1, 0]);
	let barres = $state<readonly GuitarBarre[]>([]);
	let allowOmissions = $state(false);
	let mounted = $state(false);
	const recognition = $derived.by(() => {
		try {
			return {
				matches: identifyGuitarChords(frets, {
					tuning: { strings: tuning.map((midi) => Note.fromMidi(createMidiKey(midi))) },
					omissions: allowOmissions ? 'practical' : 'none'
				}),
				error: ''
			};
		} catch (error) {
			return {
				matches: [],
				error: error instanceof Error ? error.message : 'Unable to identify this shape.'
			};
		}
	});
	function changeTuning(notes: readonly number[]) {
		tuning = [...notes];
		frets = notes.map((_, index) => frets[index] ?? null);
		barres = [];
	}
	function changeFret(index: number, fret: number | null) {
		frets = frets.map((value, string) => (string === index ? fret : value));
		barres = barres.filter(
			(barre) =>
				index < barre.fromString ||
				index > barre.toString ||
				(fret !== null &&
					(index === barre.fromString || index === barre.toString
						? fret === barre.fret
						: fret >= barre.fret))
		);
	}
	function addBarre(barre: GuitarBarre) {
		const { fromString: from, toString: to, fret: barreFret } = barre;
		frets = frets.map((fret, index) =>
			index === from || index === to
				? barreFret
				: index > from && index < to
					? Math.max(fret ?? 0, barreFret)
					: fret
		);
		barres = [...barres.filter((existing) => existing.fret !== barreFret), barre];
	}
	onMount(() => {
		mounted = true;
	});
</script>

<svelte:head><title>Chords · Vibratone</title></svelte:head>
<main class="chord-workspace">
	<SegmentedControl
		id="chord-utility"
		label="Chord utility"
		labelVisible={false}
		selectionMode="single"
		disabled={!mounted}
		bind:value={utility}
	>
		<Segment value="identify">Identify a shape</Segment><Segment value="voicings"
			>Find voicings</Segment
		>
	</SegmentedControl>
	{#if utility === 'identify'}
		<Card>
			<div class="workspace-body">
				<div class="toolbar">
					<TuningSettings {tuning} onTuningChange={changeTuning} />
					<Checkbox label="Allow conventional omissions" bind:checked={allowOmissions} />
				</div>
				<div class="identify">
					<div>
						<ChordChart
							{tuning}
							{frets}
							{barres}
							fretCount={5}
							label="Chord shape to identify"
							onFretChange={changeFret}
							onBarreChange={addBarre}
						/>
					</div>
					<div class="recognition">
						<div aria-live="polite" aria-atomic="true">
							{#if recognition.error}<p role="alert">{recognition.error}</p>
							{:else if recognition.matches.length}
								<h2><ChordName name={recognition.matches[0].name} /></h2>
								<p>
									Notes: {recognition.matches[0].notes.map((note) => note.toString()).join(' · ')}
								</p>
								<ul>
									{#each recognition.matches as match (`${match.name}:${match.suffix}`)}<li>
											<strong><ChordName name={match.name} /></strong> · {match.match === 'exact'
												? 'All chord tones'
												: `Omitted ${match.omittedIntervals.join(', ')}`} · bass {match.bass.toString()}
										</li>{/each}
								</ul>
							{:else}<p>
									{frets.every((fret) => fret === null)
										? 'Choose open strings or frets to identify a chord.'
										: 'No catalog chord matches these notes. Try another shape or allow conventional omissions.'}
								</p>{/if}
						</div>
					</div>
				</div>
			</div>
		</Card>
	{:else}<Card
			><div class="workspace-body">
				<TuningSettings {tuning} onTuningChange={changeTuning} /><ChordVoicingBrowser {tuning} />
			</div></Card
		>{/if}
</main>

<style>
	.chord-workspace {
		max-width: 1040px;
		margin: 0 auto;
		padding: var(--cinder-space-5);
		display: grid;
		gap: var(--cinder-space-5);
	}
	.identify {
		display: grid;
		grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
		align-items: center;
		gap: var(--cinder-space-6);
	}
	.recognition {
		display: grid;
		gap: var(--cinder-space-4);
		align-content: start;
	}
	.workspace-body {
		display: grid;
		gap: 28px;
	}
	.toolbar {
		display: grid;
		grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
		gap: 16px;
		align-items: center;
	}
	h2 {
		font-size: 3rem;
		margin: var(--cinder-space-4) 0;
	}
	p,
	li {
		color: var(--cinder-text-muted);
	}
	ul {
		padding-left: var(--cinder-space-5);
	}
	li {
		margin-block: var(--cinder-space-2);
	}
	@media (max-width: 640px) {
		.toolbar {
			grid-template-columns: minmax(0, 1fr);
		}
		.toolbar > :global(:last-child) {
			grid-column: 1 / -1;
		}
		.identify {
			grid-template-columns: minmax(0, 1fr);
		}
		.chord-workspace {
			padding: var(--cinder-space-3);
		}
	}
</style>
