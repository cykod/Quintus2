import type { DrawContext } from "@quintus/core";
import { type Signal, signal } from "@quintus/core";
import { Color, Vec2 } from "@quintus/math";
import { UINode } from "./ui-node.js";

export class ProgressBar extends UINode {
	private _value = 0;
	maxValue = 100;
	fillColor: Color = Color.fromHex("#4caf50");
	backgroundColor: Color = Color.fromHex("#333333");
	borderColor: Color | null = null;
	borderWidth = 0;
	direction: "left-to-right" | "right-to-left" | "bottom-to-top" | "top-to-bottom" =
		"left-to-right";

	override interactive = false;

	readonly valueChanged: Signal<number> = signal<number>();

	get value(): number {
		return this._value;
	}

	set value(v: number) {
		const clamped = Math.max(0, Math.min(v, this.maxValue));
		if (clamped === this._value) return;
		this._value = clamped;
		this.valueChanged.emit(clamped);
	}

	get ratio(): number {
		return this.maxValue > 0 ? this._value / this.maxValue : 0;
	}

	override onDraw(ctx: DrawContext): void {
		ctx.rect(Vec2.ZERO, this.size, { fill: this.backgroundColor });

		const r = this.ratio;
		if (r > 0) {
			let fillPos: Vec2;
			let fillSize: Vec2;

			switch (this.direction) {
				case "left-to-right":
					fillPos = Vec2.ZERO;
					fillSize = new Vec2(this.width * r, this.height);
					break;
				case "right-to-left":
					fillPos = new Vec2(this.width * (1 - r), 0);
					fillSize = new Vec2(this.width * r, this.height);
					break;
				case "bottom-to-top":
					fillPos = new Vec2(0, this.height * (1 - r));
					fillSize = new Vec2(this.width, this.height * r);
					break;
				case "top-to-bottom":
					fillPos = Vec2.ZERO;
					fillSize = new Vec2(this.width, this.height * r);
					break;
			}

			ctx.rect(fillPos, fillSize, { fill: this.fillColor });
		}

		if (this.borderColor && this.borderWidth > 0) {
			ctx.rect(Vec2.ZERO, this.size, {
				stroke: this.borderColor,
				strokeWidth: this.borderWidth,
			});
		}
	}
}
