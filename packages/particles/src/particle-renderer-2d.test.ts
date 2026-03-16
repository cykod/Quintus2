import { SeededRandom } from "@quintus/math";
import { describe, expect, it, vi } from "vitest";
import { resolveConfig } from "./particle-config.js";
import { ParticleRenderer2D } from "./particle-renderer-2d.js";
import { ParticleSimulator } from "./particle-simulator.js";

function mockCtx() {
	return {
		save: vi.fn(),
		restore: vi.fn(),
		beginPath: vi.fn(),
		arc: vi.fn(),
		fill: vi.fn(),
		fillRect: vi.fn(),
		moveTo: vi.fn(),
		lineTo: vi.fn(),
		closePath: vi.fn(),
		translate: vi.fn(),
		rotate: vi.fn(),
		drawImage: vi.fn(),
		fillStyle: "",
		globalCompositeOperation: "source-over",
	} as unknown as CanvasRenderingContext2D;
}

describe("ParticleRenderer2D", () => {
	it("renders circle particles using arc()", () => {
		const sim = new ParticleSimulator(100);
		const rng = new SeededRandom(1);
		const config = resolveConfig({ shape: "circle" });

		sim.burst(config, 5, 100, 100, rng);

		const renderer = new ParticleRenderer2D();
		const ctx = mockCtx();
		renderer.render(sim.pool, config, ctx, null);

		expect(ctx.arc).toHaveBeenCalledTimes(5);
		expect(ctx.fill).toHaveBeenCalledTimes(5);
	});

	it("renders rect particles using fillRect()", () => {
		const sim = new ParticleSimulator(100);
		const rng = new SeededRandom(1);
		const config = resolveConfig({ shape: "rect" });

		sim.burst(config, 3, 0, 0, rng);

		const renderer = new ParticleRenderer2D();
		const ctx = mockCtx();
		renderer.render(sim.pool, config, ctx, null);

		expect(ctx.fillRect).toHaveBeenCalledTimes(3);
	});

	it("renders triangle particles using moveTo/lineTo", () => {
		const sim = new ParticleSimulator(100);
		const rng = new SeededRandom(1);
		const config = resolveConfig({ shape: "triangle" });

		sim.burst(config, 2, 0, 0, rng);

		const renderer = new ParticleRenderer2D();
		const ctx = mockCtx();
		renderer.render(sim.pool, config, ctx, null);

		expect(ctx.moveTo).toHaveBeenCalledTimes(2);
		expect(ctx.closePath).toHaveBeenCalledTimes(2);
	});

	it("sets additive blend mode", () => {
		const sim = new ParticleSimulator(100);
		const rng = new SeededRandom(1);
		const config = resolveConfig({ blendMode: "additive" });

		sim.burst(config, 1, 0, 0, rng);

		const renderer = new ParticleRenderer2D();
		const ctx = mockCtx();
		renderer.render(sim.pool, config, ctx, null);

		expect(ctx.globalCompositeOperation).toBe("lighter");
	});

	it("sets normal blend mode by default", () => {
		const sim = new ParticleSimulator(100);
		const rng = new SeededRandom(1);
		const config = resolveConfig({});

		sim.burst(config, 1, 0, 0, rng);

		const renderer = new ParticleRenderer2D();
		const ctx = mockCtx();
		renderer.render(sim.pool, config, ctx, null);

		expect(ctx.globalCompositeOperation).toBe("source-over");
	});

	it("skips rendering when no alive particles", () => {
		const sim = new ParticleSimulator(100);
		const config = resolveConfig({});

		const renderer = new ParticleRenderer2D();
		const ctx = mockCtx();
		renderer.render(sim.pool, config, ctx, null);

		expect(ctx.save).not.toHaveBeenCalled();
	});

	it("uses uniform color fast path when colorStart equals colorEnd", () => {
		const sim = new ParticleSimulator(100);
		const rng = new SeededRandom(1);
		const config = resolveConfig({
			colorStart: "#ff0000",
			colorEnd: "#ff0000",
		});

		sim.burst(config, 3, 0, 0, rng);

		const renderer = new ParticleRenderer2D();
		const ctx = mockCtx();
		renderer.render(sim.pool, config, ctx, null);

		// fillStyle set once (uniform), not per particle
		expect(config._uniformColor).not.toBeNull();
	});

	it("applies rotation for rect particles", () => {
		const sim = new ParticleSimulator(100);
		const rng = new SeededRandom(1);
		const config = resolveConfig({
			shape: "rect",
			initialRotation: 45,
		});

		sim.burst(config, 1, 0, 0, rng);

		const renderer = new ParticleRenderer2D();
		const ctx = mockCtx();
		renderer.render(sim.pool, config, ctx, null);

		// When rotation is non-zero, uses translate+rotate instead of plain fillRect
		expect(ctx.translate).toHaveBeenCalled();
		expect(ctx.rotate).toHaveBeenCalled();
	});

	it("calls save/restore for the render batch", () => {
		const sim = new ParticleSimulator(100);
		const rng = new SeededRandom(1);
		const config = resolveConfig({});

		sim.burst(config, 1, 0, 0, rng);

		const renderer = new ParticleRenderer2D();
		const ctx = mockCtx();
		renderer.render(sim.pool, config, ctx, null);

		expect(ctx.save).toHaveBeenCalledTimes(1);
		expect(ctx.restore).toHaveBeenCalledTimes(1);
	});
});
