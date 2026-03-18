import { Node, Signal } from "@quintus/core";
import type * as THREE from "three";
import type { GLTFModel } from "./gltf-model.js";
import type { Node3D } from "./node3d.js";

/** Easing function type: takes t in [0,1], returns value in [0,1]. */
export type EasingFn = (t: number) => number;

/** Linear easing (identity function). */
const linear: EasingFn = (t) => t;

/** Ease in-out quadratic (smooth start and end). */
const easeInOutQuad: EasingFn = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

export { linear, easeInOutQuad };

/** A single step in an action sequence. */
interface ActionStep {
	/** Update function called each tick. Returns true when done. */
	update(dt: number): boolean;
	/** Cancel this step immediately. */
	cancel(): void;
}

/**
 * ActionQueue — orchestrates sequential animations on a target Node3D.
 *
 * Usage:
 * ```ts
 * const queue = this.add(ActionQueue, { target: myNode });
 * queue.play(0, q => q
 *   .moveTo(new Vec3(5, 0, 0), 0.3)
 *   .wait(0.1)
 *   .rotateTo(Math.PI, 0.2)
 * );
 * ```
 */
export class ActionQueue extends Node {
	/** The Node3D this queue operates on. */
	target: Node3D | null = null;

	/** Emitted when the current sequence completes naturally. */
	readonly completed = new Signal<void>();

	/** Emitted when the current sequence is cancelled. */
	readonly cancelled = new Signal<void>();

	/** Whether a sequence is currently running. */
	get isRunning(): boolean {
		return this._steps.length > 0;
	}

	private _steps: ActionStep[] = [];
	private _priority = -1;

	/**
	 * Play a sequence at the given priority level.
	 * Higher priority interrupts lower. Equal priority replaces.
	 */
	play(priority: number, builder: (q: ActionQueueBuilder) => ActionQueueBuilder): void {
		if (priority < this._priority) return; // lower priority, ignore

		if (this._steps.length > 0) {
			this._cancelCurrent();
		}

		this._priority = priority;
		const b = new ActionQueueBuilder(this);
		builder(b);
		this._steps = b._build();
	}

	/** Cancel the current sequence. */
	cancel(): void {
		if (this._steps.length === 0) return;
		this._cancelCurrent();
		this.cancelled.emit();
	}

	/** Cancel and clear all steps. */
	clear(): void {
		this.cancel();
	}

	override onFixedUpdate(dt: number): void {
		if (this._steps.length === 0) return;

		const step = this._steps[0] as ActionStep;
		const done = step.update(dt);
		if (done) {
			this._steps.shift();
			if (this._steps.length === 0) {
				this._priority = -1;
				this.completed.emit();
			}
		}
	}

	override onDestroy(): void {
		if (this._steps.length > 0) {
			for (const step of this._steps) step.cancel();
			this._steps.length = 0;
		}
	}

	private _cancelCurrent(): void {
		for (const step of this._steps) step.cancel();
		this._steps.length = 0;
		this._priority = -1;
	}
}

/**
 * Builder for constructing action sequences. Returned by ActionQueue.play().
 */
export class ActionQueueBuilder {
	/** @internal */
	_queue: ActionQueue;
	/** @internal */
	_steps: ActionStep[] = [];

	/** @internal */
	constructor(queue: ActionQueue) {
		this._queue = queue;
	}

	/**
	 * Move target to a world position over duration.
	 */
	moveTo(
		dest: THREE.Vector3 | { x: number; y: number; z: number },
		duration: number,
		easing: EasingFn = easeInOutQuad,
	): this {
		this._steps.push(new MoveToStep(this._queue, dest, duration, easing));
		return this;
	}

	/**
	 * Rotate target's Y-axis to a specific angle over duration.
	 * Automatically picks the shortest rotation path.
	 */
	rotateTo(targetY: number, duration: number, easing: EasingFn = easeInOutQuad): this {
		this._steps.push(new RotateToStep(this._queue, targetY, duration, easing));
		return this;
	}

	/**
	 * Scale target uniformly over duration.
	 */
	scaleTo(
		dest: THREE.Vector3 | { x: number; y: number; z: number } | number,
		duration: number,
		easing: EasingFn = easeInOutQuad,
	): this {
		this._steps.push(new ScaleToStep(this._queue, dest, duration, easing));
		return this;
	}

	/**
	 * Wait for a specified duration before continuing.
	 */
	wait(duration: number): this {
		this._steps.push(new WaitStep(duration));
		return this;
	}

	/**
	 * Run multiple sub-builders in parallel. Completes when all finish.
	 */
	parallel(...builders: Array<(q: ActionQueueBuilder) => ActionQueueBuilder>): this {
		const subSteps = builders.map((fn) => {
			const sub = new ActionQueueBuilder(this._queue);
			fn(sub);
			return sub._build();
		});
		this._steps.push(new ParallelStep(subSteps));
		return this;
	}

	/**
	 * Play a named animation on the target (if it's a GLTFModel).
	 * @param name Animation clip name
	 * @param mode "loop" to play looping, "oneshot" to play once and wait for completion
	 */
	playAnim(name: string, mode: "loop" | "oneshot" = "loop"): this {
		this._steps.push(new PlayAnimStep(this._queue, name, mode));
		return this;
	}

	/**
	 * Execute a custom callback. The step completes immediately.
	 */
	call(fn: () => void): this {
		this._steps.push(new CallStep(fn));
		return this;
	}

	/** @internal */
	_build(): ActionStep[] {
		return this._steps;
	}
}

// ── Step Implementations ──

class MoveToStep implements ActionStep {
	private _queue: ActionQueue;
	private _dest: { x: number; y: number; z: number };
	private _duration: number;
	private _easing: EasingFn;
	private _elapsed = 0;
	private _start: { x: number; y: number; z: number } | null = null;

	constructor(
		queue: ActionQueue,
		dest: { x: number; y: number; z: number },
		duration: number,
		easing: EasingFn,
	) {
		this._queue = queue;
		this._dest = { x: dest.x, y: dest.y, z: dest.z };
		this._duration = duration;
		this._easing = easing;
	}

	update(dt: number): boolean {
		const target = this._queue.target;
		if (!target) return true;

		if (!this._start) {
			this._start = { x: target.position.x, y: target.position.y, z: target.position.z };
		}

		this._elapsed += dt;
		const raw = Math.min(this._elapsed / this._duration, 1);
		const t = this._easing(raw);

		target.position.set(
			this._start.x + (this._dest.x - this._start.x) * t,
			this._start.y + (this._dest.y - this._start.y) * t,
			this._start.z + (this._dest.z - this._start.z) * t,
		);

		return raw >= 1;
	}

	cancel(): void {}
}

class RotateToStep implements ActionStep {
	private _queue: ActionQueue;
	private _targetY: number;
	private _duration: number;
	private _easing: EasingFn;
	private _elapsed = 0;
	private _startY: number | null = null;
	private _delta = 0;

	constructor(queue: ActionQueue, targetY: number, duration: number, easing: EasingFn) {
		this._queue = queue;
		this._targetY = targetY;
		this._duration = duration;
		this._easing = easing;
	}

	update(dt: number): boolean {
		const target = this._queue.target;
		if (!target) return true;

		if (this._startY === null) {
			this._startY = target.rotation.y;
			this._delta = this._targetY - this._startY;
			// Shortest path
			if (this._delta > Math.PI) this._delta -= 2 * Math.PI;
			if (this._delta < -Math.PI) this._delta += 2 * Math.PI;
		}

		this._elapsed += dt;
		const raw = Math.min(this._elapsed / this._duration, 1);
		const t = this._easing(raw);

		target.rotation.y = this._startY + this._delta * t;

		return raw >= 1;
	}

	cancel(): void {}
}

class ScaleToStep implements ActionStep {
	private _queue: ActionQueue;
	private _dest: { x: number; y: number; z: number };
	private _duration: number;
	private _easing: EasingFn;
	private _elapsed = 0;
	private _start: { x: number; y: number; z: number } | null = null;

	constructor(
		queue: ActionQueue,
		dest: { x: number; y: number; z: number } | number,
		duration: number,
		easing: EasingFn,
	) {
		this._queue = queue;
		if (typeof dest === "number") {
			this._dest = { x: dest, y: dest, z: dest };
		} else {
			this._dest = { x: dest.x, y: dest.y, z: dest.z };
		}
		this._duration = duration;
		this._easing = easing;
	}

	update(dt: number): boolean {
		const target = this._queue.target;
		if (!target) return true;

		if (!this._start) {
			this._start = { x: target.scale.x, y: target.scale.y, z: target.scale.z };
		}

		this._elapsed += dt;
		const raw = Math.min(this._elapsed / this._duration, 1);
		const t = this._easing(raw);

		target.scale.set(
			this._start.x + (this._dest.x - this._start.x) * t,
			this._start.y + (this._dest.y - this._start.y) * t,
			this._start.z + (this._dest.z - this._start.z) * t,
		);

		return raw >= 1;
	}

	cancel(): void {}
}

class WaitStep implements ActionStep {
	private _duration: number;
	private _elapsed = 0;

	constructor(duration: number) {
		this._duration = duration;
	}

	update(dt: number): boolean {
		this._elapsed += dt;
		return this._elapsed >= this._duration;
	}

	cancel(): void {}
}

class ParallelStep implements ActionStep {
	private _tracks: ActionStep[][];
	private _done: boolean[];

	constructor(tracks: ActionStep[][]) {
		this._tracks = tracks;
		this._done = tracks.map(() => false);
	}

	update(dt: number): boolean {
		for (let i = 0; i < this._tracks.length; i++) {
			if (this._done[i]) continue;
			const track = this._tracks[i] as ActionStep[];
			if (track.length === 0) {
				this._done[i] = true;
				continue;
			}
			const step = track[0] as ActionStep;
			if (step.update(dt)) {
				track.shift();
				if (track.length === 0) this._done[i] = true;
			}
		}
		return this._done.every((d) => d);
	}

	cancel(): void {
		for (const track of this._tracks) {
			for (const step of track) step.cancel();
		}
	}
}

class PlayAnimStep implements ActionStep {
	private _queue: ActionQueue;
	private _name: string;
	private _mode: "loop" | "oneshot";
	private _started = false;
	private _done = false;

	constructor(queue: ActionQueue, name: string, mode: "loop" | "oneshot") {
		this._queue = queue;
		this._name = name;
		this._mode = mode;
	}

	update(_dt: number): boolean {
		if (!this._started) {
			this._started = true;
			const target = this._queue.target;
			if (!target) return true;

			// Check if target is a GLTFModel (duck-type check)
			const model = target as unknown as GLTFModel;
			if (typeof model.play === "function" && typeof model.playOneShot === "function") {
				if (this._mode === "loop") {
					model.play(this._name);
					return true; // loop starts and we move on
				}
				// oneshot: wait for completion
				model.playOneShot(this._name, () => {
					this._done = true;
				});
				return false;
			}
			return true; // not a GLTFModel, skip
		}
		return this._done;
	}

	cancel(): void {
		this._done = true;
	}
}

class CallStep implements ActionStep {
	private _fn: () => void;
	private _called = false;

	constructor(fn: () => void) {
		this._fn = fn;
	}

	update(_dt: number): boolean {
		if (!this._called) {
			this._called = true;
			this._fn();
		}
		return true;
	}

	cancel(): void {}
}
