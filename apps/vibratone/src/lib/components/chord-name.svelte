<script lang="ts">
	interface Props {
		name: string;
		suffixOnly?: boolean;
	}
	let { name, suffixOnly = false }: Props = $props();
	const parts = $derived.by(() => {
		const match = suffixOnly ? null : /^(\d+\.\s*)?([A-G][#b♯♭]*)(.*)$/.exec(name);
		if (!suffixOnly && !match) return null;
		const suffix = suffixOnly ? name : match![3];
		const bass = /\/([A-G][#b♯♭]*)$/.exec(suffix);
		const quality = bass ? suffix.slice(0, bass.index) : suffix;
		const minor = /^m(?!aj)/.test(quality);
		return {
			prefix: match?.[1] ?? '',
			root: accidentals(match?.[2] ?? ''),
			minor,
			extension: accidentals(
				(minor ? quality.slice(1) : quality).replace(/^dim/, '°').replace(/^aug/, '+')
			),
			bass: bass ? accidentals(bass[1]) : ''
		};
	});
	function accidentals(value: string) {
		return value.replaceAll('#', '♯').replaceAll('b', '♭');
	}
</script>

<span class="chord-name" aria-label={name}>
	{#if parts}
		<span aria-hidden="true"
			>{parts.prefix}<span class="root">{parts.root}</span>{#if parts.minor}<span class="minor"
					>m</span
				>{/if}{#if parts.extension}<sup>{parts.extension}</sup>{/if}{#if parts.bass}<span
					class="bass">/{parts.bass}</span
				>{/if}</span
		>
	{:else}{name}{/if}
</span>

<style>
	.chord-name {
		display: inline-block;
		white-space: nowrap;
	}
	.root {
		font-weight: 600;
	}
	.minor {
		font-size: 0.8em;
	}
	sup {
		font-size: 0.7em;
		line-height: 0;
		vertical-align: super;
		margin-inline-start: 0.04em;
		font-weight: 500;
	}
	.bass {
		font-size: 0.8em;
	}
</style>
