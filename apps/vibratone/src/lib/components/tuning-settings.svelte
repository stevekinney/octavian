<script lang="ts">
	import { onMount } from 'svelte';
	import Button from '@lostgradient/cinder/button';
	import Input from '@lostgradient/cinder/input';
	import Select from '@lostgradient/cinder/select';
	import {
		createSavedTuning,
		loadSavedTunings,
		readSavedTunings,
		removeSavedTuning,
		updateSavedTuning,
		type SavedTuning
	} from '$lib/tuning-storage';
	import { parseTuning, TUNINGS } from '$lib/fretboard';
	import { formatPitch } from '$lib/music';

	interface Props {
		tuning: readonly number[];
		onTuningChange: (notes: readonly number[]) => void;
	}

	let { tuning, onTuningChange }: Props = $props();
	let savedTunings = $state<SavedTuning[]>([]);
	let selectedId = $state<string>();
	let customText = $derived(
		tuning
			.map((midi) => formatPitch({ pc: midi % 12, octave: Math.floor(midi / 12) - 1 }, 'sharp'))
			.join(' ')
	);
	let customError = $state('');
	let savedName = $state('');
	let savedError = $state('');
	let storageWarning = $state('');

	const builtinOptions = TUNINGS.map((preset) => ({ value: preset.id, label: preset.label }));
	const options = $derived([
		...builtinOptions,
		{ value: 'custom', label: 'Custom tuning' },
		...savedTunings.map((preset) => ({ value: preset.id, label: `Saved: ${preset.name}` }))
	]);
	const selection = $derived.by(() => {
		const id =
			selectedId ?? TUNINGS.find((preset) => sameNotes(preset.notes, tuning))?.id ?? 'custom';
		const builtin = TUNINGS.find((preset) => preset.id === id);
		return builtin && !sameNotes(builtin.notes, tuning) ? 'custom' : id;
	});
	const selectedSaved = $derived(savedTunings.find((preset) => preset.id === selection));

	onMount(() => {
		const result = readSavedTunings();
		if (result.ok) savedTunings = [...result.value];
		else storageWarning = result.error;
	});

	function sameNotes(a: readonly number[], b: readonly number[]) {
		return a.length === b.length && a.every((note, index) => note === b[index]);
	}

	function changeSelection(value: string) {
		selectedId = value;
		customError = '';
		savedError = '';
		savedName = '';
		const preset =
			TUNINGS.find((item) => item.id === value) ?? savedTunings.find((item) => item.id === value);
		if (preset) {
			if ('name' in preset) savedName = preset.name;
			onTuningChange([...preset.notes]);
		}
	}

	function applyCustom() {
		const parsed = parseTuning(customText);
		if (!parsed) {
			customError =
				'Enter 2–8 notes with octaves, low string to high string (for example E2 A2 D3 G3 B3 E4).';
			return;
		}
		customError = '';
		selectedId = selectedSaved ? selection : 'custom';
		onTuningChange([...parsed]);
	}

	function saveNew() {
		const parsed = parseTuning(customText);
		if (!parsed) {
			customError = 'Enter 2–8 notes with octaves before saving.';
			return;
		}
		const result = createSavedTuning(savedName, parsed);
		if (!result.ok) {
			savedError = result.error;
			return;
		}
		onTuningChange([...result.value.notes]);
		savedTunings = [...loadSavedTunings()];
		selectedId = result.value.id;
		savedName = result.value.name;
		savedError = '';
	}

	function updateSelected() {
		if (!selectedSaved) return;
		const parsed = parseTuning(customText);
		if (!parsed) {
			customError = 'Enter 2–8 notes before updating.';
			return;
		}
		const result = updateSavedTuning(selectedSaved.id, savedName || selectedSaved.name, parsed);
		if (!result.ok) {
			savedError = result.error;
			return;
		}
		savedTunings = [...loadSavedTunings()];
		onTuningChange([...result.value.notes]);
		savedName = result.value.name;
		savedError = '';
	}

	function removeSelected() {
		if (!selectedSaved) return;
		const result = removeSavedTuning(selectedSaved.id);
		if (!result.ok) {
			savedError = result.error;
			return;
		}
		savedTunings = [...result.value];
		selectedId = 'custom';
		savedError = '';
	}
</script>

<div class="tuning-settings">
	<Select
		id="fretboard-tuning"
		label="Tuning"
		{options}
		value={selection}
		onchange={(event) => changeSelection(event.currentTarget.value)}
	/>
	{#if selection === 'custom' || selectedSaved}
		<form
			class="custom-tuning"
			onsubmit={(event) => {
				event.preventDefault();
				applyCustom();
			}}
		>
			<Input
				id="custom-tuning"
				label="Open strings, low to high"
				bind:value={customText}
				error={customError}
			/>
			<Button type="submit">Apply tuning</Button>
		</form>
		<div class="saved-tuning">
			<Input
				id="saved-tuning-name"
				label={selectedSaved ? 'Saved tuning name' : 'Save tuning as'}
				bind:value={savedName}
				error={savedError}
			/>
			<div class="actions">
				<Button type="button" onclick={saveNew}>Save as new</Button>
				{#if selectedSaved}
					<Button type="button" onclick={updateSelected}>Update</Button>
					<Button type="button" variant="secondary" onclick={removeSelected}>Remove</Button>
				{/if}
			</div>
		</div>
	{/if}
	{#if storageWarning}<p class="warning" aria-live="polite">{storageWarning}</p>{/if}
</div>

<style>
	.tuning-settings,
	.custom-tuning,
	.saved-tuning,
	.actions {
		display: grid;
		gap: var(--cinder-space-2);
	}
	.custom-tuning,
	.saved-tuning {
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: end;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
	}
	.tuning-settings {
		container-type: inline-size;
	}
	.warning {
		color: var(--cinder-text-muted);
		margin: 0;
	}
	@container (max-width: 520px) {
		.custom-tuning,
		.saved-tuning {
			grid-template-columns: 1fr;
		}
	}
</style>
