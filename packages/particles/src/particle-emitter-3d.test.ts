import { describe, expect, it, vi } from "vitest";

vi.mock("three", () => import("@quintus/three/__test-utils__/three-mock.js"));

import { ParticleEmitter3D } from "./particle-emitter-3d.js";

// Minimal game mock with random and input
function mockGame() {
	return {
		random: {
			next: () => 0.5,
			float: (min: number, max: number) => min + (max - min) * 0.5,
		},
	};
}

function createEmitter(config = {}) {
	const emitter = new ParticleEmitter3D(config);
	// Inject mock game
	Object.defineProperty(emitter, "game", { get: () => mockGame() });
	return emitter;
}

describe("ParticleEmitter3D", () => {
	it("creates a THREE.Points object3d", () => {
		const emitter = createEmitter();
		const obj = emitter.object3d;
		expect(obj).toBeDefined();
		// The mock Points has geometry and material
		expect((obj as { geometry: unknown }).geometry).toBeDefined();
		expect((obj as { material: unknown }).material).toBeDefined();
	});

	it("starts with 0 alive particles", () => {
		const emitter = createEmitter();
		expect(emitter.aliveCount).toBe(0);
	});

	it("isFinished is true when not emitting and no particles alive", () => {
		const emitter = createEmitter();
		emitter.emitting = false;
		expect(emitter.isFinished).toBe(true);
	});

	it("emits particles on fixedUpdate", () => {
		const emitter = createEmitter({ emissionRate: 1000, maxParticles: 100 });
		emitter.onFixedUpdate(1 / 60);
		expect(emitter.aliveCount).toBeGreaterThan(0);
	});

	it("burst() emits particles immediately", () => {
		const emitter = createEmitter({ maxParticles: 50 });
		emitter.burst(10);
		expect(emitter.aliveCount).toBe(10);
	});

	it("restart() resets particles", () => {
		const emitter = createEmitter({ maxParticles: 50 });
		emitter.burst(10);
		expect(emitter.aliveCount).toBe(10);
		emitter.restart();
		expect(emitter.aliveCount).toBe(0);
		expect(emitter.emitting).toBe(true);
	});

	it("config setter re-resolves config", () => {
		const emitter = createEmitter({ maxParticles: 50 });
		emitter.config = { maxParticles: 200 };
		expect(emitter.config.maxParticles).toBe(200);
	});

	it("onUpdate syncs buffers and sets draw range", () => {
		const emitter = createEmitter({ emissionRate: 1000, maxParticles: 100 });
		// Trigger object3d creation
		const obj = emitter.object3d;
		emitter.onFixedUpdate(1 / 60);
		emitter.onUpdate();

		const geom = (obj as { geometry: { drawRangeCount?: number } }).geometry;
		// After sync, drawRange should match alive count
		expect(geom.drawRangeCount).toBeGreaterThan(0);
	});

	it("onDestroy disposes geometry and material", () => {
		const emitter = createEmitter();
		const obj = emitter.object3d;
		const geom = (obj as { geometry: { dispose: () => void } }).geometry;
		const mat = (obj as { material: { dispose: () => void } }).material;
		const geomDispose = vi.spyOn(geom, "dispose");
		const matDispose = vi.spyOn(mat, "dispose");

		emitter.onDestroy();
		expect(geomDispose).toHaveBeenCalled();
		expect(matDispose).toHaveBeenCalled();
	});

	it("oneShot emits finished signal and destroys", () => {
		const emitter = createEmitter({ maxParticles: 50, lifetime: 0.01 });
		emitter.oneShot = true;
		emitter.emitting = false;
		// No particles alive + not emitting + oneShot → should fire

		const finishedSpy = vi.fn();
		emitter.finished.connect(finishedSpy);

		const destroySpy = vi.spyOn(emitter, "destroy").mockImplementation(() => {});
		emitter.onFixedUpdate(1 / 60);

		expect(finishedSpy).toHaveBeenCalled();
		expect(destroySpy).toHaveBeenCalled();
	});

	it("uses ShaderMaterial with transparent and depthWrite settings", () => {
		const emitter = createEmitter({ blendMode: "additive" });
		const obj = emitter.object3d;
		const mat = (obj as { material: { transparent: boolean; depthWrite: boolean } }).material;
		expect(mat.transparent).toBe(true);
		expect(mat.depthWrite).toBe(false);
	});
});
