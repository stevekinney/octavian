<script lang="ts">
	import Card from '@lostgradient/cinder/card';
	import FormField from '@lostgradient/cinder/form-field';
	import Slider from '@lostgradient/cinder/slider';
	import NoteScope from '$lib/components/note-scope.svelte';
	import { MAX_OCTAVE, MIN_OCTAVE } from '$lib/round';
	import { getPracticeState } from '$lib/state.svelte';

	const state = getPracticeState();

	const octaveHint = $derived(
		`${state.available} ${state.available === 1 ? 'note' : 'notes'} · C${state.octaveLo}–B${state.octaveHi}`
	);
	const octaveRangeLabel = $derived(
		state.octaveLo === state.octaveHi
			? `Octave ${state.octaveLo}`
			: `Octaves ${state.octaveLo}–${state.octaveHi}`
	);
</script>

<Card>
	<div class="settings">
		<NoteScope
			idPrefix="key-select"
			keyId={state.keyId}
			eligibleNotes={state.eligibleNotes}
			onKeyChange={(keyId) => state.setKey(keyId)}
			onToggleNote={(pitchClass) => state.toggleNote(pitchClass)}
			onResetNotes={() => state.matchKey()}
		/>

		<div class="field">
			<FormField
				class="octave-field"
				id="octaves"
				label={octaveRangeLabel}
				description={octaveHint}
			>
				<Slider
					class="octave-slider"
					mode="range"
					label="Octaves"
					min={MIN_OCTAVE}
					max={MAX_OCTAVE}
					step={1}
					ticks
					valueText={(value) => `C${value}`}
					value={[state.octaveLo, state.octaveHi]}
					onValueChange={([lo, hi]) => state.setOctaves(lo, hi)}
				/>
			</FormField>
		</div>
	</div>
</Card>

<style>
	.settings {
		display: flex;
		flex-direction: column;
		gap: var(--cinder-space-5);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: var(--cinder-space-2);
	}

	:global(.octave-slider .cinder-slider__header) {
		display: none;
	}

	:global(.octave-field) {
		display: grid;
		grid-template-columns: max-content minmax(0, 1fr);
		align-items: baseline;
		column-gap: var(--cinder-space-3);
	}

	:global(.octave-field > .cinder-form-field__description) {
		grid-column: 2;
		grid-row: 1;
		text-align: right;
		text-wrap: balance;
	}

	:global(.octave-field > .cinder-slider),
	:global(.octave-field > .cinder-form-field__error) {
		grid-column: 1 / -1;
	}
</style>
