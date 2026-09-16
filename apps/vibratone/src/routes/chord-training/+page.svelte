<script lang="ts">
	import ChordName from '$lib/components/chord-name.svelte';
	import { onMount } from 'svelte';
	import Button from '@lostgradient/cinder/button';
	import Card from '@lostgradient/cinder/card';
	import Checkbox from '@lostgradient/cinder/checkbox';
	import CheckboxGroup from '@lostgradient/cinder/checkbox-group';
	import Select from '@lostgradient/cinder/select';
	import Play from 'lucide-svelte/icons/play';
	import { KEYS } from '$lib/music';
	import { ChordAudio } from '$lib/chord-audio';
	import {
		CHORD_QUALITIES,
		CHORD_TYPES,
		type ChordType,
		chordQualityLabel,
		chordRootName,
		diatonicChords,
		fixedChordOptions,
		makeFixedQuestion,
		supportedInversions,
		type ChordInversion,
		type ChordMode,
		type ChordQuestion
	} from '$lib/chord-training';
	import type { ChordQuality } from 'octavian';

	const modeOptions = [
		{ value: 'fixed', label: 'Fixed root' },
		{ value: 'diatonic', label: 'Diatonic chords' }
	];
	const rootOptions = Array.from({ length: 12 }, (_, pc) => ({
		value: String(pc),
		label: chordRootName(pc)
	}));
	const octaveOptions = [3, 4, 5].map((octave) => ({
		value: String(octave),
		label: `Octave ${octave}`
	}));
	let mode = $state<ChordMode>('fixed');
	let rootPitchClass = $state(0);
	let keyId = $state('C');
	let octave = $state(4);
	let inversion = $state<ChordInversion>(0);
	let includeSevenths = $state(false);
	let chordTypes = $state<ChordType[]>(['basic']);
	let qualities = $state<string[]>(['major', 'minor']);
	let current = $state<ChordQuestion | null>(null);
	let answer = $state<string | null>(null);
	let total = $state(0);
	let correct = $state(0);
	let mounted = $state(false);
	let played = $state(false);
	let audioMessage = $state('');
	let playbackGeneration = 0;
	const audio = new ChordAudio();
	const keyOptions = $derived(
		KEYS.filter((key) => key.tonicPc !== null).map((key) => ({ value: key.id, label: key.label }))
	);
	const fixedOptions = $derived(fixedChordOptions(qualities as ChordQuality[], chordTypes));
	const diatonicOptions = $derived(diatonicChords(keyId, octave, includeSevenths, inversion));
	const answerOptions = $derived.by(() => {
		const options =
			mode === 'fixed'
				? fixedOptions.map((chord) => ({ value: chord.id, label: chord.label }))
				: diatonicOptions.map((chord) => ({ value: chord.answer, label: chord.label }));
		return mode === 'fixed'
			? [...new Map(options.map((option) => [option.value, option])).values()]
			: options;
	});
	const inversionOptions = $derived(
		supportedInversions(
			mode === 'fixed'
				? Math.max(...fixedOptions.map((chord) => chord.size), 3)
				: includeSevenths
					? 4
					: 3
		)
	);
	const questionLabel = $derived(
		!current && mode === 'fixed' && fixedOptions.length === 0
			? 'Choose chord types and qualities that overlap'
			: current
				? mode === 'fixed'
					? `Listen to the ${current.root} chord`
					: 'Listen to the chord'
				: 'Loading chord'
	);

	function next() {
		playbackGeneration += 1;
		audio.stop();
		answer = null;
		played = false;
		audioMessage = '';
		if (mode === 'fixed') {
			const options = fixedOptions;
			if (options.length === 0) {
				current = null;
				return;
			}
			const definition = options[Math.floor(Math.random() * options.length)];
			current = makeFixedQuestion(rootPitchClass, definition.id, octave, inversion);
		} else {
			const options = diatonicOptions;
			current = options.length ? options[Math.floor(Math.random() * options.length)] : null;
		}
	}

	function changeSetting(callback: () => void) {
		callback();
		next();
	}

	async function play() {
		if (!current) return;
		const generation = ++playbackGeneration;
		const question = current;
		try {
			const started = await audio.play(question.chord.notes.map((note) => Number(note.frequency)));
			if (generation !== playbackGeneration || current !== question) return;
			played = started;
			audioMessage = played ? '' : 'Audio is unavailable in this browser.';
		} catch {
			if (generation !== playbackGeneration || current !== question) return;
			played = false;
			audioMessage = 'Audio could not be started.';
		}
	}

	function guess(value: string) {
		if (!current || answer !== null || !played) return;
		answer = value;
		total += 1;
		if (value === current.answer) correct += 1;
	}

	function toggleQuality(quality: string, checked: boolean) {
		qualities = checked ? [...qualities, quality] : qualities.filter((item) => item !== quality);
		next();
	}

	onMount(() => {
		mounted = true;
		next();
		return () => {
			playbackGeneration += 1;
			audio.dispose();
		};
	});
</script>

<svelte:head><title>Chord training · Vibratone</title></svelte:head>

<main class="exercise">
	<Card elevation="none">
		<div class="practice">
			<div class="stimulus" aria-live="polite">
				<p>{questionLabel}</p>
				{#if current}<Button
						variant="primary"
						class="chord-play"
						aria-label="Play chord"
						onclick={play}><Play size={28} fill="currentColor" aria-hidden="true" /></Button
					>
					<span class="play-caption">{played ? 'Play again' : 'Play chord'}</span>{/if}
				{#if audioMessage}<p role="status">{audioMessage}</p>{/if}
			</div>
			<div
				class="answers"
				style:--answer-columns={Math.max(1, Math.min(4, answerOptions.length))}
				role="group"
				aria-label="Choose the chord"
			>
				{#each answerOptions as option (option.value)}
					<Button
						disabled={!current || !played || answer !== null}
						variant={answer === option.value ? 'primary' : 'secondary'}
						onclick={() => guess(option.value)}
						><ChordName
							name={option.label}
							suffixOnly={mode === 'fixed' && option.label !== 'Major triad'}
						/></Button
					>
				{/each}
			</div>
			<div class="feedback" aria-live="polite" aria-atomic="true">
				{#if answer !== null && current}<p>
						{answer === current.answer ? 'Correct!' : 'Not quite.'} The answer is <ChordName
							name={current.label}
						/>.
					</p>{/if}
			</div>
		</div>
		{#snippet footer()}<div class="footer">
				<span>{correct} of {total} correct</span><Button disabled={answer === null} onclick={next}
					>Next chord</Button
				>
			</div>{/snippet}
	</Card>

	<Card elevation="none">
		<div class="settings">
			<div class="controls">
				<Select
					id="chord-mode"
					label="Mode"
					options={modeOptions}
					value={mode}
					disabled={!mounted}
					onchange={(event) => changeSetting(() => (mode = event.currentTarget.value as ChordMode))}
				/>
				{#if mode === 'fixed'}
					<Select
						id="chord-root"
						label="Root"
						options={rootOptions}
						value={String(rootPitchClass)}
						disabled={!mounted}
						onchange={(event) =>
							changeSetting(() => (rootPitchClass = Number(event.currentTarget.value)))}
					/>
				{:else}
					<Select
						id="chord-key"
						label="Key"
						options={keyOptions}
						value={keyId}
						disabled={!mounted}
						onchange={(event) => changeSetting(() => (keyId = event.currentTarget.value))}
					/>
				{/if}
				<Select
					id="chord-octave"
					label="Octave"
					options={octaveOptions}
					value={String(octave)}
					disabled={!mounted}
					onchange={(event) => changeSetting(() => (octave = Number(event.currentTarget.value)))}
				/>
				<Select
					id="chord-inversion"
					label="Inversion"
					options={inversionOptions.map((option) => ({
						value: String(option.value),
						label: option.label
					}))}
					value={String(inversion)}
					disabled={!mounted}
					onchange={(event) =>
						changeSetting(() => (inversion = Number(event.currentTarget.value) as ChordInversion))}
				/>
			</div>
			{#if mode === 'fixed'}
				<CheckboxGroup id="chord-types" label="Chord types">
					<div class="quality-options">
						{#each CHORD_TYPES as type (type.value)}
							<Checkbox
								label={type.label}
								checked={chordTypes.includes(type.value)}
								disabled={!mounted}
								onValueChange={(checked) =>
									changeSetting(() => {
										chordTypes = checked
											? [...chordTypes, type.value]
											: chordTypes.filter((value) => value !== type.value);
									})}
							/>
						{/each}
					</div>
				</CheckboxGroup>
				<CheckboxGroup id="chord-qualities" label="Chord qualities">
					<div class="quality-options">
						{#each CHORD_QUALITIES as quality (quality)}
							<Checkbox
								id={`quality-${quality}`}
								label={chordQualityLabel(quality)}
								checked={qualities.includes(quality)}
								disabled={!mounted}
								onValueChange={(checked) => toggleQuality(quality, checked)}
							/>
						{/each}
					</div>
				</CheckboxGroup>
			{:else}
				<Checkbox
					id="include-sevenths"
					label="Include seventh chords"
					checked={includeSevenths}
					disabled={!mounted}
					onValueChange={(checked) => changeSetting(() => (includeSevenths = checked))}
				/>
			{/if}
		</div>
	</Card>
</main>

<style>
	.exercise {
		max-width: 960px;
		margin: 0 auto;
		padding: 20px;
		display: grid;
		gap: 20px;
	}
	.settings {
		display: grid;
		gap: 24px;
	}
	.practice {
		display: grid;
		gap: 20px;
	}
	.controls {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 12px;
	}
	.quality-options {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 8px;
	}
	.stimulus {
		display: grid;
		justify-items: center;
		gap: 12px;
		padding: 20px 0 12px;
		align-content: center;
	}
	.stimulus :global(.chord-play) {
		width: 76px;
		height: 76px;
		border-radius: 50%;
		padding: 0;
	}
	.play-caption {
		font-size: 0.875rem;
		color: var(--cinder-text-muted);
	}
	.stimulus p {
		margin: 0;
		color: var(--cinder-text-muted);
	}
	.answers {
		display: grid;
		grid-template-columns: repeat(var(--answer-columns), minmax(0, 1fr));
		gap: 8px;
	}
	.feedback:empty {
		display: none;
	}
	.answers :global(.cinder-button) {
		min-height: 42px;
	}
	.feedback {
		display: grid;
		align-items: center;
	}
	.feedback p {
		margin: 8px 0 0;
	}
	.footer {
		width: 100%;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		color: var(--cinder-text-muted);
	}
	@media (max-width: 700px) {
		.exercise {
			padding: 12px;
			gap: 12px;
		}
		.controls,
		.quality-options {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.answers {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
</style>
