export const LOOKAHEAD_SECONDS = 0.1;
export const SCHEDULER_TICK_MS = 25;

export type ScheduledEvent = {
	when: number;
	frequencyHz: number;
	duration: number;
	gain?: number;
};

type PendingScheduledEvent = ScheduledEvent & { fired: boolean };

export type Scheduler = {
	enqueue(events: ScheduledEvent[]): void;
	stop(): void;
};

export function toScheduledEvents(
	notes: ReadonlyArray<{
		frequencyHz: number;
		offsetSeconds: number;
		duration: number;
		gain?: number;
	}>,
	startTime: number
): ScheduledEvent[] {
	return notes.map((note) => ({
		when: startTime + note.offsetSeconds,
		frequencyHz: note.frequencyHz,
		duration: note.duration,
		gain: note.gain ?? 1
	}));
}

export function createScheduler(
	context: AudioContext,
	onEvent: (event: ScheduledEvent, context: AudioContext) => void,
	options: { lookaheadSeconds?: number; tickMs?: number } = {}
): Scheduler {
	const lookaheadSeconds = options.lookaheadSeconds ?? LOOKAHEAD_SECONDS;
	const tickMs = options.tickMs ?? SCHEDULER_TICK_MS;
	let pendingEvents: PendingScheduledEvent[] = [];
	let interval: ReturnType<typeof setInterval> | undefined;
	let stopped = false;

	function clearIntervalIfRunning(): void {
		if (interval !== undefined) {
			clearInterval(interval);
			interval = undefined;
		}
	}

	function scheduleDueEvents(): void {
		if (stopped) return;
		const horizon = context.currentTime + lookaheadSeconds;
		for (const pendingEvent of pendingEvents) {
			if (!pendingEvent.fired && pendingEvent.when <= horizon) {
				pendingEvent.fired = true;
				onEvent(
					{
						when: pendingEvent.when,
						frequencyHz: pendingEvent.frequencyHz,
						duration: pendingEvent.duration,
						gain: pendingEvent.gain
					},
					context
				);
			}
		}
		pendingEvents = pendingEvents.filter((event) => !event.fired);
		if (pendingEvents.length === 0) clearIntervalIfRunning();
	}

	function enqueue(events: ScheduledEvent[]): void {
		clearIntervalIfRunning();
		stopped = false;
		pendingEvents = [...events]
			.sort((a, b) => a.when - b.when)
			.map((event) => ({ ...event, gain: event.gain ?? 1, fired: false }));
		if (pendingEvents.length === 0) return;
		scheduleDueEvents();
		if (pendingEvents.length > 0) {
			interval = setInterval(scheduleDueEvents, tickMs);
		}
	}

	function stop(): void {
		stopped = true;
		pendingEvents = [];
		clearIntervalIfRunning();
	}

	return { enqueue, stop };
}
