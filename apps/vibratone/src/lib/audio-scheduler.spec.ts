import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	LOOKAHEAD_SECONDS,
	SCHEDULER_TICK_MS,
	createScheduler,
	toScheduledEvents,
	type ScheduledEvent
} from './audio-scheduler.ts';
import { createFakeAudioContext } from './audio/__mocks__/fake-audio-context.ts';

describe('audio-scheduler', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('each event when equals startTime + offsetSeconds within 1ms', () => {
		const events = toScheduledEvents(
			[{ frequencyHz: 440, offsetSeconds: 0.125, duration: 0.25 }],
			12
		);

		expect(events[0].when).toBeCloseTo(12.125, 3);
	});

	it('onEvent is not called for events beyond the lookahead window on the current tick', () => {
		const context = createFakeAudioContext(0);
		const onEvent = vi.fn();
		const scheduler = createScheduler(context, onEvent);

		scheduler.enqueue([{ when: LOOKAHEAD_SECONDS + 0.01, frequencyHz: 440, duration: 0.1 }]);

		expect(onEvent).not.toHaveBeenCalled();
	});

	it('each enqueued event fires onEvent exactly once across multiple ticks', () => {
		const context = createFakeAudioContext(0) as AudioContext & { currentTime: number };
		const onEvent = vi.fn();
		const scheduler = createScheduler(context, onEvent);
		const events = toScheduledEvents(
			[
				{ frequencyHz: 440, offsetSeconds: 0, duration: 0.1 },
				{ frequencyHz: 494, offsetSeconds: 0.1, duration: 0.1 }
			],
			0
		);

		scheduler.enqueue(events);
		context.currentTime = 0.1;
		vi.advanceTimersByTime(SCHEDULER_TICK_MS);
		context.currentTime = 0.2;
		vi.advanceTimersByTime(SCHEDULER_TICK_MS);

		expect(onEvent).toHaveBeenCalledTimes(2);
	});

	it('16 events spaced 100ms apart are all dispatched over the full sequence duration', () => {
		const context = createFakeAudioContext(0) as AudioContext & { currentTime: number };
		const onEvent = vi.fn();
		const scheduler = createScheduler(context, onEvent);
		const events = Array.from({ length: 16 }, (_, index) => ({
			when: index * 0.1,
			frequencyHz: 440,
			duration: 0.05
		}));

		scheduler.enqueue(events);
		for (let index = 0; index < 20; index++) {
			context.currentTime = index * 0.1;
			vi.advanceTimersByTime(SCHEDULER_TICK_MS);
		}

		expect(onEvent).toHaveBeenCalledTimes(16);
	});

	it('events with offsetSeconds 0 are scheduled in the first tick', () => {
		const context = createFakeAudioContext(5);
		const onEvent = vi.fn();
		const scheduler = createScheduler(context, onEvent);

		scheduler.enqueue([{ when: 5, frequencyHz: 440, duration: 0.1 }]);

		expect(onEvent).toHaveBeenCalledTimes(1);
	});

	it('gain defaults to 1.0 when omitted from ScheduledEvent', () => {
		const event = toScheduledEvents([{ frequencyHz: 440, offsetSeconds: 0, duration: 0.1 }], 0)[0];

		expect(event.gain).toBe(1);
	});

	it('overlapping events are both dispatched', () => {
		const context = createFakeAudioContext(0);
		const onEvent = vi.fn();
		const scheduler = createScheduler(context, onEvent);

		scheduler.enqueue([
			{ when: 0, frequencyHz: 440, duration: 0.1 },
			{ when: 0, frequencyHz: 660, duration: 0.1 }
		]);

		expect(onEvent).toHaveBeenCalledTimes(2);
	});

	it('stop prevents onEvent from firing after stop', () => {
		const context = createFakeAudioContext(0) as AudioContext & { currentTime: number };
		const onEvent = vi.fn();
		const scheduler = createScheduler(context, onEvent);

		scheduler.enqueue([{ when: 1, frequencyHz: 440, duration: 0.1 }]);
		scheduler.stop();
		context.currentTime = 1;
		vi.advanceTimersByTime(SCHEDULER_TICK_MS);

		expect(onEvent).not.toHaveBeenCalled();
	});

	it('stop is idempotent', () => {
		const scheduler = createScheduler(createFakeAudioContext(), vi.fn());

		expect(() => {
			scheduler.stop();
			scheduler.stop();
		}).not.toThrow();
	});

	it('stop before enqueue is a no-op', () => {
		const scheduler = createScheduler(createFakeAudioContext(), vi.fn());

		expect(() => scheduler.stop()).not.toThrow();
	});

	it('uses the AudioContext reference passed at construction', () => {
		const context = createFakeAudioContext();
		const receivedContexts: AudioContext[] = [];
		const scheduler = createScheduler(context, (_event, callbackContext) => {
			receivedContexts.push(callbackContext);
		});

		scheduler.enqueue([{ when: 0, frequencyHz: 440, duration: 0.1 }]);

		expect(receivedContexts).toEqual([context]);
	});

	it('toScheduledEvents maps offsetSeconds to absolute when values', () => {
		expect(
			toScheduledEvents(
				[
					{ frequencyHz: 440, offsetSeconds: 0.2, duration: 0.1 },
					{ frequencyHz: 494, offsetSeconds: 0.4, duration: 0.1, gain: 0.5 }
				],
				10
			)
		).toEqual<ScheduledEvent[]>([
			{ when: 10.2, frequencyHz: 440, duration: 0.1, gain: 1 },
			{ when: 10.4, frequencyHz: 494, duration: 0.1, gain: 0.5 }
		]);
	});

	it('toScheduledEvents with empty input returns empty array', () => {
		expect(toScheduledEvents([], 10)).toEqual([]);
	});

	it('enqueue with empty array does not throw and fires no onEvent', () => {
		const onEvent = vi.fn();
		const scheduler = createScheduler(createFakeAudioContext(), onEvent);

		expect(() => scheduler.enqueue([])).not.toThrow();
		expect(onEvent).not.toHaveBeenCalled();
	});

	it('a second enqueue before the first sequence ends replaces the pending queue', () => {
		const context = createFakeAudioContext(0) as AudioContext & { currentTime: number };
		const onEvent = vi.fn();
		const scheduler = createScheduler(context, onEvent);

		scheduler.enqueue([{ when: 1, frequencyHz: 440, duration: 0.1 }]);
		scheduler.enqueue([{ when: 0, frequencyHz: 660, duration: 0.1 }]);
		context.currentTime = 1;
		vi.advanceTimersByTime(SCHEDULER_TICK_MS);

		expect(onEvent).toHaveBeenCalledTimes(1);
		expect(onEvent.mock.calls[0][0].frequencyHz).toBe(660);
	});
});
