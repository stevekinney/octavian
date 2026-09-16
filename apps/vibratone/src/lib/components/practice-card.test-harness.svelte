<script lang="ts">
	import { untrack } from 'svelte';
	import { setPracticeState, type PracticeState } from '$lib/state.svelte';
	import PracticeCard from './practice-card.svelte';

	let { state }: { state: PracticeState } = $props();

	setPracticeState(untrack(() => state));
</script>

<PracticeCard />
