import { type Signal, signal } from "@quintus/core";

export class AutoplayGate {
	private _ready = false;
	private _queue: Array<() => void> = [];
	readonly onReady: Signal<void> = signal<void>();

	constructor(context: AudioContext) {
		if (context.state === "running") {
			this._ready = true;
		} else {
			// Use click (universally accepted user activation) and keydown.
			// Avoid touchstart — it does NOT grant user activation in Chrome.
			// Register on document in capture phase so stopImmediatePropagation()
			// on the canvas cannot prevent these from firing.
			// Retry on every gesture until context.state is actually "running",
			// because some mobile browsers silently fail the first resume().
			const events = ["click", "keydown"] as const;

			const resume = () => {
				if (this._ready) return;

				context.resume().then(() => {
					if (context.state !== "running" || this._ready) return;
					this._ready = true;
					this.onReady.emit();
					for (const fn of this._queue) fn();
					this._queue.length = 0;

					for (const event of events) {
						document.removeEventListener(event, resume, true);
					}
				});
			};

			for (const event of events) {
				document.addEventListener(event, resume, true);
			}
		}
	}

	get ready(): boolean {
		return this._ready;
	}

	whenReady(fn: () => void): void {
		if (this._ready) fn();
		else this._queue.push(fn);
	}
}
