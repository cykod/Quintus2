import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockResizeObserver, setElementSize } from "./__test-utils__/dom-layout.js";
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

describe("Game scaling: teardown invariant", () => {
	// Invariant for the whole subsystem, not just the listeners any one mode adds:
	// after game.stop(), _setupScaling has released every window listener it registered.
	for (const scale of ["fit", "fill"] as const) {
		it(`scale: '${scale}' removes every window listener it registered on game.stop()`, () => {
			vi.stubGlobal("innerWidth", 1024);
			vi.stubGlobal("innerHeight", 768);
			mockCoarsePointer(); // exercises fill's mobile branch; ignored by "fit"

			const addSpy = vi.spyOn(window, "addEventListener");
			const removeSpy = vi.spyOn(window, "removeEventListener");

			const game = createGame({ scale });
			const isScaling = (type: string) => type === "resize" || type === "orientationchange";
			const added = addSpy.mock.calls.filter(([type]) => isScaling(type));
			expect(added.length).toBe(2);

			game.stop();

			const removed = removeSpy.mock.calls.filter(([type]) => isScaling(type));
			for (const [type, handler] of added) {
				expect(removed).toContainEqual([type, handler]);
			}

			addSpy.mockRestore();
			removeSpy.mockRestore();
			vi.unstubAllGlobals();
		});
	}
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

function createParent(
	width: number,
	height: number,
	content?: { width: number; height: number },
): HTMLDivElement {
	const parent = document.createElement("div");
	setElementSize(parent, width, height, content);
	document.body.appendChild(parent);
	return parent;
}

/** 800x500 design space (aspect 1.6) inside `parent`. */
function createGameInParent(parent: HTMLElement, opts: Partial<GameOptions> = {}): Game {
	const canvas = document.createElement("canvas");
	parent.appendChild(canvas);
	return new Game({
		width: 800,
		height: 500,
		canvas,
		renderer: null,
		scale: "fit-parent",
		...opts,
	});
}

function onlyObserver(): MockResizeObserver {
	expect(MockResizeObserver.instances).toHaveLength(1);
	return MockResizeObserver.instances[0] as MockResizeObserver;
}

describe("Game scaling: fit-parent mode", () => {
	beforeEach(() => {
		MockResizeObserver.instances = [];
		vi.stubGlobal("ResizeObserver", MockResizeObserver);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		document.body.innerHTML = "";
	});

	it("letterboxes the design space into the parent's box", () => {
		// Success criterion: 400x250 parent, 800x500 design space → CSS 400x250.
		const parent = createParent(400, 250);
		const game = createGameInParent(parent);

		expect(game.canvas.style.width).toBe("400px");
		expect(game.canvas.style.height).toBe("250px");
	});

	it("preserves internal resolution (backing store unchanged)", () => {
		const parent = createParent(400, 250);
		const game = createGameInParent(parent);

		expect(game.canvas.width).toBe(800);
		expect(game.canvas.height).toBe(500);
		expect(game.width).toBe(800);
		expect(game.height).toBe(500);
	});

	it("stays in normal flow inside the parent (not viewport-absolute)", () => {
		const parent = createParent(400, 250);
		const game = createGameInParent(parent);

		expect(game.canvas.style.position).toBe("relative");
		expect(game.canvas.parentElement).toBe(parent);
	});

	it("fits to height and centers horizontally when the parent is wider than the game", () => {
		// Parent aspect 3.2 > game aspect 1.6 → height-bound.
		const parent = createParent(800, 250);
		const game = createGameInParent(parent);

		expect(game.canvas.style.height).toBe("250px");
		expect(game.canvas.style.width).toBe("400px");
		expect(game.canvas.style.left).toBe("200px");
		expect(game.canvas.style.top).toBe("0px");
	});

	it("fits to width and centers vertically when the parent is taller than the game", () => {
		// Parent aspect 0.8 < game aspect 1.6 → width-bound.
		const parent = createParent(400, 500);
		const game = createGameInParent(parent);

		expect(game.canvas.style.width).toBe("400px");
		expect(game.canvas.style.height).toBe("250px");
		expect(game.canvas.style.left).toBe("0px");
		expect(game.canvas.style.top).toBe("125px");
	});

	it("sets touch-action: none", () => {
		const parent = createParent(400, 250);
		const game = createGameInParent(parent);

		expect(game.canvas.style.touchAction).toBe("none");
	});

	it("measures the parent's content box, not its padding box", () => {
		// A 400x250 content box with padding: 20px reports clientWidth/clientHeight of
		// 440x290. Fitting into 440x290 would push the canvas out of the container.
		const parent = createParent(440, 290, { width: 400, height: 250 });
		const game = createGameInParent(parent);

		expect(game.canvas.style.width).toBe("400px");
		expect(game.canvas.style.height).toBe("250px");
	});

	it("falls back to clientWidth/clientHeight when the callback carries no entries", () => {
		const parent = createParent(400, 250, { width: 400, height: 250 });
		const game = createGameInParent(parent);

		setElementSize(parent, 800, 500, { width: 800, height: 500 });
		onlyObserver().fireWithoutEntries();

		expect(game.canvas.style.width).toBe("800px");
		expect(game.canvas.style.height).toBe("500px");
	});

	it("re-fits and emits resized (with the internal, not CSS, size) when the parent resizes", () => {
		const parent = createParent(400, 250);
		const game = createGameInParent(parent);
		const resizes: Array<{ width: number; height: number }> = [];
		game.resized.connect((data) => resizes.push(data));

		// Deliberately NOT the 800x500 design size, so the payload provably differs from
		// the applied CSS size and the two candidate payload semantics are distinguishable.
		setElementSize(parent, 1600, 1000);
		onlyObserver().fire();

		expect(game.canvas.style.width).toBe("1600px");
		expect(game.canvas.style.height).toBe("1000px");
		expect(resizes).toEqual([{ width: 800, height: 500 }]);
	});

	it("skips the re-fit and the resized emission when the parent's size is unchanged", () => {
		const parent = createParent(400, 250);
		const game = createGameInParent(parent);
		const resizes: Array<{ width: number; height: number }> = [];
		game.resized.connect((data) => resizes.push(data));

		onlyObserver().fire();
		onlyObserver().fire();

		expect(resizes).toHaveLength(0);
		expect(game.canvas.style.width).toBe("400px");
	});

	it("warns when the parent is <body>, which is usually content-sized", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		setElementSize(document.body, 800, 500);

		const canvas = document.createElement("canvas");
		document.body.appendChild(canvas);
		new Game({ width: 800, height: 500, canvas, renderer: null, scale: "fit-parent" });

		expect(warn).toHaveBeenCalledTimes(1);
		expect(warn.mock.calls[0]?.[0]).toContain("<body>");

		warn.mockRestore();
	});

	it("defers the fit until the parent has a nonzero size", () => {
		// Parent not laid out yet (React not flushed / display:none / not attached).
		const parent = createParent(0, 0);
		const game = createGameInParent(parent);
		const resizes: Array<{ width: number; height: number }> = [];
		game.resized.connect((data) => resizes.push(data));

		expect(game.canvas.style.width).toBe("");
		expect(game.canvas.style.position).toBe("");
		expect(resizes).toHaveLength(0);

		// Layout happens; the observer reports the real size.
		setElementSize(parent, 400, 250);
		onlyObserver().fire();

		expect(game.canvas.style.width).toBe("400px");
		expect(game.canvas.style.height).toBe("250px");
		expect(resizes).toHaveLength(1);
	});

	it("observes the parent exactly once and disconnects on game.stopped", () => {
		const parent = createParent(400, 250);
		const game = createGameInParent(parent);

		const observer = onlyObserver();
		expect(observer.observed).toEqual([parent]);
		expect(observer.disconnected).toBe(false);

		game.stop();

		expect(observer.disconnected).toBe(true);
	});

	it("falls back to fit (warning once, registering no observer) with no parent element", () => {
		vi.stubGlobal("innerWidth", 1024);
		vi.stubGlobal("innerHeight", 768);
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

		// Detached canvas → no parentElement.
		const canvas = document.createElement("canvas");
		const game = new Game({
			width: 800,
			height: 500,
			canvas,
			renderer: null,
			scale: "fit-parent",
		});

		expect(game.canvas.style.position).toBe("absolute");
		expect(game.canvas.style.width).not.toBe("");
		expect(MockResizeObserver.instances).toHaveLength(0);
		expect(warn).toHaveBeenCalledTimes(1);

		warn.mockRestore();
	});

	it("falls back to fit (warning once, registering no observer) without ResizeObserver", () => {
		vi.stubGlobal("innerWidth", 1024);
		vi.stubGlobal("innerHeight", 768);
		vi.stubGlobal("ResizeObserver", undefined);
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

		const parent = createParent(400, 250);
		const game = createGameInParent(parent);

		expect(game.canvas.style.position).toBe("absolute");
		expect(MockResizeObserver.instances).toHaveLength(0);
		expect(warn).toHaveBeenCalledTimes(1);

		warn.mockRestore();
	});

	it("scale: 'fit' still letterboxes against the viewport and registers no observer (regression)", () => {
		vi.stubGlobal("innerWidth", 1024);
		vi.stubGlobal("innerHeight", 768);

		const parent = createParent(400, 250);
		const game = createGameInParent(parent, { scale: "fit" });

		// Viewport-sized and viewport-positioned — unchanged by fit-parent's arrival.
		expect(game.canvas.style.position).toBe("absolute");
		expect(game.canvas.style.width).toBe("1024px");
		expect(game.canvas.style.height).toBe("640px");
		expect(MockResizeObserver.instances).toHaveLength(0);
	});
});
