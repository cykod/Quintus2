import { describe, expect, it, vi } from "vitest";
import { Game, type GameOptions } from "./game.js";

function createGame(opts: Partial<GameOptions> = {}): Game {
	const canvas = document.createElement("canvas");
	return new Game({ width: 800, height: 600, canvas, ...opts });
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
