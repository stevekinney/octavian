<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import { createPracticeState, setPracticeState } from '$lib/state.svelte';
	import ScoreBar from '$lib/components/score-bar.svelte';
	import PracticeCard from '$lib/components/practice-card.svelte';
	import PianoKeyboard from '$lib/components/piano-keyboard.svelte';
	import SetupCard from '$lib/components/setup-card.svelte';

	type Props = {
		seed: string | null;
	};

	let { seed }: Props = $props();
	const state = setPracticeState(untrack(() => createPracticeState(seed)));

	onDestroy(() => state.destroy());
</script>

<main class="page">
	<div class="practice-column">
		<PracticeCard />
		<PianoKeyboard />
	</div>
	<aside class="setup-rail">
		<SetupCard />
	</aside>
	<div class="score-region">
		<ScoreBar />
	</div>
</main>

<style>
	.page {
		max-width: 1160px;
		margin: 0 auto;
		padding: var(--cinder-space-5);
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--cinder-space-5);
		align-items: start;
	}

	.practice-column {
		display: flex;
		flex-direction: column;
		gap: var(--cinder-space-5);
		min-width: 0;
	}

	.setup-rail,
	.score-region {
		min-width: 0;
		container-type: inline-size;
	}

	@media (min-width: 960px) {
		.page {
			grid-template-columns: minmax(0, 1fr) 360px;
			grid-template-rows: auto auto;
			align-items: stretch;
			padding-block: var(--cinder-space-8);
		}

		.practice-column {
			grid-row: 1 / 3;
			display: grid;
			grid-template-rows: subgrid;
		}

		.setup-rail > :global(div),
		.practice-column :global(.keyboard-wrapper) {
			display: grid;
		}

		.practice-column :global(.keyboard-wrapper) > :global(div) {
			display: grid;
			align-items: center;
		}

		.practice-column :global(.keyboard) {
			width: 100%;
		}

		.setup-rail,
		.score-region {
			grid-column: 2;
			display: grid;
		}
	}

	@media (max-width: 420px) {
		.page {
			padding: var(--cinder-space-3);
			gap: var(--cinder-space-3);
		}

		.practice-column {
			gap: var(--cinder-space-3);
		}
	}
</style>
