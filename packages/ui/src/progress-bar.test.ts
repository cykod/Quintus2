import { Vec2 } from "@quintus/math";
import { describe, expect, it, vi } from "vitest";
import { ProgressBar } from "./progress-bar.js";

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

describe("ProgressBar", () => {
	it("is non-interactive by default", () => {
		const bar = new ProgressBar();
		expect(bar.interactive).toBe(false);
	});

	it("value clamps to 0..maxValue", () => {
		const bar = new ProgressBar();
		bar.maxValue = 100;

		bar.value = 50;
		expect(bar.value).toBe(50);

		bar.value = -10;
		expect(bar.value).toBe(0);

		bar.value = 200;
		expect(bar.value).toBe(100);
	});

	it("ratio returns correct proportion", () => {
		const bar = new ProgressBar();
		bar.maxValue = 200;
		bar.value = 100;
		expect(bar.ratio).toBeCloseTo(0.5);
	});

	it("ratio returns 0 when maxValue is 0", () => {
		const bar = new ProgressBar();
		bar.maxValue = 0;
		expect(bar.ratio).toBe(0);
	});

	it("valueChanged signal fires on value change", () => {
		const bar = new ProgressBar();
		const fn = vi.fn();
		bar.valueChanged.connect(fn);

		bar.value = 50;
		expect(fn).toHaveBeenCalledWith(50);
	});

	it("valueChanged does not fire when value is same", () => {
		const bar = new ProgressBar();
		bar.value = 50;
		const fn = vi.fn();
		bar.valueChanged.connect(fn);

		bar.value = 50;
		expect(fn).not.toHaveBeenCalled();
	});

	it("renders background and fill", () => {
		const bar = new ProgressBar();
		bar.width = 100;
		bar.height = 20;
		bar.maxValue = 100;
		bar.value = 50;

		const ctx = createMockCtx();
		bar.onDraw(ctx);

		// Background + fill = 2 rect calls
		expect(ctx.rect).toHaveBeenCalledTimes(2);
	});

	it("does not render fill when value is 0", () => {
		const bar = new ProgressBar();
		bar.width = 100;
		bar.height = 20;

		const ctx = createMockCtx();
		bar.onDraw(ctx);

		// Just background
		expect(ctx.rect).toHaveBeenCalledTimes(1);
	});

	it("renders border when set", () => {
		const bar = new ProgressBar();
		bar.width = 100;
		bar.height = 20;
		bar.borderColor = bar.fillColor;
		bar.borderWidth = 2;

		const ctx = createMockCtx();
		bar.onDraw(ctx);

		// Background + border
		expect(ctx.rect).toHaveBeenCalledTimes(2);
	});

	it("direction right-to-left positions fill correctly", () => {
		const bar = new ProgressBar();
		bar.width = 100;
		bar.height = 20;
		bar.direction = "right-to-left";
		bar.maxValue = 100;
		bar.value = 50;

		const ctx = createMockCtx();
		bar.onDraw(ctx);

		// Fill rect should start at x=50
		const fillCall = ctx.rect.mock.calls[1];
		expect(fillCall[0].x).toBeCloseTo(50);
	});
});
