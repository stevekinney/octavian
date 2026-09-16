<script lang="ts">
	import Flame from 'lucide-svelte/icons/flame';
	import Card from '@lostgradient/cinder/card';
	import { Dropdown } from '@lostgradient/cinder/dropdown';
	import { getPracticeState } from '$lib/state.svelte';

	const state = getPracticeState();

	/** Show a dash instead of "0%" when no attempts have been made yet. */
	function displayPercent(percent: number, total: number): string {
		return total === 0 ? '—' : `${percent}%`;
	}
</script>

<Card class="score-bar" padding="none" elevation="none">
	<dl class="stats">
		<div class="stat">
			<dt class="stat-label">This session</dt>
			<dd class="stat-value">{displayPercent(state.sessionPercent, state.session.total)}</dd>
			<dd class="stat-detail">{state.session.correct} of {state.session.total} correct</dd>
		</div>
		<div class="stat">
			<dt class="stat-label">Current streak</dt>
			<dd class="stat-value streak-value">
				<Flame size={20} strokeWidth={1.5} aria-hidden="true" />
				{state.session.streak}
			</dd>
			<dd class="stat-detail">correct in a row</dd>
		</div>
		<div class="stat">
			<dt class="stat-label">Best streak</dt>
			<dd class="stat-value">{state.session.best}</dd>
			<dd class="stat-detail">this session</dd>
		</div>
		<div class="stat">
			<dt class="stat-label">All time</dt>
			<dd class="stat-value">{displayPercent(state.allTimePercent, state.allTime.total)}</dd>
			<dd class="stat-detail">{state.allTime.correct} of {state.allTime.total} correct</dd>
		</div>
	</dl>

	{#snippet footer()}
		<Dropdown id="score-reset-menu" placement="bottom-end">
			<Dropdown.Trigger class="cinder-button" data-cinder-variant="ghost" data-cinder-size="xs"
				>Reset</Dropdown.Trigger
			>
			<Dropdown.Menu>
				<Dropdown.Item onclick={() => state.resetSession()}>Session</Dropdown.Item>
				<Dropdown.Item onclick={() => state.resetAllTime()}>All time</Dropdown.Item>
			</Dropdown.Menu>
		</Dropdown>
	{/snippet}
</Card>

<style>
	:global(.score-bar > .cinder-card__body) {
		padding: var(--cinder-space-5);
	}

	.stats {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		margin: 0;
	}

	.stat {
		display: flex;
		flex-direction: column;
		gap: var(--cinder-space-1);
		min-width: 0;
		padding-inline: var(--cinder-space-4);
	}

	.stat:first-child {
		padding-left: 0;
	}

	.stat + .stat {
		border-left: 1px solid var(--cinder-border);
	}

	.stat-label {
		font-size: var(--cinder-text-xs);
		font-weight: var(--cinder-font-medium);
		color: var(--cinder-text-muted);
	}

	.stat-value {
		display: flex;
		align-items: center;
		gap: var(--cinder-space-1);
		margin: 0;
		font-size: var(--cinder-text-2xl);
		font-weight: var(--cinder-font-semibold);
		font-variant-numeric: tabular-nums;
		line-height: 1.2;
		color: var(--cinder-text-default);
	}

	.streak-value {
		color: var(--cinder-accent-text);
	}

	.stat-detail {
		margin: 0;
		font-size: var(--cinder-text-xs);
		color: var(--cinder-text-muted);
		font-variant-numeric: tabular-nums;
	}

	:global(.score-bar > .cinder-card__footer) {
		border-top: 0;
		display: flex;
		justify-content: flex-end;
		padding: var(--cinder-space-2) var(--cinder-space-5);
	}

	@container (max-width: 600px) {
		.stats {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			row-gap: var(--cinder-space-5);
		}

		.stat:nth-child(odd) {
			border-left: 0;
			padding-left: 0;
		}
	}
</style>
