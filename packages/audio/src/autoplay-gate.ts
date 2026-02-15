import { type Signal, signal } from "@quintus/core";

export class AutoplayGate {
	private _ready = false;
	private _resumed = false;
	private _queue: Array<() => void> = [];
	readonly onReady: Signal<void> = signal<void>();

	constructor(context: AudioContext, canvas: HTMLCanvasElement) {
		if (context.state === "running") {
			this._ready = true;
		} else {
			const events = ["pointerdown", "keydown", "touchstart"] as const;

			const resume = () => {
				if (this._resumed) return;
				this._resumed = true;

				context.resume().then(() => {
					this._ready = true;
					this.onReady.emit();
					for (const fn of this._queue) fn();
					this._queue.length = 0;
				});

				for (const event of events) {
					canvas.removeEventListener(event, resume);
					document.removeEventListener(event, resume);
				}
			};

			for (const event of events) {
				canvas.addEventListener(event, resume);
				document.addEventListener(event, resume);
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
