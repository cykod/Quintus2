import type { DrawContext } from "@quintus/core";
import { type Signal, signal } from "@quintus/core";
import { Color, Vec2 } from "@quintus/math";
import { UINode } from "./ui-node.js";

export class Button extends UINode {
	text = "";
	font = "sans-serif";
	fontSize = 16;
	textColor: Color = Color.WHITE;
	backgroundColor: Color = Color.fromHex("#333333");
	hoverColor: Color = Color.fromHex("#555555");
	pressedColor: Color = Color.fromHex("#222222");
	borderColor: Color | null = null;
	borderWidth = 0;
	padding = 8;

	private _hovered = false;
	private _pressed = false;

	get hovered(): boolean {
		return this._hovered;
	}
	get pressed(): boolean {
		return this._pressed;
	}

	readonly onPressed: Signal<void> = signal<void>();
	readonly onHoverChanged: Signal<boolean> = signal<boolean>();

	override _onPointerDown(): void {
		this._pressed = true;
	}

	override _onPointerUp(x: number, y: number): void {
		if (this._pressed && this.containsPoint(x, y)) {
			this.onPressed.emit();
		}
		this._pressed = false;
	}

	override _onPointerEnter(): void {
		this._hovered = true;
		this.onHoverChanged.emit(true);
	}

	override _onPointerExit(): void {
		this._hovered = false;
		this._pressed = false;
		this.onHoverChanged.emit(false);
	}

	override onDraw(ctx: DrawContext): void {
		const bgColor = this._pressed
			? this.pressedColor
			: this._hovered
				? this.hoverColor
				: this.backgroundColor;

		ctx.rect(Vec2.ZERO, this.size, { fill: bgColor });

		if (this.borderColor && this.borderWidth > 0) {
			ctx.rect(Vec2.ZERO, this.size, {
				stroke: this.borderColor,
				strokeWidth: this.borderWidth,
			});
		}

		if (this.text) {
			const textPos = new Vec2(this.width / 2, this.height / 2);
			ctx.text(this.text, textPos, {
				font: this.font,
				size: this.fontSize,
				color: this.textColor,
				align: "center",
				baseline: "middle",
			});
		}
	}
}
