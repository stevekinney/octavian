<script lang="ts">
	import { onMount } from 'svelte';
	let mounted = $state(false);
	onMount(() => {
		mounted = true;
	});
	import Button from '@lostgradient/cinder/button';
	import Checkbox from '@lostgradient/cinder/checkbox';
	import CheckboxGroup from '@lostgradient/cinder/checkbox-group';
	import Select from '@lostgradient/cinder/select';
	import {
		MODES,
		ROOT_KEYS,
		bothSpellings,
		isBlackPitchClass,
		keyById,
		noteLabel,
		scalePitchClassSet
	} from '$lib/music';

	interface Props {
		keyId: string;
		eligibleNotes: Iterable<number>;
		onKeyChange: (keyId: string) => void;
		onToggleNote: (pitchClass: number) => void;
		onResetNotes: () => void;
		idPrefix?: string;
	}

	const generatedId = $props.id();

	let {
		keyId,
		eligibleNotes,
		onKeyChange,
		onToggleNote,
		onResetNotes,
		idPrefix = generatedId
	}: Props = $props();

	const keyOptions = ROOT_KEYS.map((key) => ({ value: key.id, label: key.label }));
	const modeOptions = MODES;
	const pitchClasses = Array.from({ length: 12 }, (_, pitchClass) => pitchClass);
	const key = $derived(keyById(keyId));
	const rootKey = $derived(keyById(keyId.split(':')[0]));
	const mode = $derived(key.mode);
	const eligibleSet = $derived(new Set(eligibleNotes));
	const isChromatic = $derived(key.tonicPc === null);
	const keyNotes = $derived(scalePitchClassSet(key));
	const matchesKey = $derived(
		eligibleSet.size === keyNotes.size && [...keyNotes].every((note) => eligibleSet.has(note))
	);
</script>

<div class="scope">
	<div class="fields">
		<div class="field">
			<Select
				disabled={!mounted}
				id={idPrefix}
				label="Key"
				options={keyOptions}
				value={rootKey.id}
				onchange={(event) =>
					onKeyChange(
						mode === 'major' || event.currentTarget.value === 'chromatic'
							? event.currentTarget.value
							: `${event.currentTarget.value}:${mode}`
					)}
			/>
		</div>
		<div class="field">
			<Select
				disabled={!mounted || rootKey.tonicPc === null}
				id={`${idPrefix}-mode`}
				label="Mode"
				options={modeOptions}
				value={mode}
				onchange={(event) =>
					onKeyChange(
						event.currentTarget.value === 'major'
							? rootKey.id
							: `${rootKey.id}:${event.currentTarget.value}`
					)}
			/>
		</div>

		<div class="field notes-field">
			<Button
				variant="secondary"
				size="sm"
				class={matchesKey ? 'match-key concealed' : 'match-key'}
				aria-label={`Reset notes to ${key.label}`}
				onclick={onResetNotes}>Reset</Button
			>
			<CheckboxGroup id={`${idPrefix}-eligible`} label="Eligible notes" disabled={!mounted}>
				<div class="note-options">
					{#each pitchClasses as pitchClass (pitchClass)}
						{@const [sharp, flat] = bothSpellings(pitchClass)}
						{@const enharmonic = isChromatic && isBlackPitchClass(pitchClass)}
						<div class:tonic={key.tonicPc === pitchClass}>
							<Checkbox
								label={enharmonic ? `${sharp}/${flat}` : noteLabel(pitchClass, key.spelling)}
								aria-label={enharmonic ? `${sharp} or ${flat}` : undefined}
								checked={eligibleSet.has(pitchClass)}
								onValueChange={() => onToggleNote(pitchClass)}
							/>
						</div>
					{/each}
				</div>
			</CheckboxGroup>
			{#if eligibleSet.size === 0}<p class="empty-scope">No eligible notes selected.</p>{/if}
		</div>
	</div>
</div>

<style>
	.scope {
		container-type: inline-size;
	}

	.fields {
		display: flex;
		flex-direction: column;
		gap: var(--cinder-space-5);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: var(--cinder-space-1-5);
	}

	.notes-field {
		position: relative;
	}
	.note-options {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--cinder-space-3) var(--cinder-space-2);
		padding-top: var(--cinder-space-2);
	}
	.tonic {
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.notes-field :global(.match-key) {
		position: absolute;
		top: -4px;
		right: 0;
	}
	.notes-field :global(.concealed) {
		visibility: hidden;
	}

	.empty-scope {
		margin: 0;
		font-size: var(--cinder-text-sm);
		color: var(--cinder-text-muted);
	}

	@container (min-width: 560px) {
		.fields {
			display: grid;
			grid-template-columns: var(
				--note-scope-columns,
				minmax(150px, 0.55fr) minmax(150px, 0.55fr) minmax(0, 1.3fr)
			);
			align-items: start;
		}

		.note-options {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}
	}
</style>
