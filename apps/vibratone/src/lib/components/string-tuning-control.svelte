<script lang="ts">
	import Button from '@lostgradient/cinder/button';
	import Popover from '@lostgradient/cinder/popover';
	import Select from '@lostgradient/cinder/select';
	import { noteLabel } from '$lib/music';

	interface Props {
		midi: number;
		stringNumber: number;
		onchange: (midi: number) => void;
	}

	let { midi, stringNumber, onchange }: Props = $props();
	let open = $state(false);
	const generatedId = $props.id();
	const noteOptions = Array.from({ length: 12 }, (_, pc) => ({
		value: String(pc),
		label: noteLabel(pc, 'sharp')
	}));
	const octaveOptions = Array.from({ length: 10 }, (_, index) => index - 1);
	const pitchClass = $derived(((midi % 12) + 12) % 12);
	const octave = $derived(Math.floor(midi / 12) - 1);
	function octavesFor(nextPitchClass: number) {
		return octaveOptions.filter(
			(candidate) =>
				candidate * 12 + 12 + nextPitchClass >= 0 && candidate * 12 + 12 + nextPitchClass <= 103
		);
	}
	const validOctaves = $derived(octavesFor(pitchClass));

	function setPitch(nextPitchClass: number, nextOctave: number) {
		const nextMidi = (nextOctave + 1) * 12 + nextPitchClass;
		if (nextMidi >= 0 && nextMidi <= 103) onchange(nextMidi);
	}

	function setPitchClass(value: string) {
		const nextPitchClass = Number(value);
		const nextValidOctaves = octavesFor(nextPitchClass);
		const nextOctave = nextValidOctaves.includes(octave)
			? octave
			: nextValidOctaves.reduce((closest, candidate) =>
					Math.abs(candidate - octave) < Math.abs(closest - octave) ? candidate : closest
				);
		setPitch(nextPitchClass, nextOctave);
	}
</script>

<Popover bind:open placement="bottom-start" label={`Tune string ${stringNumber}`}>
	{#snippet trigger()}
		<Button
			variant="ghost"
			size="xs"
			class="tuning-label"
			aria-label={`Tune string ${stringNumber}`}
			onclick={() => (open = !open)}
		>
			{noteLabel(pitchClass, 'sharp')}{octave}
		</Button>
	{/snippet}
	<div class="tuning-panel" data-tuning-control>
		<Select
			id={`${generatedId}-note`}
			label="Note"
			labelVisible={false}
			options={noteOptions}
			value={String(pitchClass)}
			onchange={(event) => setPitchClass(event.currentTarget.value)}
		/>
		<Select
			id={`${generatedId}-octave`}
			label="Octave"
			labelVisible={false}
			options={validOctaves.map((value) => ({ value: String(value), label: String(value) }))}
			value={String(octave)}
			onchange={(event) => setPitch(pitchClass, Number(event.currentTarget.value))}
		/>
	</div>
</Popover>

<style>
	:global(.tuning-label) {
		min-width: 0;
		padding: 0 var(--cinder-space-1);
		font-size: var(--cinder-text-xs);
		font-variant-numeric: tabular-nums;
	}

	.tuning-panel {
		display: grid;
		grid-template-columns: minmax(90px, 1fr) minmax(72px, 0.7fr);
		gap: var(--cinder-space-2);
		padding: var(--cinder-space-3);
		min-width: 220px;
	}
</style>
