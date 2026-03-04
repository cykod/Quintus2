import { describe, expect, it, vi } from "vitest";
import { Game, type GameOptions } from "./game.js";

function createGame(opts: Partial<GameOptions> = {}): Game {
	const canvas = document.createElement("canvas");
	return new Game({ width: 800, height: 600, canvas, renderer: null, ...opts });
}

describe("Game scaling", () => {
	it("scale: 'fixed' does not set CSS sizing", () => {
		const game = createGame({ scale: "fixed" });
		// With "fixed", no CSS position/width/height should be set
		expect(game.canvas.style.position).toBe("");
		expect(game.canvas.style.width).toBe("");
	});

	it("default scale does not set CSS sizing (defaults to fixed)", () => {
		const game = createGame();
		expect(game.canvas.style.position).toBe("");
		expect(game.canvas.style.width).toBe("");
	});

	it("scale: 'fit' applies CSS sizing to canvas", () => {
		// jsdom defaults: innerWidth=0, innerHeight=0 — override them
		vi.stubGlobal("innerWidth", 1024);
		vi.stubGlobal("innerHeight", 768);

		const game = createGame({ scale: "fit" });

		// Canvas should have CSS dimensions set
		expect(game.canvas.style.position).toBe("absolute");
		expect(game.canvas.style.width).not.toBe("");
		expect(game.canvas.style.height).not.toBe("");

		vi.unstubAllGlobals();
	});

	it("scale: 'fit' preserves aspect ratio (letterbox wider window)", () => {
		vi.stubGlobal("innerWidth", 1600);
		vi.stubGlobal("innerHeight", 900);

		// Game is 800x600 = 4:3 aspect
		const game = createGame({ scale: "fit" });

		const cssWidth = Number.parseFloat(game.canvas.style.width);
		const cssHeight = Number.parseFloat(game.canvas.style.height);
		const cssAspect = cssWidth / cssHeight;
		const gameAspect = 800 / 600;

		// Aspect ratio should match
		expect(cssAspect).toBeCloseTo(gameAspect, 2);
		// Should fit height (window is wider than game aspect)
		expect(cssHeight).toBe(900);

		vi.unstubAllGlobals();
	});

	it("scale: 'fit' preserves aspect ratio (letterbox taller window)", () => {
		vi.stubGlobal("innerWidth", 800);
		vi.stubGlobal("innerHeight", 1200);

		const game = createGame({ scale: "fit" });

		const cssWidth = Number.parseFloat(game.canvas.style.width);
		const cssHeight = Number.parseFloat(game.canvas.style.height);
		const cssAspect = cssWidth / cssHeight;
		const gameAspect = 800 / 600;

		expect(cssAspect).toBeCloseTo(gameAspect, 2);
		// Should fit width (window is taller than game aspect)
		expect(cssWidth).toBe(800);

		vi.unstubAllGlobals();
	});

	it("scale: 'fit' sets touch-action: none", () => {
		vi.stubGlobal("innerWidth", 1024);
		vi.stubGlobal("innerHeight", 768);

		const game = createGame({ scale: "fit" });
		expect(game.canvas.style.touchAction).toBe("none");

		vi.unstubAllGlobals();
	});

	it("scale: 'fit' centers the canvas", () => {
		vi.stubGlobal("innerWidth", 1600);
		vi.stubGlobal("innerHeight", 900);

		const game = createGame({ scale: "fit" });

		const cssWidth = Number.parseFloat(game.canvas.style.width);
		const left = Number.parseFloat(game.canvas.style.left);
		// Left offset should center the canvas horizontally
		expect(left).toBeCloseTo((1600 - cssWidth) / 2, 1);

		vi.unstubAllGlobals();
	});

	it("internal resolution is unchanged by CSS scaling", () => {
		vi.stubGlobal("innerWidth", 1600);
		vi.stubGlobal("innerHeight", 900);

		const game = createGame({ scale: "fit" });
		// Internal canvas buffer dimensions stay the same
		expect(game.canvas.width).toBe(800);
		expect(game.canvas.height).toBe(600);

		vi.unstubAllGlobals();
	});
});

describe("Game scaling: fill mode", () => {
	it("scale: 'fill' sets canvas dimensions to innerWidth/innerHeight", () => {
		vi.stubGlobal("innerWidth", 750);
		vi.stubGlobal("innerHeight", 1334);

		const game = createGame({ scale: "fill" });

		expect(game.canvas.width).toBe(750);
		expect(game.canvas.height).toBe(1334);
		expect(game.width).toBe(750);
		expect(game.height).toBe(1334);

		vi.unstubAllGlobals();
	});

	it("scale: 'fill' sets CSS to fill viewport", () => {
		vi.stubGlobal("innerWidth", 750);
		vi.stubGlobal("innerHeight", 1334);

		const game = createGame({ scale: "fill" });

		expect(game.canvas.style.width).toBe("100vw");
		expect(game.canvas.style.height).toBe("100vh");
		expect(game.canvas.style.position).toBe("fixed");
		expect(game.canvas.style.left).toBe("0px");
		expect(game.canvas.style.top).toBe("0px");

		vi.unstubAllGlobals();
	});

	it("fillZoom equals viewportHeight / baseHeight", () => {
		vi.stubGlobal("innerWidth", 750);
		vi.stubGlobal("innerHeight", 1334);

		const game = createGame({ scale: "fill", baseHeight: 240 });

		expect(game.fillZoom).toBeCloseTo(1334 / 240, 5);

		vi.unstubAllGlobals();
	});

	it("fillZoom is 1 when no baseHeight", () => {
		vi.stubGlobal("innerWidth", 750);
		vi.stubGlobal("innerHeight", 1334);

		const game = createGame({ scale: "fill" });

		expect(game.fillZoom).toBe(1);

		vi.unstubAllGlobals();
	});

	it("game.resized signal fires on resize", () => {
		vi.stubGlobal("innerWidth", 750);
		vi.stubGlobal("innerHeight", 1334);

		const game = createGame({ scale: "fill", baseHeight: 240 });
		const resizes: Array<{ width: number; height: number }> = [];
		game.resized.connect((data) => resizes.push(data));

		// Initial construction fires resized once
		// Now simulate a resize event
		vi.stubGlobal("innerWidth", 1024);
		vi.stubGlobal("innerHeight", 768);
		window.dispatchEvent(new Event("resize"));

		expect(resizes.length).toBeGreaterThanOrEqual(1);
		const last = resizes[resizes.length - 1]!;
		expect(last.width).toBe(1024);
		expect(last.height).toBe(768);

		// Verify game dimensions updated
		expect(game.width).toBe(1024);
		expect(game.height).toBe(768);
		expect(game.fillZoom).toBeCloseTo(768 / 240, 5);

		vi.unstubAllGlobals();
	});

	it("scale: 'fill' sets touch-action: none", () => {
		vi.stubGlobal("innerWidth", 750);
		vi.stubGlobal("innerHeight", 1334);

		const game = createGame({ scale: "fill" });
		expect(game.canvas.style.touchAction).toBe("none");

		vi.unstubAllGlobals();
	});

	it("scale: 'fit' behavior unchanged (regression)", () => {
		vi.stubGlobal("innerWidth", 1024);
		vi.stubGlobal("innerHeight", 768);

		const game = createGame({ scale: "fit" });

		expect(game.canvas.style.position).toBe("absolute");
		expect(game.width).toBe(800);
		expect(game.height).toBe(600);

		vi.unstubAllGlobals();
	});

	it("scale: 'fixed' behavior unchanged (regression)", () => {
		const game = createGame({ scale: "fixed" });
		expect(game.canvas.style.position).toBe("");
		expect(game.width).toBe(800);
		expect(game.height).toBe(600);
	});
});
