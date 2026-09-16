import {
	findVoicings,
	type ChordShape,
	type VoicingRequest,
	type VoicingResponse
} from './chord-voicings';

let search: Generator<ChordShape> | undefined;
let pending: IteratorResult<ChordShape> | undefined;
self.onmessage = (event: MessageEvent<VoicingRequest>) => {
	try {
		if (event.data.type === 'start') {
			search = findVoicings(event.data.search);
			pending = undefined;
		}
		if (!search) throw new Error('Start a voicing search first.');
		const shapes: ChordShape[] = [];
		let next = pending ?? search.next();
		while (!next.done && shapes.length < 12) {
			shapes.push(next.value);
			next = search.next();
		}
		pending = next;
		const response: VoicingResponse = { shapes, done: Boolean(next.done) };
		self.postMessage(response);
	} catch (error) {
		const response: VoicingResponse = {
			shapes: [],
			done: true,
			error: error instanceof Error ? error.message : 'Unable to find chord shapes.'
		};
		self.postMessage(response);
	}
};
