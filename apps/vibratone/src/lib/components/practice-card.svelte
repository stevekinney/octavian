<script lang="ts">
	import { onMount } from 'svelte';
	let mounted = $state(false);
	onMount(() => {
		mounted = true;
	});
	import Button from '@lostgradient/cinder/button';
	import Alert from '@lostgradient/cinder/alert';
	import Card from '@lostgradient/cinder/card';
	import Check from 'lucide-svelte/icons/check';
	import Play from 'lucide-svelte/icons/play';
	import { getPracticeState } from '$lib/state.svelte';
	import { formatPitch, noteLabel } from '$lib/music';

	const practiceState = getPracticeState();

	const roundLabel = $derived(`Round ${practiceState.round}`);

	const statusText = $derived.by(() => {
		if (!practiceState.canPlay) return 'Adjust the setup to begin';
		if (!practiceState.started) return '';
		if (practiceState.phase === 'guessing') return '';
		if (practiceState.phase === 'revealed')
			return practiceState.lastCorrect ? 'Correct' : 'Not quite';
		return '';
	});

	const statusTone = $derived(
		practiceState.phase === 'revealed'
			? practiceState.lastCorrect
				? 'success'
				: 'danger'
			: 'default'
	);

	const answerLabel = $derived(
		practiceState.current ? formatPitch(practiceState.current, practiceState.spelling) : ''
	);
	// The guess is a pitch class only — octave is never part of a guess.
	const guessLabel = $derived(
		practiceState.guessedPc !== null
			? noteLabel(practiceState.guessedPc, practiceState.spelling)
			: ''
	);
	const revealed = $derived(practiceState.phase === 'revealed');
</script>

<Card>
	<div class="practice">
		{#if practiceState.started}
			<span class="round">{roundLabel}</span>
		{/if}

		<Button
			type="button"
			class="play"
			disabled={!mounted || !practiceState.canPlay}
			onclick={() => (practiceState.current ? practiceState.replay() : practiceState.play())}
			aria-label={practiceState.current ? 'Replay the note' : 'Play the note'}
		>
			{#if practiceState.phase === 'guessing'}
				<span class="pulse" aria-hidden="true"></span>
			{/if}
			<Play size={36} strokeWidth={1.5} fill="currentColor" class="play-icon" aria-hidden="true" />
		</Button>

		{#if practiceState.audioError}
			<Alert variant="danger" class="audio-error">{practiceState.audioError}</Alert>
		{/if}

		<div class="reveal" class:empty={!revealed && practiceState.canPlay} aria-live="polite">
			<p class="status" data-tone={statusTone}>{statusText}</p>
			{#if revealed}
				<div class="reveal-answer">
					<span class="answer">{answerLabel}</span>
					{#if practiceState.lastCorrect}
						<span class="answer-check" aria-hidden="true">
							<Check size={24} strokeWidth={2} />
						</span>
					{/if}
				</div>
				{#if !practiceState.lastCorrect}
					<p class="guess">you played <span class="guess-note">{guessLabel}</span></p>
				{/if}
				<div class="progress" aria-hidden="true">
					<span class="progress-fill"></span>
				</div>
			{/if}
		</div>
	</div>
</Card>

<style>
	.practice {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--cinder-space-4);
		justify-content: center;
		min-height: 328px;
		padding: var(--cinder-space-4);
	}

	.round {
		position: absolute;
		top: var(--cinder-space-3);
		font-size: var(--cinder-text-2xs);
		font-weight: var(--cinder-font-semibold);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--cinder-text-subtle);
		font-variant-numeric: tabular-nums;
	}

	.practice :global(.play) {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 4px;
		width: 104px;
		height: 104px;
		border: none;
		border-radius: var(--cinder-radius-full);
		background: var(--cinder-accent-solid);
		color: var(--cinder-accent-contrast);
		box-shadow: var(--cinder-shadow-md);
		cursor: pointer;
		transition: transform var(--cinder-duration-fast) var(--cinder-ease-standard);
	}

	.practice :global(.play .play-icon) {
		transform: translateX(3px);
	}

	.practice :global(.play:hover:not(:disabled)) {
		background: var(--cinder-accent-solid-hover);
	}

	.practice :global(.play:active:not(:disabled)) {
		transform: scale(0.97);
	}

	.practice :global(.play:disabled) {
		background: var(--cinder-fill-disabled);
		color: var(--cinder-text-disabled);
		box-shadow: none;
		cursor: not-allowed;
	}

	.pulse {
		position: absolute;
		inset: -6px;
		border-radius: var(--cinder-radius-full);
		border: 2px solid var(--cinder-accent-solid);
		animation: pulse 2s var(--cinder-ease-standard) infinite;
		pointer-events: none;
	}

	@keyframes pulse {
		0% {
			transform: scale(1);
			opacity: 0.55;
		}
		100% {
			transform: scale(1.28);
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.pulse {
			animation: none;
		}
	}

	.status {
		margin: 0;
		min-height: 22px;
		font-size: var(--cinder-text-md);
		color: var(--cinder-text-subtle);
	}

	.status[data-tone='success'] {
		color: var(--cinder-status-success-text);
		font-weight: var(--cinder-font-medium);
	}

	.status[data-tone='danger'] {
		color: var(--cinder-status-danger-text);
		font-weight: var(--cinder-font-medium);
	}

	.status[data-tone='default'] {
		color: var(--cinder-text-default);
	}

	.practice :global(.audio-error) {
		text-align: center;
	}

	.reveal {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--cinder-space-2);
		height: 144px;
		flex-shrink: 0;
		justify-content: center;
	}

	.reveal-answer {
		display: flex;
		align-items: center;
		gap: var(--cinder-space-2);
	}

	.answer {
		font-size: var(--cinder-text-4xl);
		font-weight: var(--cinder-font-semibold);
		font-variant-numeric: tabular-nums;
		color: var(--cinder-text-default);
	}

	.answer-check {
		color: var(--cinder-status-success-text);
		display: inline-flex;
	}

	.guess {
		margin: 0;
		font-size: var(--cinder-text-sm);
		color: var(--cinder-text-muted);
	}

	.guess-note {
		color: var(--cinder-status-danger-text);
		font-weight: var(--cinder-font-medium);
	}

	.progress {
		width: 120px;
		height: 3px;
		border-radius: var(--cinder-radius-full);
		background: var(--cinder-surface-inset);
		overflow: hidden;
	}

	.progress-fill {
		display: block;
		height: 100%;
		background: var(--cinder-accent-solid);
		transform-origin: left center;
		animation: advance 1.6s linear forwards;
	}

	@keyframes advance {
		from {
			transform: scaleX(0);
		}
		to {
			transform: scaleX(1);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.progress-fill {
			animation: none;
			transform: scaleX(1);
		}
	}

	.reveal.empty {
		height: 0;
		overflow: hidden;
		margin-top: calc(-1 * var(--cinder-space-4));
	}
</style>
