import type { DrawContext } from "@quintus/core";
import { Color, Vec2 } from "@quintus/math";
import { UINode } from "./ui-node.js";

export interface ShadowStyle {
	offset: Vec2;
	color: Color;
}

export class Label extends UINode {
	text = "";
	font = "sans-serif";
	fontSize = 16;
	color: Color = Color.WHITE;
	align: "left" | "center" | "right" = "left";
	baseline: "top" | "middle" | "bottom" = "top";
	shadow: ShadowStyle | null = null;

	override interactive = false;

	override onDraw(ctx: DrawContext): void {
		if (!this.text) return;

		if (this.shadow) {
			ctx.text(this.text, this.shadow.offset, {
				font: this.font,
				size: this.fontSize,
				color: this.shadow.color,
				align: this.align,
				baseline: this.baseline,
			});
		}

		ctx.text(this.text, Vec2.ZERO, {
			font: this.font,
			size: this.fontSize,
			color: this.color,
			align: this.align,
			baseline: this.baseline,
		});
	}
}
