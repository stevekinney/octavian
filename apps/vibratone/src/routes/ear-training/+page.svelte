<script lang="ts">
	import PracticeSession from '$lib/components/practice-session.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

{#key data.seed}
	<PracticeSession seed={data.seed} />
{/key}
