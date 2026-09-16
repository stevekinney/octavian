<script lang="ts">
	import { onMount } from 'svelte';
	import Button from '@lostgradient/cinder/button';
	import Card from '@lostgradient/cinder/card';
	import SegmentedControl, { Segment } from '@lostgradient/cinder/segmented-control';
	import MusicNotation from '$lib/components/music-notation.svelte';
	import type { Clef } from '$lib/notation';

	const signatures = [
		{ key: 'Cb', label: 'C♭ major', count: -7 },
		{ key: 'Gb', label: 'G♭ major', count: -6 },
		{ key: 'Db', label: 'D♭ major', count: -5 },
		{ key: 'Ab', label: 'A♭ major', count: -4 },
		{ key: 'Eb', label: 'E♭ major', count: -3 },
		{ key: 'Bb', label: 'B♭ major', count: -2 },
		{ key: 'F', label: 'F major', count: -1 },
		{ key: 'C', label: 'C major', count: 0 },
		{ key: 'G', label: 'G major', count: 1 },
		{ key: 'D', label: 'D major', count: 2 },
		{ key: 'A', label: 'A major', count: 3 },
		{ key: 'E', label: 'E major', count: 4 },
		{ key: 'B', label: 'B major', count: 5 },
		{ key: 'F#', label: 'F♯ major', count: 6 },
		{ key: 'C#', label: 'C♯ major', count: 7 }
	] as const;
	const clefs: { value: Clef; label: string }[] = [
		{ value: 'treble', label: 'Treble' },
		{ value: 'bass', label: 'Bass' },
		{ value: 'alto', label: 'Alto' },
		{ value: 'tenor', label: 'Tenor' }
	];
	let clef = $state<Clef>('treble');
	let current = $state<(typeof signatures)[number] | null>(null);
	let answer = $state<string | null>(null);
	let total = $state(0);
	let correct = $state(0);
	const description = $derived(
		current
			? `${clef} clef, key signature with ${current.count === 0 ? 'no sharps or flats' : `${Math.abs(current.count)} ${current.count > 0 ? 'sharps' : 'flats'}`}`
			: 'Loading key signature'
	);

	function next() {
		current = signatures[Math.floor(Math.random() * signatures.length)];
		answer = null;
	}

	function guess(key: string) {
		if (!current || answer !== null) return;
		answer = key;
		total += 1;
		if (key === current.key) correct += 1;
	}

	onMount(next);
</script>

<svelte:head><title>Major key signatures · Vibratone</title></svelte:head>

<main class="exercise">
	<Card elevation="none">
		<div class="clef-controls">
			<SegmentedControl
				id="signature-clef"
				label="Clef"
				labelVisible={false}
				size="sm"
				value={clef}
				disabled={!current}
				onValueChange={(value) => {
					clef = value;
				}}
			>
				{#each clefs as option (option.value)}
					<Segment value={option.value}>{option.label}</Segment>
				{/each}
			</SegmentedControl>
		</div>
		<div class="stimulus">
			{#if current}
				<MusicNotation {clef} keySignature={current.key} ariaLabel={description} />
			{/if}
		</div>
		<div class="answers" role="group" aria-label="Choose the major key">
			{#each signatures as signature (signature.key)}
				<Button
					variant={answer !== null && signature.key === current?.key ? 'primary' : 'secondary'}
					disabled={answer !== null || !current}
					onclick={() => guess(signature.key)}>{signature.label}</Button
				>
			{/each}
		</div>
		<div class="feedback" aria-live="polite" aria-atomic="true">
			{#if answer !== null && current}
				<p>{answer === current.key ? 'Correct!' : 'Not quite.'} This is {current.label}.</p>
			{/if}
		</div>
		{#snippet footer()}
			<div class="footer">
				<span>{correct} of {total} correct</span><Button disabled={answer === null} onclick={next}
					>Next signature</Button
				>
			</div>
		{/snippet}
	</Card>
</main>

<style>
	.exercise {
		max-width: 960px;
		margin: 0 auto;
		padding: 20px;
	}
	.clef-controls {
		display: flex;
		justify-content: center;
	}
	p {
		margin: 4px 0 0;
	}
	.footer {
		color: var(--cinder-text-muted);
	}
	.stimulus {
		max-width: 560px;
		margin: 0 auto 8px;
		display: grid;
		align-items: center;
	}
	.answers {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 8px;
	}
	.feedback {
		display: grid;
		align-items: center;
	}
	.footer {
		width: 100%;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
	}
	@media (max-width: 600px) {
		.answers {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
		.exercise {
			padding: 12px;
		}
		.answers :global(button) {
			padding-inline: 4px;
		}
	}
</style>
