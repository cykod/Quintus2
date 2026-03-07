import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("three", () => import("./__test-utils__/three-mock.js"));

import { ThreeContext } from "./three-context.js";

describe("ThreeContext", () => {
	let canvas: HTMLCanvasElement;

	beforeEach(() => {
		canvas = document.createElement("canvas");
	});

	it("creates scene and renderer", () => {
		const ctx = new ThreeContext(canvas, 800, 600);
		expect(ctx.scene).toBeDefined();
		expect(ctx.webglRenderer).toBeDefined();
		expect(ctx.activeCamera).toBeNull();
		expect(ctx.hybridMode).toBe(false);
	});

	it("sets hybrid mode", () => {
		const ctx = new ThreeContext(canvas, 800, 600, {}, true);
		expect(ctx.hybridMode).toBe(true);
	});

	it("applies background color", () => {
		const ctx = new ThreeContext(canvas, 800, 600, { background: 0xff0000 });
		expect(ctx.scene.background).not.toBeNull();
	});

	it("enables shadows", () => {
		const ctx = new ThreeContext(canvas, 800, 600, { shadows: true });
		expect(ctx.webglRenderer.shadowMap.enabled).toBe(true);
	});

	it("applies tone mapping", () => {
		const ctx = new ThreeContext(canvas, 800, 600, { toneMapping: 3 });
		expect(ctx.webglRenderer.toneMapping).toBe(3);
	});

	it("dispose is idempotent", () => {
		const ctx = new ThreeContext(canvas, 800, 600);
		ctx.dispose();
		ctx.dispose(); // should not throw
	});
});
