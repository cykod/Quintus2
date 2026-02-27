import type { DrawContext } from "@quintus/core";
import { Color, Vec2 } from "@quintus/math";
import { VirtualControl } from "./virtual-control.js";

export interface VirtualButtonConfig {
	position: Vec2;
	radius?: number;
	action: string;
	label?: string;
	/** Icon character (emoji/unicode) rendered larger than label. Takes priority over label. */
	icon?: string;
	color?: Color;
}

/**
 * Circular button that injects a single action while held.
 * Uses a 1.3x generous hit zone for fat-finger friendliness.
 */
export class VirtualButton extends VirtualControl {
	readonly action: string;
	readonly radius: number;
	readonly label: string;
	readonly icon: string;
	readonly color: Color;
	private _pressed = false;

	constructor(config: VirtualButtonConfig) {
		super();
		this.position = config.position;
		this.radius = config.radius ?? 30;
		this.action = config.action;
		this.label = config.label ?? "";
		this.icon = config.icon ?? "";
		this.color = config.color ?? Color.WHITE;
	}

	get pressed(): boolean {
		return this._pressed;
	}

	containsPoint(x: number, y: number): boolean {
		const dx = x - this.position.x;
		const dy = y - this.position.y;
		const generous = this.radius * 1.3;
		return dx * dx + dy * dy <= generous * generous;
	}

	_onTouchStart(_x: number, _y: number): void {
		this._pressed = true;
		this.input.inject(this.action, true);
	}

	_onTouchMove(_x: number, _y: number): void {
		// Button does not respond to move
	}

	_onTouchEnd(): void {
		this._pressed = false;
		this.input.inject(this.action, false);
	}

	override onDraw(ctx: DrawContext): void {
		const center = Vec2.ZERO;
		ctx.circle(center, this.radius, {
			fill: this._pressed ? this.color.withAlpha(0.6) : this.color.withAlpha(0.3),
			stroke: this.color,
			strokeWidth: 2,
		});
		if (this.icon) {
			ctx.text(this.icon, center, {
				color: this.color,
				size: this.radius * 0.8,
				align: "center",
				baseline: "middle",
			});
		} else if (this.label) {
			ctx.text(this.label, center, {
				color: this.color,
				size: 14,
				align: "center",
				baseline: "middle",
			});
		}
	}
}
