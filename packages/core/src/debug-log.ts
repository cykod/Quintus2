export interface DebugEvent {
	/** Frame number when the event occurred. */
	frame: number;
	/** Game time in seconds. */
	time: number;
	/** Event category for filtering. */
	category: string;
	/** Human-readable message. */
	message: string;
	/** Optional structured data. */
	data?: Record<string, unknown>;
}

export interface EventFilter {
	/** Filter by category (exact match or comma-separated list). */
	category?: string;
	/** Filter by frame range (inclusive). */
	fromFrame?: number;
	toFrame?: number;
	/** Filter by time range (inclusive). */
	fromTime?: number;
	toTime?: number;
	/** Search message text (case-insensitive substring match). */
	search?: string;
	/** Max number of events to return (from the end). */
	limit?: number;
}

export class DebugLog {
	private buffer: DebugEvent[] = [];
	private drainIndex = 0;
	readonly maxSize: number;

	constructor(maxSize = 10_000) {
		this.maxSize = maxSize;
	}

	/** Number of events currently in the buffer. */
	get size(): number {
		return this.buffer.length;
	}

	/** Write an event to the log. */
	write(event: Omit<DebugEvent, "frame" | "time">, frame: number, time: number): void {
		if (this.buffer.length >= this.maxSize) {
			this.buffer.shift();
			if (this.drainIndex > 0) this.drainIndex--;
		}
		this.buffer.push({ ...event, frame, time });
	}

	/**
	 * Get events since last drain and advance the drain cursor.
	 * "What happened since I last checked?"
	 */
	drain(filter?: EventFilter): DebugEvent[] {
		const events = this.buffer.slice(this.drainIndex);
		this.drainIndex = this.buffer.length;
		return filter ? this._filter(events, filter) : events;
	}

	/** Get events without advancing the cursor. For reviewing full history. */
	peek(filter?: EventFilter): DebugEvent[] {
		return filter ? this._filter(this.buffer, filter) : [...this.buffer];
	}

	/** Clear all events and reset the drain cursor. */
	clear(): void {
		this.buffer = [];
		this.drainIndex = 0;
	}

	private _filter(events: DebugEvent[], filter: EventFilter): DebugEvent[] {
		let result = events;

		if (filter.category) {
			const cats = new Set(filter.category.split(",").map((c) => c.trim()));
			result = result.filter((e) => cats.has(e.category));
		}
		if (filter.fromFrame !== undefined) {
			const min = filter.fromFrame;
			result = result.filter((e) => e.frame >= min);
		}
		if (filter.toFrame !== undefined) {
			const max = filter.toFrame;
			result = result.filter((e) => e.frame <= max);
		}
		if (filter.fromTime !== undefined) {
			const min = filter.fromTime;
			result = result.filter((e) => e.time >= min);
		}
		if (filter.toTime !== undefined) {
			const max = filter.toTime;
			result = result.filter((e) => e.time <= max);
		}
		if (filter.search) {
			const s = filter.search.toLowerCase();
			result = result.filter((e) => e.message.toLowerCase().includes(s));
		}
		if (filter.limit) {
			result = result.slice(-filter.limit);
		}

		return result;
	}
}
