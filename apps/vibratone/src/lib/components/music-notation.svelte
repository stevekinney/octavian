<script lang="ts">
	import type { Attachment } from 'svelte/attachments';
	import type {
		Clef,
		KeySignature,
		NotationMeasure,
		NotationNote,
		NotationOptions
	} from '$lib/notation';

	let {
		clef = 'treble',
		keySignature = 'C',
		timeSignature,
		ariaLabel,
		notes,
		measures
	}: NotationOptions = $props();

	let description = $derived.by(() => {
		if (ariaLabel) return ariaLabel;
		const content = measures ?? [{ notes: notes ?? [] }];
		const pitches = content
			.map((measure, index) => {
				const events = measure.notes.map((note) =>
					note.rest
						? `${note.duration} rest`
						: `${note.keys.length > 1 ? 'chord ' : ''}${note.keys.join(', ')} (${note.duration}${note.dots ? ', dotted' : ''})`
				);
				return `${measures ? `Measure ${index + 1}: ` : ''}${events.join('; ')}`;
			})
			.filter(Boolean)
			.join('. ');
		return `Music notation in ${clef} clef, key ${keySignature}${timeSignature ? `, time ${timeSignature}` : ''}${pitches ? `. ${pitches}` : ''}`;
	});

	function attachNotation(options: {
		clef: Clef;
		keySignature: KeySignature;
		timeSignature?: string;
		notes?: NotationNote[];
		measures?: NotationMeasure[];
	}): Attachment<HTMLElement> {
		return (element) => {
			let disposed = false;
			let observer: ResizeObserver | undefined;
			const initialize = async () => {
				const VexFlow = await import('vexflow/bravura');
				await Promise.all([
					document.fonts.load('16px Bravura'),
					document.fonts.load('16px Academico')
				]);
				if (disposed) return;
				let previousWidth = -1;
				const render = () => {
					const availableWidth = Math.floor(element.clientWidth);
					if (availableWidth === previousWidth || availableWidth === 0) return;
					previousWidth = availableWidth;
					element.replaceChildren();
					const content = options.measures ?? [{ notes: options.notes ?? [] }];
					const columnWidth = Math.min(
						560,
						content.length > 1 && availableWidth >= 720 ? (availableWidth - 16) / 2 : availableWidth
					);
					for (const [index, measure] of content.entries()) {
						const wrapper = document.createElement('div');
						wrapper.className = 'notation-measure';
						wrapper.dataset.testid = `measure-${index}`;
						wrapper.style.width = `${columnWidth}px`;
						element.append(wrapper);
						const renderer = new VexFlow.Renderer(wrapper, VexFlow.Renderer.Backends.SVG);
						const context = renderer.getContext();
						context.setFillStyle('currentColor').setStrokeStyle('currentColor');
						const stave =
							options.clef === 'tab'
								? new VexFlow.TabStave(0, 30, columnWidth)
								: new VexFlow.Stave(0, 30, columnWidth);
						stave.addClef(options.clef);
						// Each measure can begin a new responsive row, so repeat its clef and key.
						if (options.keySignature !== 'C') stave.addKeySignature(options.keySignature);
						if (index === 0 && options.timeSignature) stave.addTimeSignature(options.timeSignature);
						const tickables = measure.notes.map((note) => createNote(VexFlow, note, options.clef));
						const voice = new VexFlow.Voice({ numBeats: 4, beatValue: 4 })
							.setStrict(false)
							.addTickables(tickables);
						if (options.clef !== 'tab' && tickables.length)
							VexFlow.Accidental.applyAccidentals([voice], options.keySignature);
						const formatter = new VexFlow.Formatter();
						const start = stave.getNoteStartX();
						const minimum = tickables.length
							? formatter.joinVoices([voice]).preCalculateMinTotalWidth([voice])
							: 0;
						const width = Math.max(columnWidth, start + minimum + 40);
						stave.setWidth(width).setContext(context).draw();
						if (tickables.length) {
							formatter.formatToStave([voice], stave);
							voice.draw(context, stave);
						}
						const svg = wrapper.querySelector('svg')!;
						const bounds = svg.getBBox();
						const top = Math.min(0, bounds.y - 12);
						const height = Math.max(180, bounds.y + bounds.height + 12) - top;
						renderer.resize(width + 2, height);
						svg.setAttribute('viewBox', `-1 ${top} ${width + 2} ${height}`);
						svg.setAttribute('aria-hidden', 'true');
						// VexFlow may write explicit default colors; preserve transparent glyph interiors.
						for (const node of [svg, ...svg.querySelectorAll('*')]) {
							for (const attribute of ['fill', 'stroke']) {
								if (node.getAttribute(attribute) === 'black')
									node.setAttribute(attribute, 'currentColor');
							}
						}
					}
				};
				render();
				observer = new ResizeObserver(render);
				observer.observe(element);
			};
			initialize().catch((error: unknown) => {
				if (!disposed) {
					console.error('Music notation rendering failed', error);
					element.textContent = 'Music notation unavailable';
				}
			});
			return () => {
				disposed = true;
				observer?.disconnect();
				element.replaceChildren();
			};
		};
	}

	function createNote(VexFlow: typeof import('vexflow/bravura'), note: NotationNote, clef: Clef) {
		if (clef === 'tab') {
			const positions = note.keys.map((key) => {
				const [str, fret] = key.split('/');
				return { str: Number(str), fret: fret ?? '0' };
			});
			return new VexFlow.TabNote({
				positions,
				duration: note.duration,
				stemDirection: stemDirection(note)
			});
		}
		const staveNote = new VexFlow.StaveNote({
			keys: note.keys,
			duration: note.rest ? `${note.duration}r` : note.duration,
			dots: note.dots,
			clef,
			stemDirection: stemDirection(note)
		});
		for (let index = 0; index < (note.dots ?? 0); index++) {
			VexFlow.Dot.buildAndAttach([staveNote], { all: true });
		}

		return staveNote;
	}

	function stemDirection(note: NotationNote): number | undefined {
		return note.stemDirection === 'up' ? 1 : note.stemDirection === 'down' ? -1 : undefined;
	}
</script>

<div class="notation" role="img" aria-label={description}>
	<div
		class="measures"
		aria-hidden="true"
		{@attach attachNotation({ clef, keySignature, timeSignature, notes, measures })}
	></div>
</div>

<style>
	.notation {
		width: 100%;
		min-width: 0;
	}
	.measures {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 16px;
	}
	.measures :global(.notation-measure) {
		max-width: 100%;
		overflow-x: auto;
	}
	.measures :global(svg) {
		display: block;
	}
</style>
