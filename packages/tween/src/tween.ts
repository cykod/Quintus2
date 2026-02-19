import type { Node } from "@quintus/core";
import { type Signal, signal } from "@quintus/core";
import { Ease, type EasingFn } from "./easing.js";
import type { TweenSystem } from "./tween-system.js";

export type TweenTarget = Record<string, number | Record<string, number> | Lerpable>;

export interface Lerpable {
	lerp(other: Lerpable, t: number): Lerpable;
}

function isLerpable(v: unknown): v is Lerpable {
	return v != null && typeof v === "object" && "lerp" in v && typeof v.lerp === "function";
}

// === Step Types ===

interface PropertyEntry {
	key: string;
	subKey: string | null;
	endVal: number | Lerpable;
	startVal: number | Lerpable;
	mode: "numeric" | "sub-property" | "lerp";
}

interface PropertyStep {
	type: "property";
	entries: PropertyEntry[];
	duration: number;
	easing: EasingFn;
	elapsed: number;
	started: boolean;
}

interface DelayStep {
	type: "delay";
	duration: number;
	elapsed: number;
}

interface CallbackStep {
	type: "callback";
	fn: () => void;
	called: boolean;
}

type Step = PropertyStep | DelayStep | CallbackStep;
type Group = Step[];

function lerpNum(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

export class Tween {
	readonly target: Node;
	private _groups: Group[] = [];
	private _currentGroup = 0;
	private _repeatCount = 0;
	private _repeatIteration = 0;
	private _nextParallel = false;
	private _running = true;
	private _paused = false;
	private _killed = false;
	private _complete = false;
	private _elapsed = 0;

	readonly completed: Signal<void> = signal<void>();
	readonly looped: Signal<number> = signal<number>();

	constructor(target: Node, _system: TweenSystem) {
		this.target = target;
	}

	// === Builder Methods ===

	to(properties: TweenTarget, duration: number, easing?: EasingFn): this {
		const entries: PropertyEntry[] = [];
		for (const [key, endVal] of Object.entries(properties)) {
			if (typeof endVal === "number") {
				entries.push({ key, subKey: null, endVal, startVal: 0, mode: "numeric" });
			} else if (isLerpable(endVal)) {
				entries.push({ key, subKey: null, endVal, startVal: endVal, mode: "lerp" });
			} else if (typeof endVal === "object" && endVal !== null) {
				for (const [subKey, subVal] of Object.entries(endVal)) {
					entries.push({
						key,
						subKey,
						endVal: subVal,
						startVal: 0,
						mode: "sub-property",
					});
				}
			}
		}

		const step: PropertyStep = {
			type: "property",
			entries,
			duration: Math.max(0, duration),
			easing: easing ?? Ease.linear,
			elapsed: 0,
			started: false,
		};

		if (this._nextParallel && this._groups.length > 0) {
			(this._groups[this._groups.length - 1] as Group).push(step);
			this._nextParallel = false;
		} else {
			this._groups.push([step]);
		}

		return this;
	}

	parallel(): this {
		this._nextParallel = true;
		return this;
	}

	delay(duration: number): this {
		const step: DelayStep = { type: "delay", duration: Math.max(0, duration), elapsed: 0 };
		this._groups.push([step]);
		return this;
	}

	callback(fn: () => void): this {
		const step: CallbackStep = { type: "callback", fn, called: false };
		this._groups.push([step]);
		return this;
	}

	repeat(count?: number): this {
		this._repeatCount = count === undefined ? Number.POSITIVE_INFINITY : count;
		return this;
	}

	onComplete(fn: () => void): this {
		this.completed.connect(fn);
		return this;
	}

	// === Control ===

	kill(): void {
		this._killed = true;
		this._running = false;
	}

	pause(): void {
		this._paused = true;
	}

	resume(): void {
		this._paused = false;
	}

	// === State ===

	get running(): boolean {
		return this._running;
	}

	get paused(): boolean {
		return this._paused;
	}

	get elapsed(): number {
		return this._elapsed;
	}

	get isKilled(): boolean {
		return this._killed;
	}

	get isComplete(): boolean {
		return this._complete;
	}

	// === Internal ===

	/** @internal Advance the tween by dt seconds. Called by TweenSystem. */
	_tick(dt: number): void {
		if (!this._running || this._paused || this._killed) return;
		if (this._groups.length === 0) {
			this._finish();
			return;
		}

		this._elapsed += dt;

		// Process current group
		if (this._currentGroup < this._groups.length) {
			const group = this._groups[this._currentGroup] as Group;
			let allDone = true;

			for (const step of group) {
				if (!this._tickStep(step, dt)) {
					allDone = false;
				}
			}

			if (allDone) {
				this._currentGroup++;
				if (this._currentGroup >= this._groups.length) {
					if (this._repeatIteration < this._repeatCount) {
						this._repeatIteration++;
						this.looped.emit(this._repeatIteration);
						this._resetSteps();
						this._currentGroup = 0;
					} else {
						this._finish();
					}
				}
			}
		}
	}

	private _tickStep(step: Step, dt: number): boolean {
		switch (step.type) {
			case "property":
				return this._tickPropertyStep(step, dt);
			case "delay":
				return this._tickDelayStep(step, dt);
			case "callback":
				return this._tickCallbackStep(step);
		}
	}

	private _tickPropertyStep(step: PropertyStep, dt: number): boolean {
		if (!step.started) {
			this._captureStartValues(step);
			step.started = true;
		}

		step.elapsed += dt;

		if (step.duration <= 0) {
			// Instant snap
			this._applyStep(step, 1);
			return true;
		}

		const progress = Math.min(step.elapsed / step.duration, 1);
		const easedT = step.easing(progress);
		this._applyStep(step, easedT);

		return progress >= 1;
	}

	private _tickDelayStep(step: DelayStep, dt: number): boolean {
		step.elapsed += dt;
		return step.elapsed >= step.duration;
	}

	private _tickCallbackStep(step: CallbackStep): boolean {
		if (!step.called) {
			step.called = true;
			step.fn();
		}
		return true;
	}

	private _captureStartValues(step: PropertyStep): void {
		const target = this.target as unknown as Record<string, unknown>;
		for (const entry of step.entries) {
			if (entry.mode === "numeric") {
				entry.startVal = (target[entry.key] as number) ?? 0;
			} else if (entry.mode === "sub-property" && entry.subKey) {
				const obj = target[entry.key] as Record<string, number> | undefined;
				entry.startVal = obj?.[entry.subKey] ?? 0;
			} else if (entry.mode === "lerp") {
				const val = target[entry.key];
				if (isLerpable(val)) {
					entry.startVal = val;
				}
			}
		}
	}

	private _applyStep(step: PropertyStep, t: number): void {
		const target = this.target as unknown as Record<string, unknown>;
		for (const entry of step.entries) {
			if (entry.mode === "numeric") {
				target[entry.key] = lerpNum(entry.startVal as number, entry.endVal as number, t);
			} else if (entry.mode === "sub-property" && entry.subKey) {
				const obj = target[entry.key] as Record<string, number> | undefined;
				if (obj) {
					obj[entry.subKey] = lerpNum(entry.startVal as number, entry.endVal as number, t);
				}
			} else if (entry.mode === "lerp") {
				const start = entry.startVal as Lerpable;
				const end = entry.endVal as Lerpable;
				target[entry.key] = start.lerp(end, t);
			}
		}
	}

	private _resetSteps(): void {
		for (const group of this._groups) {
			for (const step of group) {
				if (step.type === "property") {
					step.elapsed = 0;
					// Keep started=true and startVal so repeat replays from original start
				} else if (step.type === "delay") {
					step.elapsed = 0;
				} else if (step.type === "callback") {
					step.called = false;
				}
			}
		}
	}

	private _finish(): void {
		this._running = false;
		this._complete = true;
		this.completed.emit();
	}
}
