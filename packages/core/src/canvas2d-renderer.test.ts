import { describe, expect, it } from "vitest";
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
	const scene = new Scene("test", game);
	const assets = new AssetLoader();
	const renderer = new Canvas2DRenderer(canvas, 200, 200, "#000000", assets);
	return { canvas, game, scene, renderer };
}

class VisualNode extends Node2D {
	override hasVisualContent = true;
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
			override hasVisualContent = true;
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
			override hasVisualContent = true;
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

	it("hasVisualContent = false nodes are not in render list", () => {
		const { scene, renderer } = createTestSetup();
		const logicNode = new Node2D(); // hasVisualContent = false by default
		scene.addChild(logicNode);

		renderer.markRenderDirty();
		renderer.render(scene);
		// Logic node should not cause draw (we verify by no error)
	});

	it("hasVisualContent = true nodes ARE in render list", () => {
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
			override hasVisualContent = true;
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
