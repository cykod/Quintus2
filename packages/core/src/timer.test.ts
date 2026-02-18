import { describe, expect, it, vi } from "vitest";
import { Game } from "./game.js";
import { Scene } from "./scene.js";
import { Timer } from "./timer.js";

function createTestSetup() {
	const canvas = document.createElement("canvas");
	canvas.width = 200;
	canvas.height = 200;
	const game = new Game({ width: 200, height: 200, canvas });
	const scene = new Scene(game);
	return { game, scene };
}

describe("Timer", () => {
	it("fires after duration", () => {
		const { scene } = createTestSetup();
		const timer = new Timer();
		timer.duration = 0.5;
		scene.addChild(timer);

		const handler = vi.fn();
		timer.timeout.connect(handler);

		timer.start();
		timer.onFixedUpdate(0.3);
		expect(handler).not.toHaveBeenCalled();

		timer.onFixedUpdate(0.2);
		expect(handler).toHaveBeenCalledTimes(1);
	});

	it("does not fire when not started", () => {
		const { scene } = createTestSetup();
		const timer = new Timer();
		timer.duration = 0.5;
		scene.addChild(timer);

		const handler = vi.fn();
		timer.timeout.connect(handler);

		timer.onFixedUpdate(1.0);
		expect(handler).not.toHaveBeenCalled();
		expect(timer.running).toBe(false);
	});

	it("with repeat fires multiple times", () => {
		const { scene } = createTestSetup();
		const timer = new Timer();
		timer.duration = 0.5;
		timer.repeat = true;
		scene.addChild(timer);

		const handler = vi.fn();
		timer.timeout.connect(handler);

		timer.start();
		timer.onFixedUpdate(0.5);
		expect(handler).toHaveBeenCalledTimes(1);

		timer.onFixedUpdate(0.5);
		expect(handler).toHaveBeenCalledTimes(2);

		timer.onFixedUpdate(0.5);
		expect(handler).toHaveBeenCalledTimes(3);
		expect(timer.running).toBe(true);
	});

	it("with autostart begins in onReady", () => {
		const { scene } = createTestSetup();
		const timer = new Timer();
		timer.duration = 1;
		timer.autostart = true;

		expect(timer.running).toBe(false);
		scene.addChild(timer); // triggers onReady
		expect(timer.running).toBe(true);
	});

	it("stop() resets and prevents firing", () => {
		const { scene } = createTestSetup();
		const timer = new Timer();
		timer.duration = 1;
		scene.addChild(timer);

		const handler = vi.fn();
		timer.timeout.connect(handler);

		timer.start();
		timer.onFixedUpdate(0.5);
		timer.stop();

		expect(timer.running).toBe(false);
		timer.onFixedUpdate(0.5);
		expect(handler).not.toHaveBeenCalled();
	});

	it("timeLeft decreases correctly", () => {
		const { scene } = createTestSetup();
		const timer = new Timer();
		timer.duration = 1;
		scene.addChild(timer);

		timer.start();
		expect(timer.timeLeft).toBe(1);

		timer.onFixedUpdate(0.3);
		expect(timer.timeLeft).toBeCloseTo(0.7);

		timer.onFixedUpdate(0.5);
		expect(timer.timeLeft).toBeCloseTo(0.2);
	});

	it("duration override via start(newDuration)", () => {
		const { scene } = createTestSetup();
		const timer = new Timer();
		timer.duration = 2;
		scene.addChild(timer);

		const handler = vi.fn();
		timer.timeout.connect(handler);

		timer.start(0.5);
		expect(timer.duration).toBe(0.5);

		timer.onFixedUpdate(0.5);
		expect(handler).toHaveBeenCalledTimes(1);
	});

	it("excess time carries over on repeat (no drift)", () => {
		const { scene } = createTestSetup();
		const timer = new Timer();
		timer.duration = 0.5;
		timer.repeat = true;
		scene.addChild(timer);

		const handler = vi.fn();
		timer.timeout.connect(handler);

		timer.start();
		// Overshoot by 0.1 — elapsed should carry over to 0.1
		timer.onFixedUpdate(0.6);
		expect(handler).toHaveBeenCalledTimes(1);

		// Only 0.4 more needed to fire again (0.1 carried + 0.4 = 0.5)
		timer.onFixedUpdate(0.4);
		expect(handler).toHaveBeenCalledTimes(2);
	});
});
