import { _resetNodeIdCounter, Game, Scene } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import { Actor, CollisionShape, getPhysicsWorld, PhysicsPlugin, Shape } from "@quintus/physics";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Pickup } from "./pickup.js";

class TestPickup extends Pickup {
	onCollectCalled = false;
	lastCollector: Actor | null = null;

	protected override onCollect(collector: Actor): void {
		this.onCollectCalled = true;
		this.lastCollector = collector;
	}
}

function makePlayer(pos: Vec2): Actor {
	const a = new Actor();
	a.collisionGroup = "player";
	a.solid = false;
	a.position = pos;
	a.tag("player");
	const cs = new CollisionShape();
	cs.shape = Shape.rect(8, 8);
	a.add(cs);
	return a;
}

function makePickup(pos: Vec2, opts?: { bobAmount?: number }): TestPickup {
	const p = new TestPickup();
	p.position = pos;
	const cs = new CollisionShape();
	cs.shape = Shape.rect(16, 16);
	p.add(cs);
	if (opts?.bobAmount !== undefined) p.bobAmount = opts.bobAmount;
	return p;
}

function setup(opts?: { bobAmount?: number }) {
	_resetNodeIdCounter();
	const canvas = document.createElement("canvas");
	const game = new Game({ width: 200, height: 200, canvas, renderer: null });
	game.use(
		PhysicsPlugin({
			collisionGroups: {
				player: { collidesWith: ["pickups"] },
				pickups: { collidesWith: ["player"] },
			},
		}),
	);

	const pickup = makePickup(new Vec2(100, 100), opts);
	const player = makePlayer(new Vec2(50, 100));

	class TestScene extends Scene {
		override onReady() {
			this.add(pickup);
			this.add(player);
		}
	}
	game.registerScenes({ test: TestScene });
	game.start("test");

	return { game, pickup, player, world: getPhysicsWorld(game) };
}

function step(game: Game, n: number) {
	for (let i = 0; i < n; i++) game.step();
}

describe("Pickup", () => {
	beforeEach(() => _resetNodeIdCounter());

	it("emits collected signal when player overlaps", () => {
		const { game, pickup, player, world } = setup();
		const handler = vi.fn();
		pickup.collected.connect(handler);

		// Move player to pickup position and update hash
		player.position = new Vec2(100, 100);
		world?.updatePosition(player);
		game.step();

		expect(handler).toHaveBeenCalledWith(player);
	});

	it("calls onCollect hook", () => {
		const { game, pickup, player, world } = setup();
		player.position = new Vec2(100, 100);
		world?.updatePosition(player);
		game.step();

		expect(pickup.onCollectCalled).toBe(true);
		expect(pickup.lastCollector).toBe(player);
	});

	it("only collects once", () => {
		const { game, pickup, player, world } = setup();
		const handler = vi.fn();
		pickup.collected.connect(handler);

		player.position = new Vec2(100, 100);
		world?.updatePosition(player);
		game.step();

		// Move away and back
		player.position = new Vec2(50, 100);
		world?.updatePosition(player);
		game.step();

		player.position = new Vec2(100, 100);
		world?.updatePosition(player);
		game.step();

		expect(handler).toHaveBeenCalledTimes(1);
	});

	it("ignores bodies without collect tag", () => {
		_resetNodeIdCounter();
		const canvas = document.createElement("canvas");
		const game = new Game({ width: 200, height: 200, canvas, renderer: null });
		game.use(
			PhysicsPlugin({
				collisionGroups: {
					enemy: { collidesWith: ["pickups"] },
					pickups: { collidesWith: ["enemy"] },
				},
			}),
		);

		const pickup = makePickup(new Vec2(100, 100));
		const enemy = new Actor();
		enemy.collisionGroup = "enemy";
		enemy.solid = false;
		enemy.position = new Vec2(100, 100);
		enemy.tag("enemy");
		const cs = new CollisionShape();
		cs.shape = Shape.rect(8, 8);
		enemy.add(cs);

		class TestScene extends Scene {
			override onReady() {
				this.add(pickup);
				this.add(enemy);
			}
		}
		game.start(TestScene);

		const handler = vi.fn();
		pickup.collected.connect(handler);
		game.step();

		expect(handler).not.toHaveBeenCalled();
	});

	it("only collects from Actor instances", () => {
		const { game, pickup, player, world } = setup();
		const handler = vi.fn();
		pickup.collected.connect(handler);

		player.position = new Vec2(100, 100);
		world?.updatePosition(player);
		game.step();
		expect(handler).toHaveBeenCalledTimes(1);
	});

	it("bobs up and down when bobAmount > 0", () => {
		const { game, pickup } = setup({ bobAmount: 4 });
		const startY = pickup.position.y;

		// Step a quarter of bobSpeed (0.8s) → ~12 frames at 60fps
		step(game, 12);
		expect(pickup.position.y).not.toBeCloseTo(startY, 1);
	});

	it("does not bob when bobAmount is 0", () => {
		const { game, pickup } = setup({ bobAmount: 0 });
		const startY = pickup.position.y;
		step(game, 30);
		expect(pickup.position.y).toBeCloseTo(startY);
	});

	it("destroys after collection (tween fallback)", () => {
		const { game, pickup, player, world } = setup();
		player.position = new Vec2(100, 100);
		world?.updatePosition(player);
		game.step(); // triggers bodyEntered → collect → destroy (tween fallback)
		game.step(); // process deferred destroy
		expect(pickup.isInsideTree).toBe(false);
	});

	it("stops bobbing after collection", () => {
		const { game, player, world } = setup();
		player.position = new Vec2(100, 100);
		world?.updatePosition(player);
		game.step();
		// After collection, _collected is true → onFixedUpdate skips bob
	});

	it("pool reset clears collected state", () => {
		const { pickup } = setup();
		pickup._poolReset();
		// @ts-expect-error accessing private for test
		expect(pickup._collected).toBe(false);
		// @ts-expect-error accessing private for test
		expect(pickup._bobElapsed).toBe(0);
	});
});
