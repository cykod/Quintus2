import { Game, Scene } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import { describe, expect, it, vi } from "vitest";
import { Actor } from "./actor.js";
import type { CollisionInfo } from "./collision-info.js";
import type { CollisionObject } from "./collision-object.js";
import { CollisionShape } from "./collision-shape.js";
import { getPhysicsWorld, PhysicsPlugin } from "./physics-plugin.js";
import { Shape } from "./shapes.js";
import { StaticCollider } from "./static-collider.js";

// === Helpers ===

function createGame(): Game {
	const canvas = document.createElement("canvas");
	return new Game({ width: 800, height: 600, canvas, renderer: null });
}

/** Set up a game with physics, add bodies to scene, start it. */
function setupScene(
	bodies: import("@quintus/core").Node[],
	gravity?: Vec2,
): { game: Game; world: ReturnType<typeof getPhysicsWorld> } {
	const game = createGame();
	game.use(PhysicsPlugin({ gravity }));
	class TestScene extends Scene {
		onReady() {
			for (const body of bodies) this.addChild(body);
		}
	}
	game.start(TestScene);
	return { game, world: getPhysicsWorld(game) };
}

function makeActor(pos: Vec2, w = 10, h = 10): Actor {
	const actor = new Actor();
	actor.position = pos;
	const cs = actor.addChild(CollisionShape);
	cs.shape = Shape.rect(w, h);
	return actor;
}

function makeStatic(pos: Vec2, w = 200, h = 20): StaticCollider {
	const sc = new StaticCollider();
	sc.position = pos;
	const cs = sc.addChild(CollisionShape);
	cs.shape = Shape.rect(w, h);
	return sc;
}

// === Tests ===

describe("Actor", () => {
	describe("gravity", () => {
		it("defaults to PhysicsWorld gravity.y in onReady()", () => {
			const actor = makeActor(new Vec2(0, 0));
			setupScene([actor], new Vec2(0, 600));
			expect(actor.gravity).toBe(600);
		});

		it("defaults to 800 with default PhysicsPlugin config", () => {
			const actor = makeActor(new Vec2(0, 0));
			setupScene([actor]);
			expect(actor.gravity).toBe(800);
		});

		it("applies gravity when applyGravity = true", () => {
			const actor = makeActor(new Vec2(0, 0));
			setupScene([actor]);
			actor.velocity = new Vec2(0, 0);
			actor.move(0.1);
			// velocity.y should have increased by gravity * dt = 800 * 0.1 = 80
			// Position should have moved down
			expect(actor.position.y).toBeGreaterThan(0);
		});

		it("does not apply gravity when applyGravity = false", () => {
			const actor = makeActor(new Vec2(0, 0));
			setupScene([actor]);
			actor.applyGravity = false;
			actor.velocity = new Vec2(100, 0);
			actor.move(0.1);
			// Should only move horizontally
			expect(actor.position.x).toBeCloseTo(10, 0);
			expect(actor.position.y).toBeCloseTo(0);
		});

		it("floor snap: on floor, velocity.y stays small (no phantom accumulation)", () => {
			const actor = makeActor(new Vec2(100, 80));
			const floor = makeStatic(new Vec2(100, 100));
			setupScene([actor, floor]);

			// First move: actor falls onto floor
			actor.velocity = new Vec2(0, 200);
			actor.move(0.1);
			expect(actor.isOnFloor()).toBe(true);

			// Second move: on floor, gravity should snap to small constant
			const _velBefore = actor.velocity.y;
			actor.move(0.1);
			// velocity.y should be small (floor snap gravity), not accumulating
			expect(actor.velocity.y).toBeLessThan(10);
		});
	});

	describe("move() — no collision", () => {
		it("position updates by velocity * dt", () => {
			const actor = makeActor(new Vec2(0, 0));
			setupScene([actor]);
			actor.applyGravity = false;
			actor.velocity = new Vec2(100, 50);
			actor.move(0.1);
			expect(actor.position.x).toBeCloseTo(10, 0);
			expect(actor.position.y).toBeCloseTo(5, 0);
		});
	});

	describe("move() — floor collision", () => {
		it("stops on floor, isOnFloor() true", () => {
			const actor = makeActor(new Vec2(100, 50));
			const floor = makeStatic(new Vec2(100, 100));
			setupScene([actor, floor]);

			actor.velocity = new Vec2(0, 300);
			actor.move(0.5);

			expect(actor.isOnFloor()).toBe(true);
			// Actor should be near the floor, not past it
			expect(actor.position.y).toBeLessThan(100);
			expect(actor.position.y).toBeGreaterThan(50);
		});

		it("velocity zeroed into floor surface", () => {
			const actor = makeActor(new Vec2(100, 50));
			const floor = makeStatic(new Vec2(100, 100));
			setupScene([actor, floor]);

			actor.velocity = new Vec2(100, 300);
			actor.move(0.5);

			// Y velocity should be zeroed (into floor)
			expect(Math.abs(actor.velocity.y)).toBeLessThan(2);
			// X velocity preserved
			expect(actor.velocity.x).toBeCloseTo(100, 0);
		});
	});

	describe("move() — wall collision", () => {
		it("slides along wall, isOnWall() true", () => {
			const actor = makeActor(new Vec2(0, 100));
			const wall = makeStatic(new Vec2(50, 100), 20, 200);
			setupScene([actor, wall]);

			actor.applyGravity = false;
			actor.velocity = new Vec2(200, 50);
			actor.move(0.5);

			expect(actor.isOnWall()).toBe(true);
			// Should have slid vertically
			expect(actor.position.y).toBeGreaterThan(100);
			// Should be near the wall, not past it
			expect(actor.position.x).toBeLessThan(50);
		});
	});

	describe("move() — ceiling collision", () => {
		it("isOnCeiling() true when hitting ceiling", () => {
			const actor = makeActor(new Vec2(100, 50));
			const ceiling = makeStatic(new Vec2(100, 10));
			setupScene([actor, ceiling]);

			actor.applyGravity = false;
			actor.velocity = new Vec2(0, -300);
			actor.move(0.5);

			expect(actor.isOnCeiling()).toBe(true);
		});
	});

	describe("moveAndCollide()", () => {
		it("returns first collision, no sliding", () => {
			const actor = makeActor(new Vec2(0, 0));
			const wall = makeStatic(new Vec2(50, 0), 20, 20);
			setupScene([actor, wall]);

			const result = actor.moveAndCollide(new Vec2(100, 0));
			expect(result).not.toBeNull();
			expect(result?.collider).toBe(wall);
			expect(actor.position.x).toBeLessThan(50);
			expect(actor.position.x).toBeGreaterThan(0);
		});

		it("returns null when no collision", () => {
			const actor = makeActor(new Vec2(0, 0));
			setupScene([actor]);

			const result = actor.moveAndCollide(new Vec2(100, 0));
			expect(result).toBeNull();
			expect(actor.position.x).toBeCloseTo(100, 0);
		});
	});

	describe("getSlideCollisions()", () => {
		it("contains all collisions from last move()", () => {
			const actor = makeActor(new Vec2(100, 50));
			const floor = makeStatic(new Vec2(100, 100));
			setupScene([actor, floor]);

			actor.velocity = new Vec2(0, 300);
			actor.move(0.5);

			expect(actor.getSlideCollisions().length).toBeGreaterThanOrEqual(1);
			expect(actor.getSlideCollisions()[0]?.collider).toBe(floor);
		});

		it("is cleared on each move() call", () => {
			const actor = makeActor(new Vec2(100, 50));
			const floor = makeStatic(new Vec2(100, 100));
			setupScene([actor, floor]);

			actor.velocity = new Vec2(0, 300);
			actor.move(0.5);
			expect(actor.getSlideCollisions().length).toBeGreaterThanOrEqual(1);

			// Move away from floor
			actor.applyGravity = false;
			actor.velocity = new Vec2(0, -10);
			actor.move(0.01);
			expect(actor.getSlideCollisions().length).toBe(0);
		});
	});

	describe("collided signal", () => {
		it("fires for each collision", () => {
			const actor = makeActor(new Vec2(100, 50));
			const floor = makeStatic(new Vec2(100, 100));
			setupScene([actor, floor]);

			const collisions: CollisionInfo[] = [];
			actor.collided.connect((info) => collisions.push(info));

			actor.velocity = new Vec2(0, 300);
			actor.move(0.5);

			expect(collisions.length).toBeGreaterThanOrEqual(1);
			expect(collisions[0]?.collider).toBe(floor);
		});
	});

	describe("floor detection angles", () => {
		it("slope within floorMaxAngle is floor", () => {
			const actor = makeActor(new Vec2(100, 50));
			const floor = makeStatic(new Vec2(100, 100));
			setupScene([actor, floor]);

			// Default floorMaxAngle = PI/4 (45 deg)
			// Normal straight up (0, -1) is a floor (angle = 0)
			actor.velocity = new Vec2(0, 300);
			actor.move(0.5);
			expect(actor.isOnFloor()).toBe(true);
		});

		it("upDirection = Vec2.ZERO means no floor concept", () => {
			const actor = makeActor(new Vec2(100, 50));
			const floor = makeStatic(new Vec2(100, 100));
			setupScene([actor, floor]);

			actor.upDirection = new Vec2(0, 0);
			actor.velocity = new Vec2(0, 300);
			actor.move(0.5);

			// No floor/wall/ceiling when upDirection is zero
			expect(actor.isOnFloor()).toBe(false);
			expect(actor.isOnWall()).toBe(false);
			expect(actor.isOnCeiling()).toBe(false);
		});
	});

	describe("maxSlides", () => {
		it("maxSlides = 1 stops at first collision, no slide", () => {
			const actor = makeActor(new Vec2(0, 0));
			const wall = makeStatic(new Vec2(50, 0), 20, 200);
			setupScene([actor, wall]);

			actor.applyGravity = false;
			actor.maxSlides = 1;
			actor.velocity = new Vec2(200, 50);
			actor.move(0.5);

			// Should stop at wall, not slide vertically
			expect(actor.getSlideCollisions().length).toBe(1);
		});
	});

	describe("actor vs actor", () => {
		it("non-solid actors pass through each other (default)", () => {
			const actor1 = makeActor(new Vec2(0, 0));
			const actor2 = makeActor(new Vec2(30, 0));
			setupScene([actor1, actor2]);

			actor1.applyGravity = false;
			actor1.velocity = new Vec2(200, 0);
			actor1.move(0.5);

			// actor1 should pass through actor2
			expect(actor1.position.x).toBeCloseTo(100, 0);
			expect(actor1.getSlideCollisions().length).toBe(0);
		});

		it("solid = false is the default", () => {
			const actor = new Actor();
			expect(actor.solid).toBe(false);
		});

		it("solid actor: another actor's move() collides with it", () => {
			const actor1 = makeActor(new Vec2(0, 0));
			const actor2 = makeActor(new Vec2(50, 0));
			actor2.solid = true;
			setupScene([actor1, actor2]);

			actor1.applyGravity = false;
			actor1.velocity = new Vec2(200, 0);
			actor1.move(0.5);

			// actor1 should stop at actor2's surface
			expect(actor1.position.x).toBeLessThan(50);
			expect(actor1.position.x).toBeGreaterThan(0);
			expect(actor1.getSlideCollisions().length).toBeGreaterThanOrEqual(1);
			expect(actor1.getSlideCollisions()[0]?.collider).toBe(actor2);
		});

		it("solid actor: onCollided fires with correct normal for stomp (top)", () => {
			const player = makeActor(new Vec2(100, 50));
			const enemy = makeActor(new Vec2(100, 100));
			enemy.solid = true;
			setupScene([player, enemy]);

			const collisions: CollisionInfo[] = [];
			player.collided.connect((info) => collisions.push(info));

			player.applyGravity = false;
			player.velocity = new Vec2(0, 300);
			player.move(0.5);

			expect(collisions.length).toBeGreaterThanOrEqual(1);
			expect(collisions[0]?.collider).toBe(enemy);
			// Normal should point up (away from enemy into player)
			expect(collisions[0]?.normal.y).toBeLessThan(0);
		});

		it("solid actor: onCollided fires with correct normal for side collision", () => {
			const player = makeActor(new Vec2(0, 0));
			const enemy = makeActor(new Vec2(50, 0));
			enemy.solid = true;
			setupScene([player, enemy]);

			const collisions: CollisionInfo[] = [];
			player.collided.connect((info) => collisions.push(info));

			player.applyGravity = false;
			player.velocity = new Vec2(200, 0);
			player.move(0.5);

			expect(collisions.length).toBeGreaterThanOrEqual(1);
			// Normal should point left (away from enemy into player)
			expect(collisions[0]?.normal.x).toBeLessThan(0);
		});

		it("solid actor: collision groups control directionality", () => {
			const actor1 = makeActor(new Vec2(0, 0));
			actor1.collisionGroup = "player";
			const actor2 = makeActor(new Vec2(50, 0));
			actor2.solid = true;
			actor2.collisionGroup = "enemies";

			const game = createGame();
			game.use(
				PhysicsPlugin({
					collisionGroups: {
						player: { collidesWith: ["enemies"] },
						enemies: { collidesWith: [] as string[] },
					},
				}),
			);
			class TestScene extends Scene {
				onReady() {
					this.addChild(actor1);
					this.addChild(actor2);
				}
			}
			game.start(TestScene);

			// Player detects enemy
			actor1.applyGravity = false;
			actor1.velocity = new Vec2(200, 0);
			actor1.move(0.5);
			expect(actor1.position.x).toBeLessThan(50);
			const playerX = actor1.position.x;

			// Enemy does NOT detect player (collidesWith is empty)
			actor2.applyGravity = false;
			actor2.velocity = new Vec2(-200, 0);
			actor2.move(0.5);
			// Enemy should pass through player
			expect(actor2.position.x).toBeLessThan(playerX);
		});

		it("solid actor: enemy destroyed in onCollided callback", () => {
			const player = makeActor(new Vec2(0, 0));
			const enemy = makeActor(new Vec2(50, 0));
			enemy.solid = true;
			const { game } = setupScene([player, enemy]);

			player.collided.connect((info) => {
				info.collider.destroy();
			});

			player.applyGravity = false;
			player.velocity = new Vec2(200, 0);
			player.move(0.5);

			// Player should have stopped at enemy, enemy marked for destroy
			expect(player.position.x).toBeLessThan(50);
			game.step(); // process destroy queue
			expect(enemy.isDestroyed).toBe(true);
		});
	});

	describe("onCollided virtual method", () => {
		it("onCollided fires and emits collided signal during move()", () => {
			const actor = makeActor(new Vec2(100, 50));
			const floor = makeStatic(new Vec2(100, 100));
			setupScene([actor, floor]);

			const collisions: CollisionInfo[] = [];
			actor.collided.connect((info) => collisions.push(info));

			actor.velocity = new Vec2(0, 300);
			actor.move(0.5);

			expect(collisions.length).toBeGreaterThanOrEqual(1);
			expect(collisions[0]?.collider).toBe(floor);
		});

		it("overriding onCollided allows self-handling", () => {
			class CustomActor extends Actor {
				customCollisions: CollisionInfo[] = [];
				override onCollided(info: CollisionInfo): void {
					this.customCollisions.push(info);
					super.onCollided(info); // still emits signal
				}
			}
			const actor = new CustomActor();
			actor.position = new Vec2(100, 50);
			const cs = actor.addChild(CollisionShape);
			cs.shape = Shape.rect(10, 10);

			const floor = makeStatic(new Vec2(100, 100));
			setupScene([actor, floor]);

			const signalCollisions: CollisionInfo[] = [];
			actor.collided.connect((info) => signalCollisions.push(info));

			actor.velocity = new Vec2(0, 300);
			actor.move(0.5);

			expect(actor.customCollisions.length).toBeGreaterThanOrEqual(1);
			expect(signalCollisions.length).toBeGreaterThanOrEqual(1);
		});

		it("overriding onCollided without super suppresses signal", () => {
			class SilentActor extends Actor {
				override onCollided(_info: CollisionInfo): void {
					// Don't call super
				}
			}
			const actor = new SilentActor();
			actor.position = new Vec2(100, 50);
			const cs = actor.addChild(CollisionShape);
			cs.shape = Shape.rect(10, 10);

			const floor = makeStatic(new Vec2(100, 100));
			setupScene([actor, floor]);

			const signalCollisions: CollisionInfo[] = [];
			actor.collided.connect((info) => signalCollisions.push(info));

			actor.velocity = new Vec2(0, 300);
			actor.move(0.5);

			expect(signalCollisions).toHaveLength(0);
		});
	});

	describe("signal cleanup", () => {
		it("disconnects collided signal on destroy", () => {
			const actor = makeActor(new Vec2(0, 0));
			const { game } = setupScene([actor]);

			const handler = vi.fn();
			actor.collided.connect(handler);
			expect(actor.collided.hasListeners).toBe(true);

			actor.destroy();
			game.step();

			expect(actor.collided.hasListeners).toBe(false);
		});
	});

	describe("auto-rehash suppression", () => {
		it("move() does not double-rehash", () => {
			const actor = makeActor(new Vec2(100, 50));
			const floor = makeStatic(new Vec2(100, 100));
			const { world } = setupScene([actor, floor]);

			const updateSpy = vi.spyOn(world as NonNullable<typeof world>, "updatePosition");
			actor.applyGravity = false;
			actor.velocity = new Vec2(100, 0);
			updateSpy.mockClear();
			actor.move(0.1);

			// move() should call updatePosition exactly once (the explicit call at the end)
			const actorCalls = updateSpy.mock.calls.filter((c) => c[0] === actor);
			expect(actorCalls).toHaveLength(1);
		});

		it("moveAndCollide() does not double-rehash", () => {
			const actor = makeActor(new Vec2(0, 0));
			const { world } = setupScene([actor]);

			const updateSpy = vi.spyOn(world as NonNullable<typeof world>, "updatePosition");
			updateSpy.mockClear();
			actor.moveAndCollide(new Vec2(50, 0));

			const actorCalls = updateSpy.mock.calls.filter((c) => c[0] === actor);
			expect(actorCalls).toHaveLength(1);
		});
	});

	describe("batched displacement", () => {
		it("position is written once per move() (totalDisplacement pattern)", () => {
			// Verify that move() works correctly with the batched displacement approach
			// by checking the final position is consistent with velocity * dt
			const actor = makeActor(new Vec2(0, 0));
			setupScene([actor]);

			actor.applyGravity = false;
			actor.velocity = new Vec2(100, 0);
			const startX = actor.position.x;
			actor.move(0.1);

			// Should have moved exactly velocity * dt = 100 * 0.1 = 10
			expect(actor.position.x - startX).toBeCloseTo(10, 1);
		});
	});

	describe("getFloorNormal / getWallNormal", () => {
		it("getFloorNormal returns floor normal when on floor", () => {
			const actor = makeActor(new Vec2(100, 80));
			const floor = makeStatic(new Vec2(100, 100));
			setupScene([actor, floor]);

			actor.velocity = new Vec2(0, 200);
			actor.move(0.1);

			expect(actor.isOnFloor()).toBe(true);
			const fn = actor.getFloorNormal();
			// Floor normal should point up (approximately)
			expect(fn.y).toBeLessThan(0);
		});

		it("getWallNormal returns wall normal when on wall", () => {
			const actor = makeActor(new Vec2(0, 100));
			const wall = makeStatic(new Vec2(50, 100), 20, 200);
			setupScene([actor, wall]);

			actor.applyGravity = false;
			actor.velocity = new Vec2(200, 0);
			actor.move(0.5);

			expect(actor.isOnWall()).toBe(true);
			const wn = actor.getWallNormal();
			// Wall normal should point left (away from wall)
			expect(wn.x).toBeLessThan(0);
		});
	});

	describe("getFloorCollider", () => {
		it("returns the floor collider when on floor", () => {
			const actor = makeActor(new Vec2(100, 80));
			const floor = makeStatic(new Vec2(100, 100));
			setupScene([actor, floor]);

			actor.velocity = new Vec2(0, 200);
			actor.move(0.1);

			expect(actor.getFloorCollider()).toBe(floor);
		});

		it("returns null when not on floor", () => {
			const actor = makeActor(new Vec2(0, 0));
			setupScene([actor]);

			actor.applyGravity = false;
			actor.velocity = new Vec2(100, 0);
			actor.move(0.1);

			expect(actor.getFloorCollider()).toBeNull();
		});
	});

	describe("move/moveAndCollide without physics world", () => {
		it("move() is a no-op when no physics world is attached", () => {
			const actor = new Actor();
			actor.position = new Vec2(10, 20);
			actor.velocity = new Vec2(100, 0);
			// Not added to any scene with physics — _getWorld() returns null
			actor.move(0.1);
			// Position should be unchanged
			expect(actor.position.x).toBe(10);
			expect(actor.position.y).toBe(20);
		});

		it("moveAndCollide() returns null when no physics world is attached", () => {
			const actor = new Actor();
			actor.position = new Vec2(10, 20);
			const result = actor.moveAndCollide(new Vec2(100, 0));
			expect(result).toBeNull();
			// Position should be unchanged
			expect(actor.position.x).toBe(10);
			expect(actor.position.y).toBe(20);
		});
	});

	describe("floor snap preserves jump velocity", () => {
		it("negative velocity.y is preserved on floor (allows jumping)", () => {
			const actor = makeActor(new Vec2(100, 80));
			const floor = makeStatic(new Vec2(100, 100));
			setupScene([actor, floor]);

			// Land on floor
			actor.velocity = new Vec2(0, 200);
			actor.move(0.1);
			expect(actor.isOnFloor()).toBe(true);

			// Set negative (upward) velocity to simulate jump
			actor.velocity.y = -400;
			actor.move(1 / 60);
			// Should not snap to floor — velocity.y should stay negative
			expect(actor.velocity.y).toBeLessThan(0);
		});
	});

	describe("monitoring (overlap detection)", () => {
		it("defaults to monitoring = false", () => {
			const actor = new Actor();
			expect(actor.monitoring).toBe(false);
		});

		it("actor with monitoring = true receives bodyEntered when overlapping another actor", () => {
			const actor1 = makeActor(new Vec2(0, 0));
			actor1.monitoring = true;
			const actor2 = makeActor(new Vec2(5, 0));
			const { game } = setupScene([actor1, actor2]);

			const entered: CollisionObject[] = [];
			actor1.bodyEntered.connect((b) => entered.push(b));

			game.step();

			expect(entered).toHaveLength(1);
			expect(entered[0]).toBe(actor2);
		});

		it("actor with monitoring = true receives bodyExited when overlap ends", () => {
			const actor1 = makeActor(new Vec2(0, 0));
			actor1.monitoring = true;
			const actor2 = makeActor(new Vec2(5, 0));
			const { game, world } = setupScene([actor1, actor2]);

			const exited: CollisionObject[] = [];
			actor1.bodyExited.connect((b) => exited.push(b));

			game.step(); // Enter

			// Move actor2 far away
			actor2.position = new Vec2(500, 0);
			world?.updatePosition(actor2);
			game.step(); // Exit

			expect(exited).toHaveLength(1);
			expect(exited[0]).toBe(actor2);
		});

		it("actor with monitoring = false does NOT receive overlap events", () => {
			const actor1 = makeActor(new Vec2(0, 0));
			// monitoring defaults to false
			const actor2 = makeActor(new Vec2(5, 0));
			const { game } = setupScene([actor1, actor2]);

			const entered: CollisionObject[] = [];
			actor1.bodyEntered.connect((b) => entered.push(b));

			game.step();

			expect(entered).toHaveLength(0);
		});

		it("getOverlappingBodies() returns current overlaps for monitored actor", () => {
			const actor1 = makeActor(new Vec2(0, 0));
			actor1.monitoring = true;
			const actor2 = makeActor(new Vec2(5, 0));
			const { game } = setupScene([actor1, actor2]);

			game.step();

			const bodies = actor1.getOverlappingBodies();
			expect(bodies).toContain(actor2);
		});

		it("getOverlappingBodies() returns empty for non-monitored actor", () => {
			const actor1 = makeActor(new Vec2(0, 0));
			const actor2 = makeActor(new Vec2(5, 0));
			setupScene([actor1, actor2]);

			expect(actor1.getOverlappingBodies()).toHaveLength(0);
		});

		it("no duplicate bodyEntered on sustained overlap", () => {
			const actor1 = makeActor(new Vec2(0, 0));
			actor1.monitoring = true;
			const actor2 = makeActor(new Vec2(5, 0));
			const { game } = setupScene([actor1, actor2]);

			const entered: CollisionObject[] = [];
			actor1.bodyEntered.connect((b) => entered.push(b));

			game.step();
			game.step();
			game.step();

			expect(entered).toHaveLength(1);
		});

		it("bodyEntered/bodyExited signals cleaned up on destroy", () => {
			const actor = makeActor(new Vec2(0, 0));
			const { game } = setupScene([actor]);

			actor.bodyEntered.connect(() => {});
			actor.bodyExited.connect(() => {});

			expect(actor.bodyEntered.hasListeners).toBe(true);
			expect(actor.bodyExited.hasListeners).toBe(true);

			actor.destroy();
			game.step();

			expect(actor.bodyEntered.hasListeners).toBe(false);
			expect(actor.bodyExited.hasListeners).toBe(false);
		});
	});

	describe("moving platform carry", () => {
		it("actor rides a moving platform", () => {
			const actor = makeActor(new Vec2(100, 80));
			const platform = makeStatic(new Vec2(100, 100));
			platform.constantVelocity = new Vec2(200, 0);
			setupScene([actor, platform]);

			// Land on platform
			actor.velocity = new Vec2(0, 200);
			actor.move(0.1);
			expect(actor.isOnFloor()).toBe(true);
			expect(actor.getFloorCollider()).toBe(platform);

			// Next move: platform should carry actor horizontally
			const xBefore = actor.position.x;
			actor.velocity = new Vec2(0, 0);
			actor.move(0.1);
			// actor should have moved right by platform velocity * dt = 200 * 0.1 = 20
			expect(actor.position.x).toBeGreaterThan(xBefore);
		});

		it("stationary platform does not carry", () => {
			const actor = makeActor(new Vec2(100, 80));
			const platform = makeStatic(new Vec2(100, 100));
			// constantVelocity defaults to (0, 0)
			setupScene([actor, platform]);

			actor.velocity = new Vec2(0, 200);
			actor.move(0.1);
			expect(actor.isOnFloor()).toBe(true);

			const xBefore = actor.position.x;
			actor.velocity = new Vec2(0, 0);
			actor.move(0.1);
			// Should not have moved horizontally
			expect(actor.position.x).toBeCloseTo(xBefore, 0);
		});
	});

	describe("corner slide (multi-collision)", () => {
		it("slides into corner and handles two walls", () => {
			const actor = makeActor(new Vec2(0, 0));
			// Floor below, wall to the right
			const floor = makeStatic(new Vec2(100, 100));
			const wall = makeStatic(new Vec2(200, 50), 20, 200);
			setupScene([actor, floor, wall]);

			actor.applyGravity = false;
			actor.velocity = new Vec2(300, 300);
			actor.move(1);

			// Should have been stopped by both floor and wall
			const collisions = actor.getSlideCollisions();
			expect(collisions.length).toBeGreaterThanOrEqual(1);
		});
	});

	describe("contact flag transitions", () => {
		it("floor → not on floor after moving up", () => {
			const actor = makeActor(new Vec2(100, 80));
			const floor = makeStatic(new Vec2(100, 100));
			setupScene([actor, floor]);

			// Land on floor
			actor.velocity = new Vec2(0, 200);
			actor.move(0.1);
			expect(actor.isOnFloor()).toBe(true);

			// Jump upward - set negative velocity and prevent floor snap
			actor.velocity.y = -500;
			actor.move(1 / 60);
			// After jumping, velocity should still be negative (preserved by floor snap logic)
			// After enough upward motion, floor contact should be lost
			actor.applyGravity = false;
			actor.velocity = new Vec2(0, -500);
			actor.move(0.1);
			expect(actor.isOnFloor()).toBe(false);
		});

		it("wall contact resets when moving away", () => {
			const actor = makeActor(new Vec2(0, 100));
			const wall = makeStatic(new Vec2(50, 100), 20, 200);
			setupScene([actor, wall]);

			actor.applyGravity = false;
			actor.velocity = new Vec2(200, 0);
			actor.move(0.5);
			expect(actor.isOnWall()).toBe(true);

			// Move away from wall
			actor.velocity = new Vec2(-200, 0);
			actor.move(0.1);
			expect(actor.isOnWall()).toBe(false);
		});
	});

	describe("debug instrumentation", () => {
		it("logs collision events in debug mode", () => {
			const canvas = document.createElement("canvas");
			const game = new Game({ width: 800, height: 600, canvas, renderer: null, debug: true });
			const actor = makeActor(new Vec2(100, 50));
			const floor = makeStatic(new Vec2(100, 100));
			game.use(PhysicsPlugin());
			class TestScene extends Scene {
				onReady() {
					this.addChild(actor);
					this.addChild(floor);
				}
			}
			game.start(TestScene);

			actor.velocity = new Vec2(0, 300);
			actor.move(0.5);

			const events = game.debugLog.peek({ category: "physics" });
			const collisionEvents = events.filter((e) => e.message.includes("collision"));
			expect(collisionEvents.length).toBeGreaterThanOrEqual(1);
		});

		it("logs floor contact transition in debug mode", () => {
			const canvas = document.createElement("canvas");
			const game = new Game({ width: 800, height: 600, canvas, renderer: null, debug: true });
			const actor = makeActor(new Vec2(100, 50));
			const floor = makeStatic(new Vec2(100, 100));
			game.use(PhysicsPlugin());
			class TestScene extends Scene {
				onReady() {
					this.addChild(actor);
					this.addChild(floor);
				}
			}
			game.start(TestScene);

			actor.velocity = new Vec2(0, 300);
			actor.move(0.5);

			const events = game.debugLog.peek({ category: "physics" });
			const floorEvents = events.filter((e) => e.message.includes("floor_contact"));
			expect(floorEvents.length).toBeGreaterThanOrEqual(1);
			expect(floorEvents[0]?.message).toContain("entered");
		});
	});

	describe("serialize", () => {
		it("includes velocity, gravity, and contact flags", () => {
			const actor = makeActor(new Vec2(100, 80));
			const floor = makeStatic(new Vec2(100, 100));
			setupScene([actor, floor]);

			actor.velocity = new Vec2(50, 200);
			actor.move(0.1);

			const snap = actor.serialize();
			expect(snap.velocity).toBeDefined();
			expect(snap.gravity).toBe(actor.gravity);
			expect(snap.isOnFloor).toBe(true);
			expect(snap.bodyType).toBe("actor");
			expect(snap.collisionGroup).toBeDefined();
		});
	});
});
