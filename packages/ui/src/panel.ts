import type { DrawContext } from "@quintus/core";
import { Color, Vec2 } from "@quintus/math";
import { UINode } from "./ui-node.js";

export class Panel extends UINode {
	backgroundColor: Color = Color.fromHex("#000000").withAlpha(0.7);
	borderColor: Color | null = null;
	borderWidth = 0;

	override interactive = false;

	override onDraw(ctx: DrawContext): void {
		ctx.rect(Vec2.ZERO, this.size, { fill: this.backgroundColor });

		if (this.borderColor && this.borderWidth > 0) {
			ctx.rect(Vec2.ZERO, this.size, {
				stroke: this.borderColor,
				strokeWidth: this.borderWidth,
			});
		}
	}
}
