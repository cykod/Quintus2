import { Color, Vec2 } from "@quintus/math";
import { describe, expect, it, vi } from "vitest";
import { Label } from "./label.js";

function createMockCtx() {
	return {
		text: vi.fn(),
		rect: vi.fn(),
		circle: vi.fn(),
		polygon: vi.fn(),
		line: vi.fn(),
		image: vi.fn(),
		measureText: vi.fn(() => new Vec2(50, 16)),
		save: vi.fn(),
		restore: vi.fn(),
		setAlpha: vi.fn(),
		assets: {} as never,
	};
}

describe("Label", () => {
	it("is non-interactive by default", () => {
		const label = new Label();
		expect(label.interactive).toBe(false);
	});

	it("renders text with default styles", () => {
		const label = new Label();
		label.text = "Hello";
		const ctx = createMockCtx();
		label.onDraw(ctx);

		expect(ctx.text).toHaveBeenCalledOnce();
		expect(ctx.text).toHaveBeenCalledWith("Hello", Vec2.ZERO, {
			font: "sans-serif",
			size: 16,
			color: Color.WHITE,
			align: "left",
			baseline: "top",
		});
	});

	it("does not render when text is empty", () => {
		const label = new Label();
		const ctx = createMockCtx();
		label.onDraw(ctx);

		expect(ctx.text).not.toHaveBeenCalled();
	});

	it("renders shadow when set", () => {
		const label = new Label();
		label.text = "Shadow";
		label.shadow = {
			offset: new Vec2(2, 2),
			color: Color.BLACK,
		};
		const ctx = createMockCtx();
		label.onDraw(ctx);

		expect(ctx.text).toHaveBeenCalledTimes(2);
		// Shadow call
		expect(ctx.text.mock.calls[0][1]).toEqual(new Vec2(2, 2));
		expect(ctx.text.mock.calls[0][2].color).toBe(Color.BLACK);
		// Main text call
		expect(ctx.text.mock.calls[1][1]).toEqual(Vec2.ZERO);
	});

	it("respects custom font, size, color, align, baseline", () => {
		const label = new Label();
		label.text = "Custom";
		label.font = "monospace";
		label.fontSize = 24;
		label.color = Color.RED;
		label.align = "center";
		label.baseline = "middle";
		const ctx = createMockCtx();
		label.onDraw(ctx);

		expect(ctx.text).toHaveBeenCalledWith("Custom", Vec2.ZERO, {
			font: "monospace",
			size: 24,
			color: Color.RED,
			align: "center",
			baseline: "middle",
		});
	});
});
