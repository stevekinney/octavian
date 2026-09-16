<script lang="ts">
	import { untrack } from 'svelte';
	import { setPracticeState, type PracticeState } from '$lib/state.svelte';
	import ScoreBar from './score-bar.svelte';

	/** Test-only wrapper that provides a practice-state instance via context. */
	let { state }: { state: PracticeState } = $props();

	setPracticeState(untrack(() => state));
</script>

<ScoreBar />
