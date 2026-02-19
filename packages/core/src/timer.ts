import { _registerTimerFactory, Node } from "./node.js";
import { type Signal, signal } from "./signal.js";

/**
 * Lightweight timer node for one-shot and repeating delays.
 * Uses onFixedUpdate for deterministic behavior.
 */
export class Timer extends Node {
	duration = 1;
	repeat = false;
	autostart = false;

	readonly timeout: Signal<void> = signal<void>();

	private _elapsed = 0;
	private _running = false;

	get running(): boolean {
		return this._running;
	}

	get timeLeft(): number {
		return Math.max(0, this.duration - this._elapsed);
	}

	start(duration?: number): void {
		if (duration !== undefined) {
			this.duration = duration;
		}
		this._elapsed = 0;
		this._running = true;
	}

	stop(): void {
		this._running = false;
		this._elapsed = 0;
	}

	override onReady(): void {
		if (this.autostart) this.start();
	}

	override onFixedUpdate(dt: number): void {
		if (!this._running) return;
		this._elapsed += dt;
		if (this._elapsed >= this.duration) {
			if (this.repeat) {
				// Carry over excess time to prevent drift
				this._elapsed -= this.duration;
				this.timeout.emit();
			} else {
				this._running = false;
				this.timeout.emit();
			}
		}
	}
}

// Register Timer factory for Node.after() / Node.every()
_registerTimerFactory(() => new Timer());
