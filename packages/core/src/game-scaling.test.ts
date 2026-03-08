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

function mockCoarsePointer() {
	vi.stubGlobal(
		"matchMedia",
		vi.fn((query: string) => ({
			matches: query === "(pointer: coarse)",
			media: query,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			addListener: vi.fn(),
			removeListener: vi.fn(),
			onchange: null,
			dispatchEvent: vi.fn(),
		})),
	);
}

function mockFinePointer() {
	vi.stubGlobal(
		"matchMedia",
		vi.fn((query: string) => ({
			matches: query !== "(pointer: coarse)",
			media: query,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			addListener: vi.fn(),
			removeListener: vi.fn(),
			onchange: null,
			dispatchEvent: vi.fn(),
		})),
	);
}

describe("Game scaling: fill mode", () => {
	it("fill on desktop (no coarse pointer): behaves like fit", () => {
		vi.stubGlobal("innerWidth", 1920);
		vi.stubGlobal("innerHeight", 1080);

		const game = createGame({ scale: "fill" });

		// jsdom has no matchMedia by default → isMobile = false → fit path
		expect(game.width).toBe(800);
		expect(game.height).toBe(600);
		expect(game.canvas.width).toBe(800);
		expect(game.canvas.height).toBe(600);
		expect(game.canvas.style.position).toBe("absolute");
		expect(game.fillZoom).toBe(1);

		vi.unstubAllGlobals();
	});

	it("fill on desktop (fine pointer): behaves like fit", () => {
		vi.stubGlobal("innerWidth", 1920);
		vi.stubGlobal("innerHeight", 1080);
		mockFinePointer();

		const game = createGame({ scale: "fill" });

		expect(game.width).toBe(800);
		expect(game.height).toBe(600);
		expect(game.canvas.style.position).toBe("absolute");
		expect(game.fillZoom).toBe(1);

		vi.unstubAllGlobals();
	});

	it("fill on mobile (coarse pointer): keeps height, adjusts width", () => {
		vi.stubGlobal("innerWidth", 667);
		vi.stubGlobal("innerHeight", 375);
		mockCoarsePointer();

		const game = createGame({ scale: "fill" });

		// Height stays at design value (600), width adapts to viewport aspect
		expect(game.height).toBe(600);
		expect(game.width).toBe(Math.round(600 * (667 / 375)));
		expect(game.canvas.height).toBe(600);
		expect(game.canvas.width).toBe(game.width);

		// CSS fills viewport
		expect(game.canvas.style.width).toBe("667px");
		expect(game.canvas.style.height).toBe("375px");
		expect(game.canvas.style.position).toBe("fixed");
		expect(game.canvas.style.left).toBe("0px");
		expect(game.canvas.style.top).toBe("0px");

		// fillZoom = viewport height / design height
		expect(game.fillZoom).toBeCloseTo(375 / 600, 5);

		vi.unstubAllGlobals();
	});

	it("fill on mobile: resized signal fires on viewport resize", () => {
		vi.stubGlobal("innerWidth", 667);
		vi.stubGlobal("innerHeight", 375);
		mockCoarsePointer();

		const game = createGame({ scale: "fill" });
		const resizes: Array<{ width: number; height: number }> = [];
		game.resized.connect((data) => resizes.push(data));

		// Simulate orientation change
		vi.stubGlobal("innerWidth", 375);
		vi.stubGlobal("innerHeight", 667);
		window.dispatchEvent(new Event("resize"));

		expect(resizes.length).toBeGreaterThanOrEqual(1);
		const last = resizes[resizes.length - 1]!;
		expect(last.height).toBe(600);
		expect(last.width).toBe(Math.round(600 * (375 / 667)));
		expect(game.width).toBe(last.width);
		expect(game.height).toBe(600);

		vi.unstubAllGlobals();
	});

	it("fill on desktop: resized signal does NOT fire", () => {
		vi.stubGlobal("innerWidth", 1920);
		vi.stubGlobal("innerHeight", 1080);

		const game = createGame({ scale: "fill" });
		const resizes: Array<{ width: number; height: number }> = [];
		game.resized.connect((data) => resizes.push(data));

		vi.stubGlobal("innerWidth", 1024);
		vi.stubGlobal("innerHeight", 768);
		window.dispatchEvent(new Event("resize"));

		expect(resizes.length).toBe(0);

		vi.unstubAllGlobals();
	});

	it("fill on mobile: sets touch-action: none", () => {
		vi.stubGlobal("innerWidth", 750);
		vi.stubGlobal("innerHeight", 1334);
		mockCoarsePointer();

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

	it("fill on mobile with fillAxis 'width': keeps width, adjusts height", () => {
		vi.stubGlobal("innerWidth", 375);
		vi.stubGlobal("innerHeight", 812);
		mockCoarsePointer();

		const canvas = document.createElement("canvas");
		const game = new Game({
			width: 480,
			height: 640,
			canvas,
			renderer: null,
			scale: "fill",
			fillAxis: "width",
		});

		// Width stays at design value (480), height adapts to viewport aspect
		expect(game.width).toBe(480);
		expect(game.height).toBe(Math.round(480 * (812 / 375)));
		expect(game.canvas.width).toBe(480);
		expect(game.canvas.height).toBe(game.height);

		// CSS fills viewport
		expect(game.canvas.style.width).toBe("375px");
		expect(game.canvas.style.height).toBe("812px");
		expect(game.canvas.style.position).toBe("fixed");

		// fillZoom = viewport width / design width
		expect(game.fillZoom).toBeCloseTo(375 / 480, 5);

		vi.unstubAllGlobals();
	});

	it("fill on mobile with fillAxis 'width': resized signal fires on resize", () => {
		vi.stubGlobal("innerWidth", 375);
		vi.stubGlobal("innerHeight", 812);
		mockCoarsePointer();

		const canvas = document.createElement("canvas");
		const game = new Game({
			width: 480,
			height: 640,
			canvas,
			renderer: null,
			scale: "fill",
			fillAxis: "width",
		});
		const resizes: Array<{ width: number; height: number }> = [];
		game.resized.connect((data) => resizes.push(data));

		// Simulate orientation change to landscape
		vi.stubGlobal("innerWidth", 812);
		vi.stubGlobal("innerHeight", 375);
		window.dispatchEvent(new Event("resize"));

		expect(resizes.length).toBeGreaterThanOrEqual(1);
		const last = resizes[resizes.length - 1]!;
		expect(last.width).toBe(480);
		expect(last.height).toBe(Math.round(480 * (375 / 812)));
		expect(game.width).toBe(480);

		vi.unstubAllGlobals();
	});
});
