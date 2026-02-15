import { Vec2 } from "@quintus/math";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./button.js";

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

describe("Button", () => {
	it("is interactive by default", () => {
		const btn = new Button();
		expect(btn.interactive).toBe(true);
	});

	it("click = pointerdown + pointerup within bounds", () => {
		const btn = new Button();
		btn.position = new Vec2(0, 0);
		btn.width = 100;
		btn.height = 40;
		const fn = vi.fn();
		btn.onPressed.connect(fn);

		btn._onPointerDown(50, 20);
		expect(btn.pressed).toBe(true);

		btn._onPointerUp(50, 20);
		expect(fn).toHaveBeenCalledOnce();
		expect(btn.pressed).toBe(false);
	});

	it("drag-away does not fire click", () => {
		const btn = new Button();
		btn.position = new Vec2(0, 0);
		btn.width = 100;
		btn.height = 40;
		const fn = vi.fn();
		btn.onPressed.connect(fn);

		btn._onPointerDown(50, 20);
		btn._onPointerUp(200, 200); // Outside bounds
		expect(fn).not.toHaveBeenCalled();
	});

	it("hover state changes emit signal", () => {
		const btn = new Button();
		const fn = vi.fn();
		btn.onHoverChanged.connect(fn);

		btn._onPointerEnter();
		expect(btn.hovered).toBe(true);
		expect(fn).toHaveBeenCalledWith(true);

		btn._onPointerExit();
		expect(btn.hovered).toBe(false);
		expect(fn).toHaveBeenCalledWith(false);
	});

	it("pointer exit clears pressed state", () => {
		const btn = new Button();
		btn._onPointerDown(50, 20);
		expect(btn.pressed).toBe(true);

		btn._onPointerExit();
		expect(btn.pressed).toBe(false);
	});

	it("renders background rect and text", () => {
		const btn = new Button();
		btn.text = "Click";
		btn.width = 100;
		btn.height = 40;
		const ctx = createMockCtx();
		btn.onDraw(ctx);

		expect(ctx.rect).toHaveBeenCalled();
		expect(ctx.text).toHaveBeenCalledOnce();
	});

	it("renders with hover color when hovered", () => {
		const btn = new Button();
		btn.width = 100;
		btn.height = 40;
		btn._onPointerEnter();

		const ctx = createMockCtx();
		btn.onDraw(ctx);
		expect(ctx.rect.mock.calls[0][2].fill).toBe(btn.hoverColor);
	});

	it("renders with pressed color when pressed", () => {
		const btn = new Button();
		btn.width = 100;
		btn.height = 40;
		btn._onPointerDown(50, 20);

		const ctx = createMockCtx();
		btn.onDraw(ctx);
		expect(ctx.rect.mock.calls[0][2].fill).toBe(btn.pressedColor);
	});
});
