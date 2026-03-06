import { _resetNodeIdCounter, Game, Scene } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import { Actor, CollisionShape, PhysicsPlugin, Shape } from "@quintus/physics";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Bullet } from "./bullet.js";

class TestBullet extends Bullet {
	override onReady() {
		super.onReady();
		if (this.getShapes().length === 0) {
			this.add(CollisionShape).shape = Shape.rect(4, 4);
		}
	}
}

function setup() {
	_resetNodeIdCounter();
	const canvas = document.createElement("canvas");
	const game = new Game({ width: 200, height: 200, canvas, renderer: null });
	game.use(
		PhysicsPlugin({
			collisionGroups: {
				bullets: { collidesWith: ["targets"] },
				targets: { collidesWith: ["bullets"] },
			},
		}),
	);

	let bullet!: TestBullet;
	class TestScene extends Scene {
		override onReady() {
			bullet = this.add(TestBullet);
		}
	}
	game.registerScenes({ test: TestScene });
	game.start("test");
	game.step();

	return { game, bullet };
}

describe("Bullet", () => {
	beforeEach(() => _resetNodeIdCounter());

	it("has correct defaults", () => {
		const { bullet } = setup();
		expect(bullet.speed).toBe(400);
		expect(bullet.damage).toBe(25);
		expect(bullet.lifetime).toBe(3);
		expect(bullet.solid).toBe(false);
		expect(bullet.applyGravity).toBe(false);
	});

	it("does not move before fire()", () => {
		const { game, bullet } = setup();
		bullet.position._set(50, 50);
		game.step();
		expect(bullet.position.x).toBeCloseTo(50, 0);
		expect(bullet.position.y).toBeCloseTo(50, 0);
	});

	it("fires in the specified direction", () => {
		const { game, bullet } = setup();
		bullet.fire(new Vec2(100, 100), 0); // angle=0 → rightward
		for (let i = 0; i < 10; i++) game.step();
		expect(bullet.position.x).toBeGreaterThan(100);
		expect(bullet.position.y).toBeCloseTo(100, 0);
	});

	it("fires downward at PI/2", () => {
		const { game, bullet } = setup();
		bullet.fire(new Vec2(100, 50), Math.PI / 2);
		for (let i = 0; i < 10; i++) game.step();
		expect(bullet.position.y).toBeGreaterThan(50);
		expect(bullet.position.x).toBeCloseTo(100, 0);
	});

	it("applies overrides from fire()", () => {
		const { bullet } = setup();
		bullet.fire(new Vec2(0, 0), 0, { speed: 200, damage: 50, lifetime: 5 });
		expect(bullet.speed).toBe(200);
		expect(bullet.damage).toBe(50);
		expect(bullet.lifetime).toBe(5);
	});

	it("recycles after lifetime expires", () => {
		const { game, bullet } = setup();
		bullet.fire(new Vec2(100, 100), 0, { lifetime: 0.1 });
		// Run ~0.1s at 60fps = 6 frames, plus extra
		for (let i = 0; i < 12; i++) game.step();
		expect(bullet.isInsideTree).toBe(false);
	});

	it("does not expire when lifetime is 0", () => {
		const { game, bullet } = setup();
		bullet.fire(new Vec2(100, 100), 0, { lifetime: 0, speed: 1 });
		// Run many frames — should still exist (within bounds)
		for (let i = 0; i < 60; i++) game.step();
		expect(bullet.isInsideTree).toBe(true);
	});

	it("recycles when going off-screen", () => {
		const { game, bullet } = setup();
		// Fire rightward with high speed in a 200x200 game
		bullet.fire(new Vec2(190, 100), 0, { speed: 2000, lifetime: 0 });
		for (let i = 0; i < 5; i++) game.step();
		expect(bullet.isInsideTree).toBe(false);
	});

	it("calls releaser instead of destroy when set", () => {
		const { game, bullet } = setup();
		const releaser = vi.fn();
		bullet.setReleaser(releaser);
		bullet.fire(new Vec2(100, 100), 0, { lifetime: 0.05 });
		for (let i = 0; i < 10; i++) game.step();
		expect(releaser).toHaveBeenCalledWith(bullet);
	});

	it("emits hit signal on collision", () => {
		const { game, bullet } = setup();
		const hitHandler = vi.fn();
		bullet.hit.connect(hitHandler);

		// Add a target
		class Target extends Actor {
			override collisionGroup = "targets";
			override solid = true;
			override gravity = 0;
			override applyGravity = false;
		}
		const target = game.currentScene?.add(Target);
		target.position._set(120, 100);
		target.add(CollisionShape).shape = Shape.rect(40, 40);
		game.step();

		bullet.fire(new Vec2(100, 100), 0);
		for (let i = 0; i < 30; i++) game.step();

		expect(hitHandler).toHaveBeenCalled();
	});

	it("reset() restores defaults", () => {
		const { bullet } = setup();
		bullet.fire(new Vec2(10, 10), 1, { speed: 100, damage: 99, lifetime: 10 });
		bullet.reset();
		expect(bullet.speed).toBe(400);
		expect(bullet.damage).toBe(25);
		expect(bullet.lifetime).toBe(3);
	});
});
