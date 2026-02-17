import type { NodeSnapshot } from "@quintus/core";
import { findAllInSnapshot, findInSnapshot } from "@quintus/core";

export interface TimelineEntry {
	frame: number;
	time: number;
	snapshot: NodeSnapshot;
}

/**
 * An ordered sequence of scene tree snapshots indexed by frame.
 * Supports time-based and frame-based queries.
 */
export class Timeline {
	private _entries: TimelineEntry[] = [];

	/** Record a snapshot at the given frame. */
	record(frame: number, time: number, snapshot: NodeSnapshot): void {
		this._entries.push({ frame, time, snapshot });
	}

	/** Number of recorded entries. */
	get length(): number {
		return this._entries.length;
	}

	/** All entries (immutable copy). */
	get entries(): readonly TimelineEntry[] {
		return this._entries;
	}

	/** Get the entry at or nearest before the given frame. */
	atFrame(frame: number): TimelineEntry | null {
		let best: TimelineEntry | null = null;
		for (const entry of this._entries) {
			if (entry.frame <= frame) best = entry;
			else break;
		}
		return best;
	}

	/** Get the entry at or nearest before the given time (seconds). */
	atTime(time: number): TimelineEntry | null {
		let best: TimelineEntry | null = null;
		for (const entry of this._entries) {
			if (entry.time <= time) best = entry;
			else break;
		}
		return best;
	}

	/** Find a node by name/type/tag in the snapshot at a given frame. */
	findNode(frame: number, query: string): NodeSnapshot | null {
		const entry = this.atFrame(frame);
		if (!entry) return null;
		return findInSnapshot(entry.snapshot, query);
	}

	/** Find all nodes matching a query at a given frame. */
	findNodes(frame: number, query: string): NodeSnapshot[] {
		const entry = this.atFrame(frame);
		if (!entry) return [];
		return findAllInSnapshot(entry.snapshot, query);
	}

	/** Count nodes matching a query at a given frame. */
	countNodes(frame: number, query: string): number {
		return this.findNodes(frame, query).length;
	}

	/** Get entries in a frame range [from, to] (inclusive). */
	range(fromFrame: number, toFrame: number): TimelineEntry[] {
		return this._entries.filter((e) => e.frame >= fromFrame && e.frame <= toFrame);
	}

	/** First entry. */
	get first(): TimelineEntry | null {
		return this._entries[0] ?? null;
	}

	/** Last entry. */
	get last(): TimelineEntry | null {
		return this._entries[this._entries.length - 1] ?? null;
	}
}
