<script lang="ts">
	import { onMount } from 'svelte';
	import Button from '@lostgradient/cinder/button';
	import Card from '@lostgradient/cinder/card';
	import Checkbox from '@lostgradient/cinder/checkbox';
	import CheckboxGroup from '@lostgradient/cinder/checkbox-group';
	import Select from '@lostgradient/cinder/select';
	import Slider from '@lostgradient/cinder/slider';
	import FormField from '@lostgradient/cinder/form-field';
	import SegmentedControl, { Segment } from '@lostgradient/cinder/segmented-control';
	import TuningSettings from '$lib/components/tuning-settings.svelte';
	import Fretboard from '$lib/components/fretboard.svelte';
	import MusicNotation from '$lib/components/music-notation.svelte';
	import NoteScope from '$lib/components/note-scope.svelte';
	import { keyById, noteLabel, bothSpellings, scalePitchClassSet } from '$lib/music';
	import {
		eligiblePositions,
		pickPosition,
		notationKey,
		type FretCount,
		type FretPosition
	} from '$lib/fretboard';
	import type { KeySignature } from '$lib/notation';

	type Mode = 'name' | 'text' | 'notation';
	const modes: { value: Mode; label: string }[] = [
		{ value: 'name', label: 'Name the note' },
		{ value: 'text', label: 'Find the written note' },
		{ value: 'notation', label: 'Find the notated note' }
	];
	const pitchClasses = Array.from({ length: 12 }, (_, index) => index);
	let mode = $state<Mode>('name');
	let mounted = $state(false);
	let keyId = $state('chromatic');
	let eligible = $state<number[]>([...pitchClasses]);
	let tuning = $state<readonly number[]>([40, 45, 50, 55, 59, 64]);
	let fretCount = $state<FretCount>(22);
	let selectedStrings = $state<number[]>([0, 1, 2, 3, 4, 5]);
	let octaveRange = $state<[number, number] | null>(null);
	let fretRange = $state<[number, number] | null>(null);
	let scopeMessage = $state('');
	let current = $state<FretPosition | null>(null);
	let selected = $state<FretPosition | undefined>();
	let answered = $state(false);
	let wasCorrect = $state(false);
	let total = $state(0);
	let correct = $state(0);
	const key = $derived(keyById(keyId));
	const minimumOctave = $derived(Math.floor(Math.min(...tuning) / 12) - 1);
	const maximumOctave = $derived(Math.floor((Math.max(...tuning) + fretCount) / 12) - 1);
	const octaves = $derived<[number, number]>([
		Math.max(minimumOctave, Math.min(maximumOctave, octaveRange?.[0] ?? minimumOctave)),
		Math.max(minimumOctave, Math.min(maximumOctave, octaveRange?.[1] ?? maximumOctave))
	]);
	const frets = $derived<[number, number]>([
		Math.min(fretCount, fretRange?.[0] ?? 0),
		Math.min(fretCount, fretRange?.[1] ?? fretCount)
	]);
	const strings = $derived(
		tuning
			.map((midi, index) => ({
				index,
				number: tuning.length - index,
				note: `${noteLabel(midi % 12, 'sharp')}${Math.floor(midi / 12) - 1}`
			}))
			.reverse()
	);
	const positions = $derived(
		eligiblePositions(tuning, fretCount, eligible, {
			octaveLo: octaves[0],
			octaveHi: octaves[1],
			fretLo: frets[0],
			fretHi: frets[1],
			stringIndices: selectedStrings
		})
	);
	const scopeHint = $derived(
		[
			octaves[0] === minimumOctave && octaves[1] === maximumOctave
				? 'Any octave'
				: octaves[0] === octaves[1]
					? `Octave ${octaves[0]}`
					: `Octaves ${octaves[0]}–${octaves[1]}`,
			selectedStrings.length === tuning.length
				? ''
				: `${selectedStrings.length === 1 ? 'String' : 'Strings'} ${strings
						.filter((string) => selectedStrings.includes(string.index))
						.map((string) => string.number)
						.join(', ')}`,
			frets[0] === 0 && frets[1] === fretCount ? '' : `Frets ${frets[0]}–${frets[1]}`
		]
			.filter(Boolean)
			.join(' · ')
	);
	const targetLabel = $derived(current ? label(current.midi % 12) : '');
	const signature = $derived(key.signature as KeySignature);

	function label(pitchClass: number) {
		const [sharp, flat] = bothSpellings(pitchClass);
		return key.spelling === 'both' && sharp !== flat
			? `${sharp} / ${flat}`
			: noteLabel(pitchClass, key.spelling);
	}
	function next() {
		current = pickPosition(positions);
		selected = undefined;
		answered = false;
		scopeMessage = '';
	}
	function setKey(id: string) {
		keyId = id;
		eligible = [...scalePitchClassSet(keyById(id))];
		next();
	}
	function toggleNote(pitchClass: number) {
		eligible = eligible.includes(pitchClass)
			? eligible.filter((note) => note !== pitchClass)
			: [...eligible, pitchClass];
		next();
	}
	function guess(pitchClass: number, position?: FretPosition) {
		if (!current || answered) return;
		if (
			position &&
			!positions.some(
				(candidate) =>
					candidate.stringIndex === position.stringIndex && candidate.fret === position.fret
			)
		) {
			scopeMessage = 'Choose a position within the selected range.';
			return;
		}
		scopeMessage = '';
		selected = position;
		wasCorrect = pitchClass === current.midi % 12;
		answered = true;
		total += 1;
		if (wasCorrect) correct += 1;
	}
	function changeTuning(notes: readonly number[]) {
		const allSelected = selectedStrings.length === tuning.length;
		tuning = [...notes];
		selectedStrings = allSelected
			? notes.map((_, index) => index)
			: selectedStrings.filter((index) => index < notes.length);
		next();
	}
	function toggleString(stringIndex: number) {
		selectedStrings = selectedStrings.includes(stringIndex)
			? selectedStrings.filter((index) => index !== stringIndex)
			: [...selectedStrings, stringIndex];
		next();
	}
	onMount(() => {
		mounted = true;
		next();
	});
</script>

<svelte:head><title>Fretboard practice · Vibratone</title></svelte:head>

<main class="exercise">
	<header>
		<Select
			disabled={!mounted}
			id="fretboard-mode"
			label="Exercise"
			options={modes}
			value={mode}
			onchange={(event) => {
				mode = event.currentTarget.value as Mode;
				next();
			}}
		/>
	</header>
	<Card elevation="none">
		<Fretboard
			{tuning}
			{fretCount}
			ontuningchange={changeTuning}
			highlighted={mode === 'name'
				? (current ?? undefined)
				: answered
					? wasCorrect
						? selected
						: (current ?? undefined)
					: undefined}
			{selected}
			disabled={mode === 'name' || answered || !current}
			onselect={(position) => guess(position.midi % 12, position)}
		/>
		{#if mounted && !current}
			<div class="empty-selection" role="status">
				<p>
					{eligible.length
						? selectedStrings.length
							? 'No notes match these settings.'
							: 'Select at least one string to begin.'
						: 'Select at least one eligible note to begin.'}
				</p>
			</div>
		{:else if current && mode === 'text'}
			<div class="prompt">
				<h2><span class="target-note">{targetLabel}</span></h2>
				<p>{scopeHint}</p>
			</div>
		{:else if current && mode === 'notation'}
			<div class="prompt">
				<p>{scopeHint}</p>
				<div class="notation">
					<MusicNotation
						clef="treble"
						keySignature={signature}
						notes={[{ keys: [notationKey(current.midi, key.signature)], duration: 'q' }]}
					/>
				</div>
			</div>
		{/if}
		{#if current && mode === 'name'}
			<div class="answers" role="group" aria-label="Name the highlighted note">
				{#each pitchClasses.filter( (pitchClass) => eligible.includes(pitchClass) ) as pitchClass (pitchClass)}
					<Button disabled={answered || !current} onclick={() => guess(pitchClass)}
						>{label(pitchClass)}</Button
					>
				{/each}
			</div>
		{/if}
		<div class="feedback" aria-live="polite" aria-atomic="true">
			{#if scopeMessage}<p>{scopeMessage}</p>{/if}
			{#if answered}<p>
					{wasCorrect ? 'Correct!' : 'Not quite.'} The note is {targetLabel}.{selected &&
					!wasCorrect
						? ` You selected ${label(selected.midi % 12)}.`
						: ''}
				</p>{/if}
		</div>
		{#snippet footer()}<div class="footer">
				<span>{correct} of {total} correct</span><Button disabled={!answered} onclick={next}
					>Next note</Button
				>
			</div>{/snippet}
	</Card>
	<Card elevation="none">
		<div class="settings">
			<NoteScope
				idPrefix="fretboard-key"
				{keyId}
				eligibleNotes={eligible}
				onKeyChange={setKey}
				onToggleNote={toggleNote}
				onResetNotes={() => setKey(keyId)}
			/>
			<TuningSettings {tuning} onTuningChange={changeTuning} />
			<FormField id="fretboard-frets" label="Fret count">
				<SegmentedControl
					disabled={!mounted}
					id="fretboard-frets"
					label="Fret count"
					labelVisible={false}
					value={String(fretCount)}
					onValueChange={(value) => {
						fretCount = Number(value) as FretCount;
						next();
					}}
				>
					{#each [21, 22, 24] as count (count)}
						<Segment value={String(count)}>{count}</Segment>
					{/each}
				</SegmentedControl>
			</FormField>
			<CheckboxGroup aria-label="Strings" label="Strings" disabled={!mounted}>
				<div class="string-options">
					{#each strings as string (string.index)}
						<Checkbox
							checked={selectedStrings.includes(string.index)}
							label={`${string.number} · ${string.note}`}
							aria-label={`String ${string.number} · ${string.note}`}
							onValueChange={() => toggleString(string.index)}
						/>
					{/each}
				</div>
			</CheckboxGroup>
			<FormField
				id="fretboard-octaves"
				class="range-field"
				label="Octave range"
				description={`${octaves[0]}–${octaves[1]}`}
			>
				<Slider
					disabled={!mounted}
					label="Octave range"
					mode="range"
					min={minimumOctave}
					max={maximumOctave}
					step={1}
					ticks
					value={octaves}
					onValueChange={(value) => {
						octaveRange = value;
						next();
					}}
				/>
			</FormField>
			<div class="fret-range">
				<FormField
					id="fretboard-practice-frets"
					class="range-field"
					label="Practice frets"
					description={`${frets[0]}–${frets[1]}`}
				>
					<Slider
						disabled={!mounted}
						label="Practice frets"
						mode="range"
						min={0}
						max={fretCount}
						step={1}
						value={frets}
						onValueChange={(value) => {
							fretRange = value;
							next();
						}}
					/>
				</FormField>
			</div>
		</div>
	</Card>
</main>

<style>
	.exercise {
		max-width: 1200px;
		margin: 0 auto;
		padding: 20px;
		display: grid;
		gap: 20px;
	}
	header {
		display: grid;
		grid-template-columns: minmax(0, 340px);
		align-items: end;
		justify-content: space-between;
		gap: 20px;
	}
	h2 {
		font-size: 1.125rem;
		margin: 0;
		font-weight: 500;
	}
	p {
		margin: 4px 0;
	}
	.empty-selection {
		margin-top: 12px;
		font-size: var(--cinder-text-sm);
		color: var(--cinder-text-muted);
	}
	.prompt {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 12px;
		padding-top: 12px;
		flex-wrap: wrap;
	}
	.prompt p,
	.footer {
		color: var(--cinder-text-muted);
	}
	.target-note {
		font-weight: 700;
	}
	.notation {
		width: min(100%, 320px);
		margin: 0;
	}
	.answers {
		display: grid;
		grid-template-columns: repeat(6, minmax(0, 1fr));
		gap: 8px;
		margin-top: 16px;
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
	.settings :global(.range-field) {
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: baseline;
	}
	.settings :global(.range-field > .cinder-form-field__description) {
		grid-column: 2;
		grid-row: 1;
		line-height: 1;
	}
	.settings :global(.range-field > .cinder-slider) {
		grid-column: 1 / -1;
	}
	.settings :global(.range-field .cinder-slider__header) {
		display: none;
	}
	.string-options {
		min-width: 0;
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 6px;
	}
	.settings {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		align-items: start;
		--note-scope-columns: repeat(2, minmax(0, 1fr));
		gap: 20px;
	}
	.fret-range,
	.settings :global(.scope) {
		grid-column: 1/-1;
	}
	@media (max-width: 600px) {
		.exercise {
			padding: 12px;
			gap: 12px;
		}
		header {
			grid-template-columns: minmax(0, 1fr);
			flex-direction: column;
			align-items: stretch;
			gap: 12px;
		}
		.answers {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
		.settings {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
