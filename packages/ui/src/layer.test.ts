import { Node2D } from "@quintus/core";
import { describe, expect, it } from "vitest";
import { Layer } from "./layer.js";

describe("Layer", () => {
	it("fixed getter/setter propagates to children", () => {
		const layer = new Layer();
		const child = new Node2D();
		layer.add(child);

		layer.fixed = true;
		expect(layer.renderFixed).toBe(true);
		expect(child.renderFixed).toBe(true);

		layer.fixed = false;
		expect(layer.renderFixed).toBe(false);
		expect(child.renderFixed).toBe(false);
	});

	it("new children inherit renderFixed", () => {
		const layer = new Layer();
		layer.fixed = true;

		const child = new Node2D();
		layer.add(child);
		expect(child.renderFixed).toBe(true);
	});

	it("propagates to grandchildren", () => {
		const layer = new Layer();
		const child = new Node2D();
		const grandchild = new Node2D();
		child.add(grandchild);
		layer.add(child);

		layer.fixed = true;
		expect(grandchild.renderFixed).toBe(true);
	});

	it("nested Layer stops propagation", () => {
		const outer = new Layer();
		const inner = new Layer();
		const innerChild = new Node2D();

		inner.add(innerChild);
		outer.add(inner);

		// Inner layer has its own fixed = false
		inner.fixed = false;

		// Set outer to fixed
		outer.fixed = true;

		// Inner layer's renderFixed gets set, but inner's children
		// are NOT propagated because inner is a Layer (manages its own)
		expect(outer.renderFixed).toBe(true);
		expect(inner.renderFixed).toBe(true);
		// Inner's children are NOT affected by outer's propagation
		// because Layer stops recursion at nested Layer boundaries
		expect(innerChild.renderFixed).toBe(false);
	});

	it("default renderFixed is false", () => {
		const layer = new Layer();
		expect(layer.renderFixed).toBe(false);
		expect(layer.fixed).toBe(false);
	});

	it("add with class constructor works", () => {
		const layer = new Layer();
		layer.fixed = true;
		const child = layer.add(Node2D);
		expect(child).toBeInstanceOf(Node2D);
		expect(child.renderFixed).toBe(true);
	});

	it("add() propagates renderFixed to children", () => {
		const layer = new Layer();
		layer.fixed = true;

		const child = new Node2D();
		layer.add(child);
		expect(child.renderFixed).toBe(true);
	});

	it("add() with class constructor propagates renderFixed", () => {
		const layer = new Layer();
		layer.fixed = true;
		const child = layer.add(Node2D);
		expect(child).toBeInstanceOf(Node2D);
		expect(child.renderFixed).toBe(true);
	});
});
