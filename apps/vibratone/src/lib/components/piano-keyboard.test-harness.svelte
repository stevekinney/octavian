<script lang="ts">
	import { untrack } from 'svelte';
	import { setPracticeState, type PracticeState } from '$lib/state.svelte';
	import PianoKeyboard from './piano-keyboard.svelte';

	/** Test-only wrapper that provides a practice-state instance via context. */
	let { state }: { state: PracticeState } = $props();

	// The instance is created once in the test and never reassigned, so reading
	// its initial value to seed context is exactly what we want.
	setPracticeState(untrack(() => state));
</script>

<PianoKeyboard />
