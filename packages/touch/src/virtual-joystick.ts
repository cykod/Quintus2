import type { DrawContext } from "@quintus/core";
import { Color, Vec2 } from "@quintus/math";
import { VirtualControl } from "./virtual-control.js";

export interface VirtualJoystickConfig {
	position: Vec2;
	radius?: number;
	deadZone?: number;
	actions: {
		left?: string;
		right?: string;
		up?: string;
		down?: string;
	};
	analog?: boolean;
}

/**
 * Analog stick for continuous directional input.
 * Injects digital or analog actions based on knob displacement.
 */
export class VirtualJoystick extends VirtualControl {
	readonly radius: number;
	readonly deadZone: number;
	readonly actions: { left?: string; right?: string; up?: string; down?: string };
	readonly analog: boolean;

	private _knobOffset = new Vec2(0, 0);
	private _active = false;
	private _injected = new Set<string>();

	constructor(config: VirtualJoystickConfig) {
		super();
		this.position = config.position;
		this.radius = config.radius ?? 50;
		this.deadZone = config.deadZone ?? 0.2;
		this.actions = config.actions;
		this.analog = config.analog ?? false;
	}

	get knobOffset(): Vec2 {
		return this._knobOffset;
	}

	get active(): boolean {
		return this._active;
	}

	containsPoint(x: number, y: number): boolean {
		const dx = x - this.position.x;
		const dy = y - this.position.y;
		const generous = this.radius * 1.3;
		return dx * dx + dy * dy <= generous * generous;
	}

	_onTouchStart(x: number, y: number): void {
		this._active = true;
		this._updateFromTouch(x, y);
	}

	_onTouchMove(x: number, y: number): void {
		if (!this._active) return;
		this._updateFromTouch(x, y);
	}

	_onTouchEnd(): void {
		this._active = false;
		this._knobOffset = new Vec2(0, 0);
		for (const action of this._injected) {
			this.input.inject(action, false);
		}
		this._injected.clear();
	}

	private _updateFromTouch(x: number, y: number): void {
		let dx = x - this.position.x;
		let dy = y - this.position.y;

		// Clamp to radius
		const dist = Math.sqrt(dx * dx + dy * dy);
		if (dist > this.radius) {
			dx = (dx / dist) * this.radius;
			dy = (dy / dist) * this.radius;
		}

		this._knobOffset = new Vec2(dx, dy);

		// Normalize to -1..1
		const nx = dx / this.radius;
		const ny = dy / this.radius;

		this._injectDirection(this.actions.left, this.actions.right, nx);
		this._injectDirection(this.actions.up, this.actions.down, ny);
	}

	private _injectDirection(
		negAction: string | undefined,
		posAction: string | undefined,
		value: number,
	): void {
		const absValue = Math.abs(value);
		const inDeadZone = absValue < this.deadZone;

		if (negAction) {
			if (!inDeadZone && value < 0) {
				this.input.inject(negAction, true);
				this._injected.add(negAction);
			} else if (this._injected.has(negAction)) {
				this.input.inject(negAction, false);
				this._injected.delete(negAction);
			}
		}

		if (posAction) {
			if (!inDeadZone && value > 0) {
				this.input.inject(posAction, true);
				this._injected.add(posAction);
			} else if (this._injected.has(posAction)) {
				this.input.inject(posAction, false);
				this._injected.delete(posAction);
			}
		}
	}

	override onDraw(ctx: DrawContext): void {
		const center = Vec2.ZERO;
		const color = Color.WHITE;
		// Outer ring
		ctx.circle(center, this.radius, {
			fill: color.withAlpha(0.1),
			stroke: color.withAlpha(0.5),
			strokeWidth: 2,
		});
		// Inner knob
		ctx.circle(this._knobOffset, this.radius * 0.35, {
			fill: this._active ? color.withAlpha(0.6) : color.withAlpha(0.3),
			stroke: color,
			strokeWidth: 2,
		});
	}
}
