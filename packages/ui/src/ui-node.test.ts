import { Vec2 } from "@quintus/math";
import { describe, expect, it } from "vitest";
import { UINode } from "./ui-node.js";

describe("UINode", () => {
	it("renderFixed is true by default", () => {
		const node = new UINode();
		expect(node.renderFixed).toBe(true);
	});

	it("interactive is true by default", () => {
		const node = new UINode();
		expect(node.interactive).toBe(true);
	});

	it("containsPoint detects points inside bounds", () => {
		const node = new UINode();
		node.position = new Vec2(10, 20);
		node.width = 100;
		node.height = 50;
		// Force global transform to be computed (no parent)
		expect(node.containsPoint(50, 30)).toBe(true);
		expect(node.containsPoint(10, 20)).toBe(true);
		expect(node.containsPoint(110, 70)).toBe(true);
	});

	it("containsPoint rejects points outside bounds", () => {
		const node = new UINode();
		node.position = new Vec2(10, 20);
		node.width = 100;
		node.height = 50;
		expect(node.containsPoint(5, 30)).toBe(false);
		expect(node.containsPoint(50, 15)).toBe(false);
		expect(node.containsPoint(115, 30)).toBe(false);
	});

	it("size getter/setter", () => {
		const node = new UINode();
		node.size = new Vec2(200, 100);
		expect(node.width).toBe(200);
		expect(node.height).toBe(100);

		const s = node.size;
		expect(s.x).toBe(200);
		expect(s.y).toBe(100);
	});

	it("default width/height is 0", () => {
		const node = new UINode();
		expect(node.width).toBe(0);
		expect(node.height).toBe(0);
	});
});
