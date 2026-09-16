<script lang="ts">
	import { onMount } from 'svelte';
	import Input from '@lostgradient/cinder/input';
	import { createMidiKey, Note, type GuitarBarre } from 'octavian';

	interface Props {
		tuning?: readonly number[];
		frets?: readonly (number | null)[];
		startingFret?: number;
		fretCount?: number;
		fingers?: readonly (number | null)[];
		barres?: readonly GuitarBarre[];
		label?: string;
		onFretChange?: (stringIndex: number, fret: number | null) => void;
		onBarreChange?: (barre: GuitarBarre) => void;
	}

	let {
		tuning = [40, 45, 50, 55, 59, 64],
		frets: fretsProp,
		startingFret = $bindable(1),
		fretCount = 5,
		fingers = [],
		barres = [],
		label = 'Chord diagram',
		onFretChange,
		onBarreChange
	}: Props = $props();
	const identifier = $props.id();
	const defaultFrets: readonly (number | null)[] = [null, 3, 2, 0, 1, 0];
	const standardTuning = [40, 45, 50, 55, 59, 64];
	let dragStart = $state<{ stringIndex: number; fret: number } | null>(null);
	let shiftStart = $state<{ stringIndex: number; fret: number } | null>(null);
	let suppressClick = $state(false);
	let mounted = $state(false);

	const width = 240;
	const left = 30;
	const right = 210;
	const top = 52;
	const bottom = 202;
	const stringGap = $derived((right - left) / Math.max(1, tuning.length - 1));
	const renderFretCount = $derived(
		Number.isInteger(fretCount) && fretCount >= 1 && fretCount <= 24
			? Math.min(fretCount, Math.max(0, 25 - startingFret))
			: 0
	);
	const fretGap = $derived((bottom - top) / Math.max(1, renderFretCount));
	const safeTuning = $derived(tuning.slice(0, 8));
	const frets = $derived(
		fretsProp ??
			(tuning.length === standardTuning.length &&
			tuning.every((midi, index) => midi === standardTuning[index])
				? defaultFrets
				: Array.from({ length: safeTuning.length }, () => null))
	);
	const safeFrets = $derived(frets.slice(0, safeTuning.length));
	const safeFingers = $derived(fingers.slice(0, safeTuning.length));
	const visibleEnd = $derived(startingFret + renderFretCount - 1);
	const fretLabels = $derived(
		Array.from({ length: renderFretCount }, (_, index) => startingFret + index)
	);
	const strings = $derived(Array.from({ length: safeTuning.length }, (_, index) => index));
	const fretCells = $derived(
		strings.flatMap((stringIndex) =>
			Array.from({ length: renderFretCount }, (_, index) => ({
				stringIndex,
				fret: startingFret + index
			}))
		)
	);

	const error = $derived.by(() => {
		if (tuning.length < 2 || tuning.length > 8) return 'Tuning must contain 2 to 8 strings.';
		if (safeTuning.some((midi) => !Number.isInteger(midi) || midi < 0 || midi > 127))
			return 'Tuning must contain MIDI values from 0 to 127.';
		if (!Number.isInteger(startingFret) || startingFret < 1 || startingFret > 24)
			return 'Starting fret must be an integer from 1 to 24.';
		if (!Number.isInteger(fretCount) || fretCount < 1 || fretCount > 24)
			return 'Fret count must be an integer from 1 to 24.';
		if (fretsProp !== undefined && frets.length !== tuning.length)
			return 'Frets must have one entry per tuning string.';
		if (frets.some((fret) => fret !== null && (!Number.isInteger(fret) || fret < 0 || fret > 24)))
			return 'Frets must be null or an integer from 0 to 24.';
		if (
			barres.some(
				(barre) =>
					barre.fromString < 0 ||
					barre.toString >= safeTuning.length ||
					barre.fromString > barre.toString ||
					barre.fret < 1
			)
		)
			return 'Barre string ranges or frets are invalid.';
		return null;
	});

	function x(stringIndex: number) {
		return left + stringIndex * stringGap;
	}
	function cellY(index: number) {
		return top + index * fretGap;
	}
	function valueAt(stringIndex: number) {
		return safeFrets[stringIndex] ?? null;
	}
	function coveredByBarre(stringIndex: number) {
		return barres.some(
			(barre) =>
				stringIndex >= barre.fromString &&
				stringIndex <= barre.toString &&
				valueAt(stringIndex) === barre.fret
		);
	}
	function tuningLabel(stringIndex: number) {
		return Note.fromMidi(createMidiKey(safeTuning[stringIndex])).toString();
	}
	function stringState(stringIndex: number) {
		const value = valueAt(stringIndex);
		return value === null ? 'muted' : value === 0 ? 'open' : `fret ${value}`;
	}
	function activateCell(stringIndex: number, fret: number, event?: MouseEvent) {
		if (!event?.shiftKey) shiftStart = null;
		if (event?.shiftKey && onBarreChange) {
			if (!shiftStart) return (shiftStart = { stringIndex, fret });
			if (shiftStart.fret === fret && shiftStart.stringIndex !== stringIndex) {
				onBarreChange({
					finger: 1,
					fret,
					fromString: Math.min(shiftStart.stringIndex, stringIndex),
					toString: Math.max(shiftStart.stringIndex, stringIndex)
				});
				shiftStart = null;
			}
			return;
		}
		const current = valueAt(stringIndex);
		onFretChange?.(stringIndex, current === fret ? null : fret);
	}
	function beginDrag(event: PointerEvent, stringIndex: number, fret: number) {
		if (event.button !== 0) return;
		dragStart = { stringIndex, fret };
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
	}
	function endDrag(event: PointerEvent, stringIndex: number, fret: number) {
		suppressClick = true;
		if (event.shiftKey) {
			dragStart = null;
			suppressClick = false;
			return;
		}
		const diagram = (event.currentTarget as HTMLElement).closest('.diagram');
		const svg = diagram?.querySelector('svg');
		if (svg) {
			const rect = svg.getBoundingClientRect();
			const svgX = ((event.clientX - rect.left) / rect.width) * width;
			const svgY = ((event.clientY - rect.top) / rect.height) * 238;
			if (svgX < left - stringGap / 2 || svgX > right + stringGap / 2) {
				dragStart = null;
				return;
			}
			stringIndex = Math.max(
				0,
				Math.min(safeTuning.length - 1, Math.round((svgX - left) / stringGap))
			);
			fret = startingFret + Math.floor((svgY - top) / fretGap);
			if (fret < startingFret || fret > visibleEnd) {
				dragStart = null;
				return;
			}
		}
		if (
			dragStart &&
			onBarreChange &&
			dragStart.fret === fret &&
			dragStart.stringIndex !== stringIndex
		) {
			onBarreChange({
				finger: 1,
				fret,
				fromString: Math.min(dragStart.stringIndex, stringIndex),
				toString: Math.max(dragStart.stringIndex, stringIndex)
			});
		} else if (dragStart) activateCell(stringIndex, fret);
		dragStart = null;
		(event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
	}
	function cancelDrag() {
		dragStart = null;
	}
	function toggleOpenMute(stringIndex: number) {
		const current = valueAt(stringIndex);
		onFretChange?.(stringIndex, current === null ? 0 : null);
	}
	function barreY(fret: number) {
		return fret < startingFret || fret > visibleEnd
			? null
			: cellY(fret - startingFret) + fretGap / 2;
	}
	onMount(() => {
		mounted = true;
	});
</script>

<div class="chord-chart" data-testid="chord-chart">
	{#if onFretChange}
		<div class="starting-fret">
			<Input
				id={identifier + '-starting-fret'}
				label="Starting fret"
				type="number"
				min={1}
				max={24}
				value={String(startingFret)}
				disabled={!mounted}
				onValueChange={(value) => (startingFret = Number(value))}
			/>
		</div>
	{/if}
	{#if error}
		<p class="error" role="alert">{error}</p>
	{:else}
		<figure aria-label={label}>
			<div
				class="diagram"
				style={`--string-count: ${safeTuning.length}; --fret-count: ${renderFretCount}`}
			>
				<svg viewBox={`0 0 ${width} 238`} role="img" aria-label={label}>
					{#each fretLabels as fret, index (fret)}
						<line
							x1={left}
							x2={right}
							y1={cellY(index)}
							y2={cellY(index)}
							class:nut={startingFret === 1 && index === 0}
						/>
						<text x={right + 12} y={cellY(index) + 4}>{fret}</text>
					{/each}
					{#each strings as stringIndex (stringIndex)}
						<line x1={x(stringIndex)} x2={x(stringIndex)} y1={top} y2={bottom} />
						{#if !onFretChange && valueAt(stringIndex) === 0}
							<circle class="open" cx={x(stringIndex)} cy={top - 18} r="7" />
						{:else if !onFretChange && valueAt(stringIndex) === null}
							<text class="muted" x={x(stringIndex)} y={top - 13}>×</text>
						{:else if valueAt(stringIndex)! >= startingFret && valueAt(stringIndex)! <= visibleEnd && !coveredByBarre(stringIndex)}
							<circle
								class="dot"
								cx={x(stringIndex)}
								cy={cellY(valueAt(stringIndex)! - startingFret) + fretGap / 2}
								r="9"
							/>
							{#if safeFingers[stringIndex] != null}<text
									class="finger"
									x={x(stringIndex)}
									y={cellY(valueAt(stringIndex)! - startingFret) + fretGap / 2 + 4}
									>{safeFingers[stringIndex]}</text
								>{/if}
						{/if}
						<text class="tuning" x={x(stringIndex)} y={bottom + 24}>{tuningLabel(stringIndex)}</text
						>
					{/each}
					{#each barres as barre (barre.finger + '-' + barre.fret + '-' + barre.fromString)}
						{@const y = barreY(barre.fret)}
						{#if y !== null}<line
								class="barre"
								x1={x(barre.fromString)}
								x2={x(barre.toString)}
								y1={y}
								y2={y}
							/><text
								class="barre-finger"
								x={(x(barre.fromString) + x(barre.toString)) / 2}
								{y}
								dominant-baseline="central">{barre.finger}</text
							>{/if}
					{/each}
				</svg>
				{#if onFretChange}
					<div class="symbol-controls" style={`--string-count: ${safeTuning.length}`}>
						{#each strings as stringIndex (stringIndex)}
							<button
								type="button"
								style={`left: ${(Math.max(0, x(stringIndex) - stringGap / 2) / width) * 100}%; width: ${((Math.min(width, x(stringIndex) + stringGap / 2) - Math.max(0, x(stringIndex) - stringGap / 2)) / width) * 100}%`}
								data-testid={`chord-string-toggle-${stringIndex}`}
								aria-label={`String ${safeTuning.length - stringIndex}: ${stringState(stringIndex)}`}
								aria-pressed={valueAt(stringIndex) === 0}
								disabled={!mounted}
								onclick={() => toggleOpenMute(stringIndex)}
								>{valueAt(stringIndex) === null
									? '×'
									: valueAt(stringIndex) === 0
										? '○'
										: valueAt(stringIndex)}</button
							>
						{/each}
					</div>
				{/if}
				{#if onFretChange}
					<div class="cell-controls" aria-label="Edit frets">
						{#each fretCells as cell (cell.stringIndex + '-' + cell.fret)}
							<button
								type="button"
								style={`left: ${(Math.max(0, x(cell.stringIndex) - stringGap / 2) / width) * 100}%; width: ${((Math.min(width, x(cell.stringIndex) + stringGap / 2) - Math.max(0, x(cell.stringIndex) - stringGap / 2)) / width) * 100}%; top: ${(cellY(cell.fret - startingFret) / 238) * 100}%; height: ${(fretGap / 238) * 100}%`}
								aria-label={`String ${safeTuning.length - cell.stringIndex}, fret ${cell.fret}`}
								aria-pressed={valueAt(cell.stringIndex) === cell.fret}
								data-testid={`chord-cell-${cell.stringIndex}-${cell.fret}`}
								disabled={!mounted}
								onclick={(event) => {
									if (suppressClick) return (suppressClick = false);
									activateCell(cell.stringIndex, cell.fret, event);
								}}
								onpointerdown={(event) => beginDrag(event, cell.stringIndex, cell.fret)}
								onpointerup={(event) => endDrag(event, cell.stringIndex, cell.fret)}
								onpointercancel={cancelDrag}
								onkeydown={(event) => {
									if (event.key === 'Escape') {
										shiftStart = null;
										dragStart = null;
									}
								}}
							></button>
						{/each}
					</div>
				{/if}
			</div>
		</figure>
	{/if}
</div>

<style>
	.chord-chart {
		max-width: 100%;
		color: var(--cinder-text-default);
	}
	figure {
		margin: 0;
	}
	.starting-fret {
		width: 7rem;
		margin-inline: auto;
	}
	.diagram {
		position: relative;
		width: min(100%, 360px);
		margin: 0 auto;
	}
	svg {
		display: block;
		width: 100%;
		height: auto;
		overflow: visible;
		color: currentColor;
	}
	line {
		stroke: currentColor;
		stroke-width: 1;
	}
	line.nut {
		stroke-width: 4;
	}
	text {
		fill: currentColor;
		font-size: 9px;
		text-anchor: middle;
	}
	.open {
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
	}
	.muted {
		font-size: 19px;
	}
	.dot {
		fill: currentColor;
	}
	.finger,
	.barre-finger {
		fill: var(--cinder-surface-raised, Canvas);
		font-size: 9px;
	}
	.barre {
		stroke-width: 18;
		stroke-linecap: round;
	}
	.tuning {
		font-size: 10px;
	}
	.cell-controls {
		position: absolute;
		display: grid;
		inset: 0;
		pointer-events: none;
	}
	.symbol-controls {
		position: absolute;
		inset: 0;
		top: 10%;
		height: 12%;
		display: grid;
	}
	.symbol-controls button {
		position: absolute;
		border: 0;
		background: transparent;
		cursor: pointer;
		color: currentColor;
		font: inherit;
		font-size: 14px;
	}
	.cell-controls button {
		position: absolute;
		pointer-events: auto;
		border: 0;
		background: transparent;
		cursor: pointer;
		touch-action: none;
	}
	.cell-controls button:focus-visible {
		outline: 2px solid currentColor;
		outline-offset: -2px;
	}
	.error {
		color: var(--cinder-text-danger, #b42318);
	}
</style>
