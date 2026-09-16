type FakeAudioParam = {
	value: number;
	setValueAtTime(value: number, startTime: number): void;
	linearRampToValueAtTime(value: number, endTime: number): void;
	cancelScheduledValues(startTime: number): void;
};

type FakeAudioNode = {
	connect(node: FakeAudioNode): FakeAudioNode;
};

function createFakeAudioParam(value = 0): FakeAudioParam {
	return {
		value,
		setValueAtTime(nextValue) {
			this.value = nextValue;
		},
		linearRampToValueAtTime(nextValue) {
			this.value = nextValue;
		},
		cancelScheduledValues() {
			// Test double: no scheduled values are persisted.
		}
	};
}

function createFakeAudioNode(): FakeAudioNode {
	return {
		connect(node) {
			return node;
		}
	};
}

export function createFakeAudioContext(startTime = 0): AudioContext {
	const destination = createFakeAudioNode();
	return {
		currentTime: startTime,
		state: 'running',
		destination,
		resume: () => Promise.resolve(),
		createOscillator: () => ({
			...createFakeAudioNode(),
			frequency: createFakeAudioParam(440),
			type: 'sine',
			start() {
				// Test double: no audio is started.
			},
			stop() {
				// Test double: no audio is stopped.
			},
			addEventListener() {
				// Test double: no events are emitted.
			}
		}),
		createGain: () => ({
			...createFakeAudioNode(),
			gain: createFakeAudioParam(1)
		})
	} as unknown as AudioContext;
}
