import { Color, Rect, Vec2 } from "@quintus/math";
import { type MockInstance, describe, expect, it, vi } from "vitest";
import { AssetLoader } from "./asset-loader.js";
import { Canvas2DRenderer } from "./canvas2d-renderer.js";
import type { DrawContext } from "./draw-context.js";
import { Game } from "./game.js";
import { Node2D } from "./node2d.js";
import { Scene } from "./scene.js";

function createTestSetup() {
	const canvas = document.createElement("canvas");
	canvas.width = 200;
	canvas.height = 200;
	const game = new Game({ width: 200, height: 200, canvas });
	const scene = new Scene(game);
	const assets = new AssetLoader();
	const renderer = new Canvas2DRenderer(canvas, 200, 200, "#000000", assets);
	const ctx = canvas.getContext("2d")!;
	return { canvas, ctx, game, scene, renderer, assets };
}

/**
 * Spy on fillStyle/strokeStyle setters.
 * jsdom normalizes color values (e.g. rgba → hex), so we capture the raw
 * value passed to the setter rather than reading the normalized property.
 */
function spyOnStyleSetters(ctx: CanvasRenderingContext2D) {
	const setFillStyle = vi.fn<(v: string | CanvasGradient | CanvasPattern) => void>();
	const setStrokeStyle = vi.fn<(v: string | CanvasGradient | CanvasPattern) => void>();

	const origFillDesc =
		Object.getOwnPropertyDescriptor(ctx, "fillStyle") ||
		Object.getOwnPropertyDescriptor(Object.getPrototypeOf(ctx), "fillStyle")!;
	const origStrokeDesc =
		Object.getOwnPropertyDescriptor(ctx, "strokeStyle") ||
		Object.getOwnPropertyDescriptor(Object.getPrototypeOf(ctx), "strokeStyle")!;

	Object.defineProperty(ctx, "fillStyle", {
		set(v) {
			setFillStyle(v);
			origFillDesc.set?.call(this, v);
		},
		get() {
			return origFillDesc.get?.call(this);
		},
		configurable: true,
	});
	Object.defineProperty(ctx, "strokeStyle", {
		set(v) {
			setStrokeStyle(v);
			origStrokeDesc.set?.call(this, v);
		},
		get() {
			return origStrokeDesc.get?.call(this);
		},
		configurable: true,
	});

	return { setFillStyle, setStrokeStyle };
}

/** Render a single node and capture the DrawContext it receives. */
function renderAndCapture(setup: ReturnType<typeof createTestSetup>): DrawContext {
	let captured: DrawContext | null = null;
	class Capturer extends Node2D {
		override onDraw(ctx: DrawContext): void {
			captured = ctx;
		}
	}
	const node = new Capturer();
	setup.scene.addChild(node);
	setup.renderer.markRenderDirty();
	setup.renderer.render(setup.scene);
	if (!captured) throw new Error("DrawContext was not captured");
	// Remove so we don't pollute further renders
	setup.scene.removeChild(node);
	setup.renderer.markRenderDirty();
	return captured;
}

class VisualNode extends Node2D {
	drawCalled = false;
	override onDraw(_ctx: DrawContext): void {
		this.drawCalled = true;
	}
}

describe("Canvas2DRenderer", () => {
	it("nodes with visible = false are not drawn", () => {
		const { scene, renderer } = createTestSetup();
		const node = new VisualNode();
		node.visible = false;
		scene.addChild(node);
		renderer.markRenderDirty();
		renderer.render(scene);
		expect(node.drawCalled).toBe(false);
	});

	it("z-ordering: higher zIndex renders after lower", () => {
		const { scene, renderer } = createTestSetup();
		const order: string[] = [];

		class OrderedNode extends Node2D {
			label: string;
			constructor(label: string) {
				super();
				this.label = label;
			}
			override onDraw(_ctx: DrawContext): void {
				order.push(this.label);
			}
		}

		const a = new OrderedNode("a");
		a.zIndex = 2;
		const b = new OrderedNode("b");
		b.zIndex = 1;
		const c = new OrderedNode("c");
		c.zIndex = 3;
		scene.addChild(a);
		scene.addChild(b);
		scene.addChild(c);

		renderer.markRenderDirty();
		renderer.render(scene);
		expect(order).toEqual(["b", "a", "c"]);
	});

	it("same zIndex preserves tree order (stable sort)", () => {
		const { scene, renderer } = createTestSetup();
		const order: string[] = [];

		class OrderedNode extends Node2D {
			label: string;
			constructor(label: string) {
				super();
				this.label = label;
			}
			override onDraw(_ctx: DrawContext): void {
				order.push(this.label);
			}
		}

		const a = new OrderedNode("first");
		const b = new OrderedNode("second");
		const c = new OrderedNode("third");
		scene.addChild(a);
		scene.addChild(b);
		scene.addChild(c);

		renderer.markRenderDirty();
		renderer.render(scene);
		expect(order).toEqual(["first", "second", "third"]);
	});

	it("invisible parent skips entire subtree", () => {
		const { scene, renderer } = createTestSetup();
		const parent = new Node2D();
		parent.visible = false;
		const child = new VisualNode();
		parent.addChild(child);
		scene.addChild(parent);

		renderer.markRenderDirty();
		renderer.render(scene);
		expect(child.drawCalled).toBe(false);
	});

	it("nodes without onDraw override are not in render list", () => {
		const { scene, renderer } = createTestSetup();
		const logicNode = new Node2D(); // no onDraw override
		scene.addChild(logicNode);

		renderer.markRenderDirty();
		renderer.render(scene);
		// Logic node should not cause draw (we verify by no error)
	});

	it("nodes with onDraw override ARE in render list", () => {
		const { scene, renderer } = createTestSetup();
		const visual = new VisualNode();
		scene.addChild(visual);

		renderer.markRenderDirty();
		renderer.render(scene);
		expect(visual.drawCalled).toBe(true);
	});

	it("render list is reused between frames", () => {
		const { scene, renderer } = createTestSetup();
		const node = new VisualNode();
		scene.addChild(node);

		renderer.markRenderDirty();
		renderer.render(scene);
		expect(renderer.renderListDirty).toBe(false);

		// Second render without marking dirty should reuse list
		node.drawCalled = false;
		renderer.render(scene);
		expect(node.drawCalled).toBe(true);
	});

	it("render list is re-sorted when renderListDirty is set", () => {
		const { scene, renderer } = createTestSetup();
		const order: string[] = [];

		class OrderedNode extends Node2D {
			label: string;
			constructor(label: string) {
				super();
				this.label = label;
			}
			override onDraw(_ctx: DrawContext): void {
				order.push(this.label);
			}
		}

		const a = new OrderedNode("a");
		a.zIndex = 1;
		const b = new OrderedNode("b");
		b.zIndex = 2;
		scene.addChild(a);
		scene.addChild(b);

		renderer.markRenderDirty();
		renderer.render(scene);
		expect(order).toEqual(["a", "b"]);

		// Swap z-order
		order.length = 0;
		a.zIndex = 3;
		renderer.markRenderDirty();
		renderer.render(scene);
		expect(order).toEqual(["b", "a"]);
	});
});

// ─── T2a: Canvas2DDrawContext primitives ─────────────────────────────────────

describe("Canvas2DDrawContext", () => {
	describe("line()", () => {
		it("calls beginPath, moveTo, lineTo, stroke with correct coordinates", () => {
			const setup = createTestSetup();
			const draw = renderAndCapture(setup);
			const { ctx } = setup;

			const beginPath = vi.spyOn(ctx, "beginPath");
			const moveTo = vi.spyOn(ctx, "moveTo");
			const lineTo = vi.spyOn(ctx, "lineTo");
			const stroke = vi.spyOn(ctx, "stroke");

			draw.line(new Vec2(10, 20), new Vec2(30, 40));

			expect(beginPath).toHaveBeenCalled();
			expect(moveTo).toHaveBeenCalledWith(10, 20);
			expect(lineTo).toHaveBeenCalledWith(30, 40);
			expect(stroke).toHaveBeenCalled();
		});

		it("applies default white color and width 1", () => {
			const setup = createTestSetup();
			const draw = renderAndCapture(setup);
			const { ctx } = setup;
			const { setStrokeStyle } = spyOnStyleSetters(ctx);

			draw.line(new Vec2(0, 0), new Vec2(1, 1));

			expect(setStrokeStyle).toHaveBeenCalledWith(Color.WHITE.toCSS());
			expect(ctx.lineWidth).toBe(1);
		});

		it("applies custom color and width", () => {
			const setup = createTestSetup();
			const draw = renderAndCapture(setup);
			const { ctx } = setup;
			const { setStrokeStyle } = spyOnStyleSetters(ctx);

			const red = new Color(1, 0, 0, 1);
			draw.line(new Vec2(0, 0), new Vec2(1, 1), { color: red, width: 3 });

			expect(setStrokeStyle).toHaveBeenCalledWith(red.toCSS());
			expect(ctx.lineWidth).toBe(3);
		});
	});

	describe("rect()", () => {
		it("with fill calls fillRect", () => {
			const setup = createTestSetup();
			const draw = renderAndCapture(setup);
			const { ctx } = setup;
			const fillRect = vi.spyOn(ctx, "fillRect");
			const { setFillStyle } = spyOnStyleSetters(ctx);

			const blue = new Color(0, 0, 1, 1);
			draw.rect(new Vec2(5, 10), new Vec2(50, 60), { fill: blue });

			expect(setFillStyle).toHaveBeenCalledWith(blue.toCSS());
			expect(fillRect).toHaveBeenCalledWith(5, 10, 50, 60);
		});

		it("with stroke calls strokeRect", () => {
			const setup = createTestSetup();
			const draw = renderAndCapture(setup);
			const { ctx } = setup;
			const strokeRect = vi.spyOn(ctx, "strokeRect");
			const { setStrokeStyle } = spyOnStyleSetters(ctx);

			const green = new Color(0, 1, 0, 1);
			draw.rect(new Vec2(5, 10), new Vec2(50, 60), { stroke: green, strokeWidth: 2 });

			expect(setStrokeStyle).toHaveBeenCalledWith(green.toCSS());
			expect(ctx.lineWidth).toBe(2);
			expect(strokeRect).toHaveBeenCalledWith(5, 10, 50, 60);
		});

		it("with fill + stroke applies both", () => {
			const setup = createTestSetup();
			const draw = renderAndCapture(setup);
			const { ctx } = setup;
			const fillRect = vi.spyOn(ctx, "fillRect");
			const strokeRect = vi.spyOn(ctx, "strokeRect");

			const red = new Color(1, 0, 0, 1);
			const blue = new Color(0, 0, 1, 1);
			draw.rect(new Vec2(0, 0), new Vec2(100, 100), { fill: red, stroke: blue, strokeWidth: 4 });

			expect(fillRect).toHaveBeenCalledWith(0, 0, 100, 100);
			expect(strokeRect).toHaveBeenCalledWith(0, 0, 100, 100);
		});

		it("with no style does nothing", () => {
			const setup = createTestSetup();
			const draw = renderAndCapture(setup);
			const { ctx } = setup;
			const fillRect = vi.spyOn(ctx, "fillRect");
			const strokeRect = vi.spyOn(ctx, "strokeRect");

			draw.rect(new Vec2(0, 0), new Vec2(10, 10));

			expect(fillRect).not.toHaveBeenCalled();
			expect(strokeRect).not.toHaveBeenCalled();
		});
	});

	describe("circle()", () => {
		it("with fill calls arc + fill", () => {
			const setup = createTestSetup();
			const draw = renderAndCapture(setup);
			const { ctx } = setup;
			const arc = vi.spyOn(ctx, "arc");
			const fill = vi.spyOn(ctx, "fill");
			const { setFillStyle } = spyOnStyleSetters(ctx);

			const yellow = new Color(1, 1, 0, 1);
			draw.circle(new Vec2(50, 50), 25, { fill: yellow });

			expect(arc).toHaveBeenCalledWith(50, 50, 25, 0, Math.PI * 2);
			expect(setFillStyle).toHaveBeenCalledWith(yellow.toCSS());
			expect(fill).toHaveBeenCalled();
		});

		it("with stroke calls arc + stroke", () => {
			const setup = createTestSetup();
			const draw = renderAndCapture(setup);
			const { ctx } = setup;
			const arc = vi.spyOn(ctx, "arc");
			const stroke = vi.spyOn(ctx, "stroke");
			const { setStrokeStyle } = spyOnStyleSetters(ctx);

			const red = new Color(1, 0, 0, 1);
			draw.circle(new Vec2(30, 40), 10, { stroke: red, strokeWidth: 3 });

			expect(arc).toHaveBeenCalledWith(30, 40, 10, 0, Math.PI * 2);
			expect(setStrokeStyle).toHaveBeenCalledWith(red.toCSS());
			expect(ctx.lineWidth).toBe(3);
			expect(stroke).toHaveBeenCalled();
		});
	});

	describe("polygon()", () => {
		it("draws moveTo + lineTo for each point, then closePath", () => {
			const setup = createTestSetup();
			const draw = renderAndCapture(setup);
			const { ctx } = setup;
			const beginPath = vi.spyOn(ctx, "beginPath");
			const moveTo = vi.spyOn(ctx, "moveTo");
			const lineTo = vi.spyOn(ctx, "lineTo");
			const closePath = vi.spyOn(ctx, "closePath");

			const pts = [new Vec2(0, 0), new Vec2(10, 0), new Vec2(5, 10)];
			draw.polygon(pts, { fill: Color.WHITE });

			expect(beginPath).toHaveBeenCalled();
			expect(moveTo).toHaveBeenCalledWith(0, 0);
			expect(lineTo).toHaveBeenCalledWith(10, 0);
			expect(lineTo).toHaveBeenCalledWith(5, 10);
			expect(closePath).toHaveBeenCalled();
		});

		it("with < 2 points does early return", () => {
			const setup = createTestSetup();
			const draw = renderAndCapture(setup);
			const { ctx } = setup;
			const beginPath = vi.spyOn(ctx, "beginPath");

			draw.polygon([new Vec2(0, 0)]);

			expect(beginPath).not.toHaveBeenCalled();
		});

		it("with fill + stroke applies both", () => {
			const setup = createTestSetup();
			const draw = renderAndCapture(setup);
			const { ctx } = setup;
			const fill = vi.spyOn(ctx, "fill");
			const stroke = vi.spyOn(ctx, "stroke");

			const pts = [new Vec2(0, 0), new Vec2(10, 0), new Vec2(5, 10)];
			draw.polygon(pts, { fill: Color.WHITE, stroke: Color.WHITE });

			expect(fill).toHaveBeenCalled();
			expect(stroke).toHaveBeenCalled();
		});
	});

	describe("text()", () => {
		it("sets font, fillStyle, textAlign, textBaseline, calls fillText", () => {
			const setup = createTestSetup();
			const draw = renderAndCapture(setup);
			const { ctx } = setup;
			const fillText = vi.spyOn(ctx, "fillText");
			const { setFillStyle } = spyOnStyleSetters(ctx);

			const red = new Color(1, 0, 0, 1);
			draw.text("hello", new Vec2(10, 20), {
				font: "monospace",
				size: 24,
				color: red,
				align: "center",
				baseline: "middle",
			});

			expect(ctx.font).toBe("24px monospace");
			expect(setFillStyle).toHaveBeenCalledWith(red.toCSS());
			expect(ctx.textAlign).toBe("center");
			expect(ctx.textBaseline).toBe("middle");
			expect(fillText).toHaveBeenCalledWith("hello", 10, 20);
		});

		it("uses defaults when no style is provided", () => {
			const setup = createTestSetup();
			const draw = renderAndCapture(setup);
			const { ctx } = setup;
			const fillText = vi.spyOn(ctx, "fillText");
			const { setFillStyle } = spyOnStyleSetters(ctx);

			draw.text("test", new Vec2(0, 0));

			expect(ctx.font).toBe("16px sans-serif");
			expect(setFillStyle).toHaveBeenCalledWith(Color.WHITE.toCSS());
			expect(ctx.textAlign).toBe("left");
			expect(ctx.textBaseline).toBe("top");
			expect(fillText).toHaveBeenCalledWith("test", 0, 0);
		});
	});

	describe("measureText()", () => {
		it("returns Vec2 with measured width and font size height", () => {
			const setup = createTestSetup();
			const draw = renderAndCapture(setup);
			const { ctx } = setup;

			// jsdom's measureText returns { width: 0 } by default
			vi.spyOn(ctx, "measureText").mockReturnValue({ width: 42 } as TextMetrics);

			const result = draw.measureText("hello", { size: 20, font: "serif" });

			expect(ctx.font).toBe("20px serif");
			expect(result).toBeInstanceOf(Vec2);
			expect(result.x).toBe(42);
			expect(result.y).toBe(20);
		});

		it("uses default size 16 and sans-serif when no style", () => {
			const setup = createTestSetup();
			const draw = renderAndCapture(setup);
			const { ctx } = setup;

			vi.spyOn(ctx, "measureText").mockReturnValue({ width: 10 } as TextMetrics);

			const result = draw.measureText("x");

			expect(ctx.font).toBe("16px sans-serif");
			expect(result.y).toBe(16);
		});
	});

	describe("image()", () => {
		function createMockImage(width = 64, height = 64): ImageBitmap {
			return { width, height } as unknown as ImageBitmap;
		}

		it("draws image at position with correct dimensions", () => {
			const setup = createTestSetup();
			const draw = renderAndCapture(setup);
			const { ctx, assets } = setup;
			const drawImage = vi.spyOn(ctx, "drawImage").mockImplementation(() => {});
			const img = createMockImage(32, 32);
			vi.spyOn(assets, "getImage").mockReturnValue(img);

			draw.image("sprite.png", new Vec2(10, 20));

			expect(drawImage).toHaveBeenCalledWith(img, 10, 20, 32, 32);
		});

		it("with sourceRect calls 9-arg drawImage", () => {
			const setup = createTestSetup();
			const draw = renderAndCapture(setup);
			const { ctx, assets } = setup;
			const drawImage = vi.spyOn(ctx, "drawImage").mockImplementation(() => {});
			const img = createMockImage(128, 128);
			vi.spyOn(assets, "getImage").mockReturnValue(img);

			const srcRect = new Rect(16, 16, 32, 32);
			draw.image("sheet.png", new Vec2(0, 0), { sourceRect: srcRect });

			expect(drawImage).toHaveBeenCalledWith(img, 16, 16, 32, 32, 0, 0, 32, 32);
		});

		it("with flipH applies negative x-scale transform", () => {
			const setup = createTestSetup();
			const draw = renderAndCapture(setup);
			const { ctx, assets } = setup;
			const drawImage = vi.spyOn(ctx, "drawImage").mockImplementation(() => {});
			const scale = vi.spyOn(ctx, "scale");
			const translate = vi.spyOn(ctx, "translate");
			const img = createMockImage(32, 32);
			vi.spyOn(assets, "getImage").mockReturnValue(img);

			draw.image("sprite.png", new Vec2(10, 20), { flipH: true });

			expect(translate).toHaveBeenCalledWith(10 + 32, 20);
			expect(scale).toHaveBeenCalledWith(-1, 1);
			// drawX should be 0 (flipped coordinate space), drawY stays 20
			expect(drawImage).toHaveBeenCalledWith(img, 0, 20, 32, 32);
		});

		it("with flipV applies negative y-scale transform", () => {
			const setup = createTestSetup();
			const draw = renderAndCapture(setup);
			const { ctx, assets } = setup;
			const drawImage = vi.spyOn(ctx, "drawImage").mockImplementation(() => {});
			const scale = vi.spyOn(ctx, "scale");
			const translate = vi.spyOn(ctx, "translate");
			const img = createMockImage(32, 32);
			vi.spyOn(assets, "getImage").mockReturnValue(img);

			draw.image("sprite.png", new Vec2(10, 20), { flipV: true });

			expect(translate).toHaveBeenCalledWith(10, 20 + 32);
			expect(scale).toHaveBeenCalledWith(1, -1);
			expect(drawImage).toHaveBeenCalledWith(img, 10, 0, 32, 32);
		});

		it("with flipH + flipV applies combined flip", () => {
			const setup = createTestSetup();
			const draw = renderAndCapture(setup);
			const { ctx, assets } = setup;
			const drawImage = vi.spyOn(ctx, "drawImage").mockImplementation(() => {});
			const scale = vi.spyOn(ctx, "scale");
			const translate = vi.spyOn(ctx, "translate");
			const img = createMockImage(32, 32);
			vi.spyOn(assets, "getImage").mockReturnValue(img);

			draw.image("sprite.png", new Vec2(10, 20), { flipH: true, flipV: true });

			expect(translate).toHaveBeenCalledWith(10 + 32, 20 + 32);
			expect(scale).toHaveBeenCalledWith(-1, -1);
			// Both drawX and drawY should be 0
			expect(drawImage).toHaveBeenCalledWith(img, 0, 0, 32, 32);
		});

		it("with unknown asset does early return, no drawImage", () => {
			const setup = createTestSetup();
			const draw = renderAndCapture(setup);
			const { ctx, assets } = setup;
			const drawImage = vi.spyOn(ctx, "drawImage").mockImplementation(() => {});
			vi.spyOn(assets, "getImage").mockReturnValue(null);

			draw.image("nonexistent.png", new Vec2(0, 0));

			expect(drawImage).not.toHaveBeenCalled();
		});

		it("with custom width/height overrides source dimensions", () => {
			const setup = createTestSetup();
			const draw = renderAndCapture(setup);
			const { ctx, assets } = setup;
			const drawImage = vi.spyOn(ctx, "drawImage").mockImplementation(() => {});
			const img = createMockImage(32, 32);
			vi.spyOn(assets, "getImage").mockReturnValue(img);

			draw.image("sprite.png", new Vec2(0, 0), { width: 64, height: 64 });

			expect(drawImage).toHaveBeenCalledWith(img, 0, 0, 64, 64);
		});
	});

	describe("save() / restore()", () => {
		it("delegates to canvas context", () => {
			const setup = createTestSetup();
			const draw = renderAndCapture(setup);
			const { ctx } = setup;
			const save = vi.spyOn(ctx, "save");
			const restore = vi.spyOn(ctx, "restore");

			draw.save();
			draw.restore();

			expect(save).toHaveBeenCalled();
			expect(restore).toHaveBeenCalled();
		});
	});

	describe("setAlpha()", () => {
		it("sets ctx.globalAlpha", () => {
			const setup = createTestSetup();
			const draw = renderAndCapture(setup);
			const { ctx } = setup;

			draw.setAlpha(0.5);

			expect(ctx.globalAlpha).toBe(0.5);
		});
	});
});

// ─── T2b: Render pipeline edge cases ────────────────────────────────────────

describe("Canvas2DRenderer (pipeline edge cases)", () => {
	it("render() applies globalTransform via setTransform", () => {
		const setup = createTestSetup();
		const { ctx, scene, renderer } = setup;
		const setTransform = vi.spyOn(ctx, "setTransform");

		class Positioned extends Node2D {
			override onDraw(_ctx: DrawContext): void {}
		}
		const node = new Positioned();
		node.position = new Vec2(100, 200);
		scene.addChild(node);

		renderer.markRenderDirty();
		renderer.render(scene);

		// globalTransform for a node at (100,200) with no rotation/scale is identity + translation
		expect(setTransform).toHaveBeenCalledWith(1, 0, 0, 1, 100, 200);
	});

	it("render() exception in onDraw does not prevent other nodes from rendering", () => {
		const setup = createTestSetup();
		const { scene, renderer } = setup;
		const drawOrder: string[] = [];

		class Crashing extends Node2D {
			override onDraw(_ctx: DrawContext): void {
				throw new Error("crash");
			}
		}
		class Good extends Node2D {
			label: string;
			constructor(label: string) {
				super();
				this.label = label;
			}
			override onDraw(_ctx: DrawContext): void {
				drawOrder.push(this.label);
			}
		}

		const a = new Good("before");
		a.zIndex = 0;
		const crash = new Crashing();
		crash.zIndex = 1;
		const b = new Good("after");
		b.zIndex = 2;
		scene.addChild(a);
		scene.addChild(crash);
		scene.addChild(b);

		renderer.markRenderDirty();
		renderer.render(scene);

		expect(drawOrder).toEqual(["before", "after"]);
	});

	it("empty scene render clears canvas without errors", () => {
		const setup = createTestSetup();
		const { ctx, scene, renderer } = setup;
		const clearRect = vi.spyOn(ctx, "clearRect");
		const fillRect = vi.spyOn(ctx, "fillRect");

		renderer.markRenderDirty();
		renderer.render(scene);

		expect(clearRect).toHaveBeenCalledWith(0, 0, 200, 200);
		expect(fillRect).toHaveBeenCalledWith(0, 0, 200, 200);
	});
});
