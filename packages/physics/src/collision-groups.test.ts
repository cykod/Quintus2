import { Game, Scene } from "@quintus/core";
import { describe, expect, it, vi } from "vitest";
import { Actor } from "./actor.js";
import { CollisionGroups } from "./collision-groups.js";
import { CollisionShape } from "./collision-shape.js";
import { PhysicsPlugin } from "./physics-plugin.js";
import { Shape } from "./shapes.js";

describe("CollisionGroups", () => {
	const config = {
		player: { collidesWith: ["world", "enemies", "items"] },
		enemies: { collidesWith: ["world", "player"] },
		world: { collidesWith: ["player", "enemies"] },
		items: { collidesWith: ["player"] },
		projectiles: { collidesWith: ["enemies", "world"] },
	};

	it("compiles named groups to bitmasks", () => {
		const groups = new CollisionGroups(config);
		// Each group should have a distinct power-of-2 layer
		const layers = new Set<number>();
		for (const name of Object.keys(config)) {
			const layer = groups.getLayer(name);
			expect(layer).toBeGreaterThan(0);
			expect(layers.has(layer)).toBe(false);
			layers.add(layer);
		}
	});

	it("shouldCollide returns true for configured pairs", () => {
		const groups = new CollisionGroups(config);
		expect(groups.shouldCollide("player", "world")).toBe(true);
		expect(groups.shouldCollide("player", "enemies")).toBe(true);
		expect(groups.shouldCollide("player", "items")).toBe(true);
		expect(groups.shouldCollide("enemies", "world")).toBe(true);
		expect(groups.shouldCollide("enemies", "player")).toBe(true);
		expect(groups.shouldCollide("projectiles", "enemies")).toBe(true);
		expect(groups.shouldCollide("projectiles", "world")).toBe(true);
	});

	it("shouldCollide returns false for unconfigured pairs", () => {
		const groups = new CollisionGroups(config);
		expect(groups.shouldCollide("player", "projectiles")).toBe(false);
		expect(groups.shouldCollide("items", "enemies")).toBe(false);
		expect(groups.shouldCollide("items", "world")).toBe(false);
		expect(groups.shouldCollide("projectiles", "player")).toBe(false);
		expect(groups.shouldCollide("projectiles", "items")).toBe(false);
	});

	it("supports asymmetric collision (A→B but not B→A)", () => {
		const groups = new CollisionGroups({
			a: { collidesWith: ["b"] },
			b: { collidesWith: [] },
		});
		expect(groups.shouldCollide("a", "b")).toBe(true);
		expect(groups.shouldCollide("b", "a")).toBe(false);
	});

	it("default group collides with nothing when not explicitly configured", () => {
		const groups = new CollisionGroups({
			player: { collidesWith: ["world"] },
			world: { collidesWith: ["player"] },
		});
		// "default" was auto-added with mask = 0 (collides with nothing)
		expect(groups.shouldCollide("default", "player")).toBe(false);
		expect(groups.shouldCollide("default", "world")).toBe(false);
		expect(groups.shouldCollide("default", "default")).toBe(false);
	});

	it("allows explicit default group configuration", () => {
		const groups = new CollisionGroups({
			default: { collidesWith: ["player"] },
			player: { collidesWith: ["default"] },
		});
		expect(groups.shouldCollide("default", "player")).toBe(true);
		expect(groups.shouldCollide("player", "default")).toBe(true);
	});

	it("throws on too many groups (>32)", () => {
		const tooMany: Record<string, { collidesWith: string[] }> = {};
		for (let i = 0; i < 33; i++) {
			tooMany[`group${i}`] = { collidesWith: [] };
		}
		expect(() => new CollisionGroups(tooMany)).toThrow("Too many collision groups");
	});

	it("throws on reference to unknown group", () => {
		expect(
			() =>
				new CollisionGroups({
					player: { collidesWith: ["nonexistent"] },
				}),
		).toThrow('references unknown group "nonexistent"');
	});

	it("validate() throws for unknown group names", () => {
		const groups = new CollisionGroups(config);
		expect(() => groups.validate("player")).not.toThrow();
		expect(() => groups.validate("world")).not.toThrow();
		expect(() => groups.validate("nonexistent")).toThrow('Unknown collision group "nonexistent"');
	});

	it("getLayer returns unique power-of-2 values", () => {
		const groups = new CollisionGroups(config);
		for (const name of Object.keys(config)) {
			const layer = groups.getLayer(name);
			// Should be a power of 2
			expect(layer & (layer - 1)).toBe(0);
		}
	});

	it("getMask returns combined bitmask of collidesWith groups", () => {
		const groups = new CollisionGroups(config);
		const playerMask = groups.getMask("player");
		// Player collides with world, enemies, items
		expect(playerMask & groups.getLayer("world")).not.toBe(0);
		expect(playerMask & groups.getLayer("enemies")).not.toBe(0);
		expect(playerMask & groups.getLayer("items")).not.toBe(0);
		// Player does NOT collide with projectiles
		expect(playerMask & groups.getLayer("projectiles")).toBe(0);
	});

	it("getLayer throws for unknown group", () => {
		const groups = new CollisionGroups(config);
		expect(() => groups.getLayer("unknown")).toThrow('Unknown collision group "unknown"');
	});

	it("getMask throws for unknown group", () => {
		const groups = new CollisionGroups(config);
		expect(() => groups.getMask("unknown")).toThrow('Unknown collision group "unknown"');
	});

	it("DEFAULT static is 'default'", () => {
		expect(CollisionGroups.DEFAULT).toBe("default");
	});

	it("shouldCollide returns false for unknown group names (fallback to 0)", () => {
		const groups = new CollisionGroups(config);
		// Unknown groupA → maskA = 0, so (0 & layerB) = 0 → false
		expect(groups.shouldCollide("nonexistent", "player")).toBe(false);
		// Unknown groupB → layerB = 0, so (maskA & 0) = 0 → false
		expect(groups.shouldCollide("player", "nonexistent")).toBe(false);
	});

	it("auto-created default group has mask = 0", () => {
		const groups = new CollisionGroups({
			player: { collidesWith: ["world"] },
			world: { collidesWith: ["player"] },
		});
		expect(groups.getMask("default")).toBe(0);
	});
});

describe("PhysicsWorld default group warning", () => {
	it("console.warn fires for bodies registered with auto-created default group", () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

		class TestScene extends Scene {}
		const game = new Game({ width: 100, height: 100 });
		// Configure groups WITHOUT "default" — it gets auto-created with mask=0
		game.use(
			PhysicsPlugin({
				collisionGroups: {
					player: { collidesWith: ["world"] },
					world: { collidesWith: ["player"] },
				},
			}),
		);
		game.registerScenes({ test: TestScene });
		game.start("test");

		const scene = game.currentScene as Scene;

		// Create an actor that uses the default group
		const actor = new Actor();
		actor.name = "TestActor";
		const shape = new CollisionShape();
		shape.shape = Shape.rect(10, 10);
		actor.add(shape);
		scene.add(actor);

		expect(warnSpy).toHaveBeenCalledWith(
			'[Physics] TestActor has collisionGroup "default". Set an explicit group or it won\'t collide with anything.',
		);

		warnSpy.mockRestore();
	});

	it("console.warn does not fire when default group is explicitly configured", () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

		class TestScene extends Scene {}
		const game = new Game({ width: 100, height: 100 });
		// Configure groups WITH "default" — mask will be non-zero
		game.use(
			PhysicsPlugin({
				collisionGroups: {
					default: { collidesWith: ["default"] },
				},
			}),
		);
		game.registerScenes({ test: TestScene });
		game.start("test");

		const scene = game.currentScene as Scene;

		const actor = new Actor();
		actor.name = "TestActor";
		const shape = new CollisionShape();
		shape.shape = Shape.rect(10, 10);
		actor.add(shape);
		scene.add(actor);

		// Should NOT warn because default group has non-zero mask
		const physicsWarns = warnSpy.mock.calls.filter(
			(call) => typeof call[0] === "string" && call[0].includes("[Physics]"),
		);
		expect(physicsWarns.length).toBe(0);

		warnSpy.mockRestore();
	});
});
