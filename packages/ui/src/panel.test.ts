import { Color, Vec2 } from "@quintus/math";
import { describe, expect, it, vi } from "vitest";
import { Panel } from "./panel.js";

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

describe("Panel", () => {
	it("is non-interactive by default", () => {
		const panel = new Panel();
		expect(panel.interactive).toBe(false);
	});

	it("has default background color with alpha", () => {
		const panel = new Panel();
		expect(panel.backgroundColor.a).toBeCloseTo(0.7);
	});

	it("has no border by default", () => {
		const panel = new Panel();
		expect(panel.borderColor).toBeNull();
		expect(panel.borderWidth).toBe(0);
	});

	it("draws filled rect with backgroundColor", () => {
		const panel = new Panel();
		panel.width = 100;
		panel.height = 50;
		const ctx = createMockCtx();
		panel.onDraw(ctx);

		expect(ctx.rect).toHaveBeenCalledOnce();
		expect(ctx.rect).toHaveBeenCalledWith(Vec2.ZERO, new Vec2(100, 50), {
			fill: panel.backgroundColor,
		});
	});

	it("draws border when borderColor and borderWidth are set", () => {
		const panel = new Panel();
		panel.width = 120;
		panel.height = 80;
		panel.borderColor = Color.WHITE;
		panel.borderWidth = 2;
		const ctx = createMockCtx();
		panel.onDraw(ctx);

		expect(ctx.rect).toHaveBeenCalledTimes(2);
		// First call: fill
		expect(ctx.rect.mock.calls[0][2]).toEqual({ fill: panel.backgroundColor });
		// Second call: stroke
		expect(ctx.rect.mock.calls[1][2]).toEqual({
			stroke: Color.WHITE,
			strokeWidth: 2,
		});
	});

	it("does not draw border when borderColor is null", () => {
		const panel = new Panel();
		panel.width = 100;
		panel.height = 50;
		panel.borderColor = null;
		panel.borderWidth = 2;
		const ctx = createMockCtx();
		panel.onDraw(ctx);

		expect(ctx.rect).toHaveBeenCalledOnce();
	});

	it("does not draw border when borderWidth is 0", () => {
		const panel = new Panel();
		panel.width = 100;
		panel.height = 50;
		panel.borderColor = Color.RED;
		panel.borderWidth = 0;
		const ctx = createMockCtx();
		panel.onDraw(ctx);

		expect(ctx.rect).toHaveBeenCalledOnce();
	});
});
