<script lang="ts">
	import type { FretCount, FretPosition } from '$lib/fretboard';
	import { formatPitch } from '$lib/music';
	import StringTuningControl from './string-tuning-control.svelte';

	interface Props {
		tuning?: readonly number[];
		fretCount?: FretCount;
		highlighted?: Pick<FretPosition, 'stringIndex' | 'fret'>;
		selected?: Pick<FretPosition, 'stringIndex' | 'fret'>;
		disabled?: boolean;
		orientation?: 'auto' | 'horizontal' | 'vertical';
		onselect?: (position: FretPosition) => void;
		ontuningchange?: (tuning: readonly number[]) => void;
	}
	let {
		tuning = [40, 45, 50, 55, 59, 64],
		fretCount = 22,
		highlighted,
		selected,
		disabled = false,
		orientation = 'auto',
		onselect,
		ontuningchange
	}: Props = $props();
	const highlightedDescription = $props.id();
	let narrow = $state(false);
	let scrollContainer: HTMLDivElement | undefined;
	let active = $state({ stringIndex: 0, fret: 0 });
	const vertical = $derived(orientation === 'vertical' || (orientation === 'auto' && narrow));
	const focusPosition = $derived({
		stringIndex: Math.min(active.stringIndex, tuning.length - 1),
		fret: Math.min(active.fret, fretCount)
	});
	const frets = $derived(Array.from({ length: fretCount + 1 }, (_, fret) => fret));
	const strings = $derived(
		Array.from({ length: tuning.length }, (_, index) =>
			vertical ? index : tuning.length - 1 - index
		)
	);
	const rows = $derived(vertical ? frets : strings);
	const columns = $derived(vertical ? strings : frets);
	const markerFrets = new Set([3, 5, 7, 9, 12, 15, 17, 19, 21, 24]);

	function noteName(midi: number) {
		return formatPitch({ pc: midi % 12, octave: Math.floor(midi / 12) - 1 }, 'sharp');
	}
	function changeTuning(stringIndex: number, midi: number) {
		if (midi < 0 || midi > 103 || !Number.isInteger(midi) || !ontuningchange) return;
		const nextTuning = tuning.slice();
		nextTuning[stringIndex] = midi;
		ontuningchange(nextTuning);
	}
	function samePosition(
		a: Pick<FretPosition, 'stringIndex' | 'fret'> | undefined,
		b: Pick<FretPosition, 'stringIndex' | 'fret'>
	) {
		return a?.stringIndex === b.stringIndex && a.fret === b.fret;
	}
	function position(row: number, column: number): FretPosition {
		const stringIndex = vertical ? column : row;
		const fret = vertical ? row : column;
		return { stringIndex, fret, midi: tuning[stringIndex] + fret };
	}
	function revealPosition(node: HTMLElement) {
		if (!scrollContainer) return;
		const viewport = scrollContainer.getBoundingClientRect();
		const cell = node.getBoundingClientRect();
		const headerHeight =
			scrollContainer.querySelector('.axis-header')?.getBoundingClientRect().height ?? 0;
		const labelWidth =
			scrollContainer.querySelector('.axis-label')?.getBoundingClientRect().width ?? 0;
		const outsideX = cell.left < viewport.left + labelWidth || cell.right > viewport.right - 1;
		const outsideY = cell.top < viewport.top + headerHeight || cell.bottom > viewport.bottom - 1;
		if (!outsideX && !outsideY) return;
		const left = outsideX
			? scrollContainer.scrollLeft +
				cell.left -
				viewport.left +
				cell.width / 2 -
				(labelWidth + (scrollContainer.clientWidth - labelWidth) / 2)
			: scrollContainer.scrollLeft;
		const top = outsideY
			? scrollContainer.scrollTop +
				cell.top -
				viewport.top +
				cell.height / 2 -
				(headerHeight + (scrollContainer.clientHeight - headerHeight) / 2)
			: scrollContainer.scrollTop;
		scrollContainer.scrollTo({
			left: Math.max(0, left),
			top: Math.max(0, top),
			behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
		});
	}
	function move(stringIndex: number, fret: number) {
		active = {
			stringIndex: Math.max(0, Math.min(tuning.length - 1, stringIndex)),
			fret: Math.max(0, Math.min(fretCount, fret))
		};
		const destination = { ...active };
		queueMicrotask(() => {
			const node = scrollContainer?.querySelector<HTMLElement>(
				`[data-position="${destination.stringIndex}-${destination.fret}"]`
			);
			if (node) {
				node.focus({ preventScroll: true });
				revealPosition(node);
			}
		});
	}
	function handleKeydown(event: KeyboardEvent, current: FretPosition) {
		const { stringIndex, fret } = current;
		if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key))
			return;
		event.preventDefault();
		if (event.key === 'Home') return move(stringIndex, 0);
		if (event.key === 'End') return move(stringIndex, fretCount);
		const direction = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
		const alongFrets = vertical
			? event.key === 'ArrowUp' || event.key === 'ArrowDown'
			: event.key === 'ArrowLeft' || event.key === 'ArrowRight';
		move(
			stringIndex + (alongFrets ? 0 : vertical ? direction : -direction),
			fret + (alongFrets ? direction : 0)
		);
	}
	const revealTarget = $derived.by(() => {
		const target = selected ?? highlighted;
		return (node: HTMLElement) => {
			let disposed = false;
			if (target && node.dataset.position === `${target.stringIndex}-${target.fret}`)
				queueMicrotask(() => {
					if (!disposed) revealPosition(node);
				});
			return () => {
				disposed = true;
			};
		};
	});
	function captureContainer(node: HTMLDivElement) {
		scrollContainer = node;
		let pendingFrame = 0;
		const observer = new ResizeObserver(() => {
			cancelAnimationFrame(pendingFrame);
			pendingFrame = requestAnimationFrame(() => {
				narrow = node.clientWidth < 520;
				const target =
					node.querySelector<HTMLElement>('[aria-selected="true"]') ??
					node.querySelector<HTMLElement>('[data-highlighted="true"]');
				if (target) revealPosition(target);
			});
		});
		observer.observe(node);
		return () => {
			observer.disconnect();
			cancelAnimationFrame(pendingFrame);
			if (scrollContainer === node) scrollContainer = undefined;
		};
	}
</script>

<div class="fretboard-shell" data-testid="fretboard" class:vertical>
	<span id={highlightedDescription} class="cinder-sr-only">Highlighted note</span>
	<div class="fretboard-scroll" {@attach captureContainer}>
		<div
			class="fretboard"
			role="grid"
			aria-label="Guitar fretboard"
			data-orientation={vertical ? 'vertical' : 'horizontal'}
			style={`--columns: ${columns.length}; --strings: ${tuning.length}; --frets: ${frets.length}`}
		>
			<div class="axis-header" role="row">
				<div class="corner" aria-hidden="true"></div>
				{#each columns as column (column)}<div class="column-label" role="columnheader">
						{#if vertical && ontuningchange}
							<StringTuningControl
								midi={tuning[column]}
								stringNumber={tuning.length - column}
								onchange={(midi) => changeTuning(column, midi)}
							/>
						{:else}
							{vertical ? noteName(tuning[column]) : column}
						{/if}
					</div>{/each}
			</div>
			<div class="inlays" aria-hidden="true">
				{#each frets.filter((fret) => markerFrets.has(fret)) as fret (fret)}
					<div class="inlay" class:double={fret === 12 || fret === 24} style={`--fret: ${fret}`}>
						<span></span>{#if fret === 12 || fret === 24}<span></span>{/if}
					</div>
				{/each}
			</div>
			{#each rows as row (row)}
				<div class="board-row" role="row">
					<div
						class="axis-label"
						role="rowheader"
						aria-label={vertical
							? `Fret ${row}`
							: `String ${tuning.length - row}, ${noteName(tuning[row])}`}
					>
						{#if !vertical && ontuningchange}
							<StringTuningControl
								midi={tuning[row]}
								stringNumber={tuning.length - row}
								onchange={(midi) => changeTuning(row, midi)}
							/>
						{:else}
							{vertical ? row : noteName(tuning[row])}
						{/if}
					</div>
					{#each columns as column (column)}
						{@const current = position(row, column)}
						<button
							type="button"
							role="gridcell"
							class="fret"
							class:nut={current.fret === 0}
							class:highlighted={samePosition(highlighted, current)}
							class:selected={samePosition(selected, current)}
							data-position={`${current.stringIndex}-${current.fret}`}
							data-highlighted={samePosition(highlighted, current)}
							tabindex={samePosition(focusPosition, current) ? 0 : -1}
							aria-disabled={disabled}
							aria-selected={samePosition(selected, current)}
							aria-describedby={samePosition(highlighted, current)
								? highlightedDescription
								: undefined}
							aria-label={`String ${tuning.length - current.stringIndex} fret ${current.fret}`}
							onclick={() => {
								active = current;
								if (!disabled) onselect?.(current);
							}}
							onkeydown={(event) => handleKeydown(event, current)}
							{@attach revealTarget}
						></button>
					{/each}
				</div>
			{/each}
		</div>
	</div>
</div>

<style>
	.fretboard-shell {
		--label: 44px;
		--cell: 44px;
		--row: 48px;
		--header: 32px;
		color: var(--cinder-text-default);
	}
	.fretboard-scroll {
		overflow: auto;
		overscroll-behavior: contain;
		border: 1px solid var(--cinder-border);
		border-radius: var(--cinder-radius-md);
	}
	.fretboard {
		position: relative;
		min-width: max-content;
		background: var(--cinder-surface-raised);
	}
	.axis-header,
	.board-row {
		display: grid;
		grid-template-columns: var(--label) repeat(var(--columns), minmax(var(--cell), 1fr));
	}
	.axis-header {
		position: sticky;
		top: 0;
		z-index: 4;
		height: var(--header);
		background: var(--cinder-surface-raised);
	}
	.corner,
	.axis-label {
		position: sticky;
		left: 0;
		z-index: 3;
		background: var(--cinder-surface-raised);
	}
	.column-label,
	.axis-label {
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: var(--cinder-text-xs);
		font-variant-numeric: tabular-nums;
	}
	.board-row {
		height: var(--row);
	}
	.fret {
		position: relative;
		z-index: 1;
		min-width: var(--cell);
		height: var(--row);
		border: 0;
		border-right: 1px solid var(--cinder-border);
		background: linear-gradient(
			to bottom,
			transparent calc(50% - 1px),
			color-mix(in srgb, currentColor 40%, transparent) calc(50% - 1px),
			color-mix(in srgb, currentColor 40%, transparent) calc(50% + 1px),
			transparent calc(50% + 1px)
		);
		color: inherit;
		cursor: pointer;
	}
	.fret.nut {
		border-right: 4px solid var(--cinder-text-default);
	}
	.fret:hover,
	.fret:focus-visible {
		outline: 2px solid var(--cinder-accent-solid);
		outline-offset: -2px;
	}
	.fret.highlighted::before {
		content: '';
		position: absolute;
		left: 50%;
		top: 50%;
		width: 22px;
		height: 22px;
		transform: translate(-50%, -50%);
		border-radius: 50%;
		background: var(--cinder-accent-solid);
		box-shadow: 0 0 0 3px var(--cinder-surface-raised);
	}
	.fret.selected {
		box-shadow: inset 0 0 0 3px var(--cinder-accent-solid);
	}
	.inlays {
		position: absolute;
		top: var(--header);
		left: var(--label);
		right: 0;
		bottom: 0;
		display: grid;
		grid-template-columns: repeat(var(--frets), minmax(var(--cell), 1fr));
		pointer-events: none;
	}
	.inlay {
		grid-column: calc(var(--fret) + 1);
		grid-row: 1;
		display: flex;
		flex-direction: column;
		justify-content: space-evenly;
		align-items: center;
	}
	.inlay span {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: color-mix(in srgb, var(--cinder-text-default) 22%, transparent);
	}
	.vertical {
		--label: 28px;
		--cell: 36px;
		--row: 44px;
		--header: 36px;
	}
	.vertical .fretboard-scroll {
		max-height: min(60svh, 520px);
	}
	.vertical .fretboard {
		min-width: calc(var(--label) + var(--strings) * var(--cell));
	}
	.vertical .fret {
		border-right: 0;
		border-bottom: 1px solid var(--cinder-border);
		background: linear-gradient(
			to right,
			transparent calc(50% - 1px),
			color-mix(in srgb, currentColor 40%, transparent) calc(50% - 1px),
			color-mix(in srgb, currentColor 40%, transparent) calc(50% + 1px),
			transparent calc(50% + 1px)
		);
	}
	.vertical .fret.nut {
		border-bottom: 4px solid var(--cinder-text-default);
	}
	.vertical .inlays {
		grid-template-columns: 1fr;
		grid-template-rows: repeat(var(--frets), var(--row));
	}
	.vertical .inlay {
		grid-column: 1;
		grid-row: calc(var(--fret) + 1);
		flex-direction: row;
	}
</style>
