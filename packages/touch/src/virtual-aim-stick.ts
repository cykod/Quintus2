import { type DrawContext, Node2D } from "@quintus/core";
import { Color, Vec2 } from "@quintus/math";
import { VirtualControl } from "./virtual-control.js";

export interface VirtualAimStickConfig {
	position: Vec2;
	radius?: number;
	deadZone?: number;
	fireAction?: string;
	aimFrom?: string;
	aimDistance?: number;
}

/**
 * Specialized joystick for twin-stick aiming.
 * Moves the engine's mouse position relative to a target node,
 * and optionally injects a fire action when outside the dead zone.
 */
export class VirtualAimStick extends VirtualControl {
	readonly radius: number;
	readonly deadZone: number;
	readonly fireAction: string | undefined;
	readonly aimFrom: string | undefined;
	readonly aimDistance: number;

	private _knobOffset = new Vec2(0, 0);
	private _active = false;
	private _firing = false;

	constructor(config: VirtualAimStickConfig) {
		super();
		this.position = config.position;
		this.radius = config.radius ?? 50;
		this.deadZone = config.deadZone ?? 0.2;
		this.fireAction = config.fireAction;
		this.aimFrom = config.aimFrom;
		this.aimDistance = config.aimDistance ?? 200;
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
		if (this._firing && this.fireAction) {
			this.input.inject(this.fireAction, false);
			this._firing = false;
		}
	}

	private _updateFromTouch(x: number, y: number): void {
		let dx = x - this.position.x;
		let dy = y - this.position.y;

		const dist = Math.sqrt(dx * dx + dy * dy);
		if (dist > this.radius) {
			dx = (dx / dist) * this.radius;
			dy = (dy / dist) * this.radius;
		}

		this._knobOffset = new Vec2(dx, dy);

		const normalized = dist > 0 ? dist / this.radius : 0;
		const inDeadZone = normalized < this.deadZone;

		// Update aim position
		if (!inDeadZone && this.aimFrom && dist > 0) {
			const scene = this.game.currentScene;
			if (scene) {
				const aimNode = scene.find(this.aimFrom);
				if (aimNode && aimNode instanceof Node2D) {
					const dirX = dx / dist;
					const dirY = dy / dist;
					const gp = aimNode.globalPosition;
					const targetX = gp.x + dirX * this.aimDistance;
					const targetY = gp.y + dirY * this.aimDistance;
					this.input.setMousePosition(targetX, targetY);
				}
			}
		}

		// Fire action
		if (this.fireAction) {
			if (!inDeadZone && !this._firing) {
				this.input.inject(this.fireAction, true);
				this._firing = true;
			} else if (inDeadZone && this._firing) {
				this.input.inject(this.fireAction, false);
				this._firing = false;
			}
		}
	}

	override onDraw(ctx: DrawContext): void {
		const center = Vec2.ZERO;
		const color = Color.fromHex("#ff6666");
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
