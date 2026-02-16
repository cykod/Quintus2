import { Game, Scene } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import { describe, expect, it, vi } from "vitest";
import { Actor } from "./actor.js";
import "./augment.js";
import type { CollisionInfo } from "./collision-info.js";
import type { CollisionObject } from "./collision-object.js";
import { CollisionShape } from "./collision-shape.js";
import { getPhysicsWorld, PhysicsPlugin } from "./physics-plugin.js";
import { Sensor } from "./sensor.js";
import { Shape } from "./shapes.js";
import { StaticCollider } from "./static-collider.js";

// === Reusable Actor Subclasses ===

/** Actor whose onFixedUpdate just calls move(dt). Gravity-driven. */
class GravityActor extends Actor {
	override onFixedUpdate(dt: number): void {
		this.move(dt);
	}
}

/** Actor that sets velocity each frame, then moves. */
class VelocityActor extends Actor {
	targetVelocity = new Vec2(0, 0);

	override onFixedUpdate(dt: number): void {
		this.velocity.x = this.targetVelocity.x;
		this.velocity.y = this.targetVelocity.y;
		this.move(dt);
	}
}

/** Actor that sets only horizontal velocity, letting gravity manage vertical. */
class WalkingActor extends Actor {
	speed = 0;

	override onFixedUpdate(dt: number): void {
		this.velocity.x = this.speed;
		this.move(dt);
	}
}

/** Moving platform that updates position manually each frame. */
class MovingPlatform extends StaticCollider {
	override onFixedUpdate(dt: number): void {
		this.position._set(
			this.position.x + this.constantVelocity.x * dt,
			this.position.y + this.constantVelocity.y * dt,
		);
		this._getWorld()?.updatePosition(this);
	}
}

// === Helpers ===

function createGame(pluginConfig?: Parameters<typeof PhysicsPlugin>[0]): Game {
	const canvas = document.createElement("canvas");
	const game = new Game({ width: 800, height: 600, canvas, renderer: null });
	game.use(PhysicsPlugin(pluginConfig));
	return game;
}

function startScene(game: Game, bodies: import("@quintus/core").Node[]): void {
	class TestScene extends Scene {
		onReady() {
			for (const body of bodies) this.addChild(body);
		}
	}
	game.start(TestScene);
}

function makeActor(ActorClass: typeof Actor, pos: Vec2, w = 10, h = 10): Actor {
	const actor = new ActorClass();
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

function makeSensor(pos: Vec2, w = 16, h = 16): Sensor {
	const sensor = new Sensor();
	sensor.position = pos;
	const cs = sensor.addChild(CollisionShape);
	cs.shape = Shape.rect(w, h);
	return sensor;
}

/** Step game N times. */
function stepN(game: Game, n: number): void {
	for (let i = 0; i < n; i++) game.step();
}

// === Integration Tests ===

describe("Integration: physics full-loop", () => {
	describe("platformer scenario: actor falls onto floor", () => {
		it("actor falls under gravity and lands on floor", () => {
			const game = createGame();
			const actor = makeActor(GravityActor, new Vec2(200, 0));
			const floor = makeStatic(new Vec2(200, 500), 400, 20);
			startScene(game, [actor, floor]);

			// Step until actor is on floor or max iterations
			for (let i = 0; i < 300; i++) {
				game.step();
				if (actor.isOnFloor()) break;
			}

			expect(actor.isOnFloor()).toBe(true);
			// Actor (half-height 5) above floor (half-height 10) at y=500
			// Expected: actor.y ≈ 500 - 10 - 5 = 485
			expect(actor.position.y).toBeCloseTo(485, 0);
		});
	});

	describe("wall slide: actor runs into wall, slides along it", () => {
		it("actor slides vertically when hitting wall with diagonal velocity", () => {
			const game = createGame();
			const actor = makeActor(VelocityActor, new Vec2(0, 100)) as VelocityActor;
			actor.applyGravity = false;
			actor.targetVelocity = new Vec2(200, 100);
			// Wall: tall, to the right
			const wall = makeStatic(new Vec2(100, 100), 20, 400);
			startScene(game, [actor, wall]);

			stepN(game, 60);

			expect(actor.isOnWall()).toBe(true);
			// X should have stopped at the wall
			expect(actor.position.x).toBeLessThan(100);
			// Y should have advanced (slid down)
			expect(actor.position.y).toBeGreaterThan(100);
		});
	});

	describe("corner: actor hits corner between floor and wall", () => {
		it("resolves to corner without jittering", () => {
			const game = createGame();
			// Floor: x=0..100, y=190..210
			const floor = makeStatic(new Vec2(50, 200), 100, 20);
			// Wall: x=90..110, y=0..200
			const wall = makeStatic(new Vec2(100, 100), 20, 200);
			const actor = makeActor(VelocityActor, new Vec2(70, 170)) as VelocityActor;
			actor.applyGravity = false;
			actor.targetVelocity = new Vec2(150, 250);
			startScene(game, [actor, floor, wall]);

			stepN(game, 60);

			// Actor should be stopped in the corner
			expect(actor.isOnFloor()).toBe(true);
			expect(actor.isOnWall()).toBe(true);
			// Position should be stable — step more and verify no drift
			const stableX = actor.position.x;
			const stableY = actor.position.y;
			stepN(game, 30);
			expect(actor.position.x).toBeCloseTo(stableX, 1);
			expect(actor.position.y).toBeCloseTo(stableY, 1);
		});
	});

	describe("moving platform: actor rides a horizontally moving platform", () => {
		it("actor tracks platform position", () => {
			const game = createGame();
			const platform = new MovingPlatform();
			platform.position = new Vec2(100, 200);
			platform.constantVelocity = new Vec2(100, 0);
			const pcs = platform.addChild(CollisionShape);
			pcs.shape = Shape.rect(80, 12);

			const actor = makeActor(GravityActor, new Vec2(100, 170));
			startScene(game, [platform, actor]);

			// Wait for actor to land on platform
			for (let i = 0; i < 60; i++) {
				game.step();
				if (actor.isOnFloor()) break;
			}
			expect(actor.isOnFloor()).toBe(true);

			const actorXBefore = actor.position.x;
			const platformXBefore = platform.position.x;

			const steps = 60;
			stepN(game, steps);

			const dt = 1 / 60;
			const expectedDx = platform.constantVelocity.x * steps * dt;
			// Platform moved by expectedDx
			expect(platform.position.x).toBeCloseTo(platformXBefore + expectedDx, 0);
			// Actor should have been carried along
			expect(actor.position.x).toBeCloseTo(actorXBefore + expectedDx, 0);
		});
	});

	describe("sensor pickup: actor walks over sensor, signals fire, sensor self-destructs", () => {
		it("bodyEntered fires and sensor is destroyed", () => {
			const game = createGame();
			// Actor moving right
			const actor = makeActor(VelocityActor, new Vec2(0, 0)) as VelocityActor;
			actor.applyGravity = false;
			actor.targetVelocity = new Vec2(200, 0);
			actor.tag("player");

			// Coin sensor in actor's path
			const coin = makeSensor(new Vec2(50, 0), 16, 16);

			const entered: CollisionObject[] = [];
			coin.bodyEntered.connect((body) => {
				entered.push(body);
				if (body.hasTag("player")) {
					coin.destroy();
				}
			});

			startScene(game, [actor, coin]);

			// Step until actor overlaps coin
			for (let i = 0; i < 60; i++) {
				game.step();
				if (entered.length > 0) break;
			}

			expect(entered).toHaveLength(1);
			expect(entered[0]).toBe(actor);

			// Step one more time to process destroy queue
			game.step();
			expect(coin.isDestroyed).toBe(true);
		});
	});

	describe("tunneling prevention: fast actor does not pass through thin wall", () => {
		it("rect-vs-rect fast actor stops at thin wall", () => {
			const game = createGame();
			// Fast actor
			const actor = makeActor(VelocityActor, new Vec2(0, 0)) as VelocityActor;
			actor.applyGravity = false;
			actor.targetVelocity = new Vec2(1000, 0);
			// Thin wall: 4px wide at x=200
			const wall = makeStatic(new Vec2(200, 0), 4, 100);
			startScene(game, [actor, wall]);

			game.step();

			// Actor should not have passed through
			expect(actor.position.x).toBeLessThan(200);
		});
	});

	describe("slope walk: actor walks up 30° slope smoothly", () => {
		it("actor climbs 30° slope and isOnFloor() is true", () => {
			const game = createGame();
			// 30° slope polygon: triangle
			const slope = new StaticCollider();
			slope.position = new Vec2(200, 300);
			const scs = slope.addChild(CollisionShape);
			// Right triangle: flat base at bottom, slopes up to the right
			// height = 200 * tan(30°) ≈ 115.5
			scs.shape = Shape.polygon([new Vec2(-100, 0), new Vec2(100, 0), new Vec2(100, -115.5)]);

			const actor = makeActor(VelocityActor, new Vec2(100, 280)) as VelocityActor;
			actor.targetVelocity = new Vec2(100, 0);
			startScene(game, [slope, actor]);

			const startY = actor.position.y;
			// Step multiple times
			stepN(game, 120);

			// Actor should have climbed up (y decreased)
			expect(actor.position.y).toBeLessThan(startY);
			// Should register as on floor (30° < 45° floorMaxAngle)
			expect(actor.isOnFloor()).toBe(true);
		});
	});

	describe("one-way platform: actor jumps through from below, lands on top", () => {
		it("passes through from below and lands from above", () => {
			const game = createGame();
			// One-way platform at y=200
			const platform = makeStatic(new Vec2(200, 200), 80, 4);
			platform.oneWay = true;

			// Actor below platform
			const actor = makeActor(GravityActor, new Vec2(200, 250));
			// Strong upward jump
			actor.velocity = new Vec2(0, -400);
			startScene(game, [platform, actor]);

			// Phase 1: jump up through platform
			let passedThrough = false;
			for (let i = 0; i < 60; i++) {
				game.step();
				if (actor.position.y < 200) {
					passedThrough = true;
					break;
				}
			}
			expect(passedThrough).toBe(true);

			// Phase 2: gravity pulls actor back down, should land on platform
			for (let i = 0; i < 120; i++) {
				game.step();
				if (actor.isOnFloor() && actor.position.y < 200) {
					break;
				}
			}
			expect(actor.isOnFloor()).toBe(true);
			// Actor should be on top of the platform
			expect(actor.position.y).toBeLessThan(200);
		});
	});

	describe("collision groups: player collides with world but not items", () => {
		it("player stops at wall but passes through item", () => {
			const game = createGame({
				collisionGroups: {
					player: { collidesWith: ["world"] },
					world: { collidesWith: ["player"] },
					items: { collidesWith: [] },
				},
			});

			const actor = makeActor(VelocityActor, new Vec2(0, 0)) as VelocityActor;
			actor.applyGravity = false;
			actor.collisionGroup = "player";
			actor.targetVelocity = new Vec2(200, 0);

			// Item in path (should be ignored)
			const item = makeStatic(new Vec2(100, 0), 20, 20);
			item.collisionGroup = "items";

			// Wall further along (should block)
			const wall = makeStatic(new Vec2(250, 0), 20, 100);
			wall.collisionGroup = "world";

			startScene(game, [actor, item, wall]);

			stepN(game, 120);

			// Player should have passed through item and stopped at wall
			expect(actor.position.x).toBeGreaterThan(100); // Past the item
			expect(actor.position.x).toBeLessThan(250); // Stopped at wall
		});
	});

	describe("collision group validation: invalid group throws", () => {
		it("throws when registering body with unknown group", () => {
			const game = createGame({
				collisionGroups: {
					player: { collidesWith: ["world"] },
					world: { collidesWith: ["player"] },
				},
			});

			const actor = new Actor();
			actor.position = new Vec2(0, 0);
			const cs = actor.addChild(CollisionShape);
			cs.shape = Shape.rect(10, 10);
			actor.collisionGroup = "nonexistent";

			expect(() => {
				startScene(game, [actor]);
			}).toThrow('Unknown collision group "nonexistent"');
		});
	});

	describe("rotated StaticCollider platform", () => {
		it("actor lands on 45° rotated platform", () => {
			const game = createGame();
			// Rotated platform
			const platform = new StaticCollider();
			platform.position = new Vec2(200, 300);
			platform.rotation = Math.PI / 4; // 45°
			const pcs = platform.addChild(CollisionShape);
			pcs.shape = Shape.rect(100, 12);

			const actor = makeActor(GravityActor, new Vec2(200, 200));
			startScene(game, [platform, actor]);

			// Step until landed
			for (let i = 0; i < 120; i++) {
				game.step();
				if (actor.isOnFloor()) break;
			}

			expect(actor.isOnFloor()).toBe(true);
			// Collision normal should be perpendicular to the rotated surface
			const fn = actor.getFloorNormal();
			expect(fn.length()).toBeCloseTo(1, 1);
		});
	});

	describe("rotated capsule Actor", () => {
		it("horizontal capsule actor collides with floor", () => {
			const game = createGame();
			// Actor with horizontally rotated capsule
			const actor = new GravityActor();
			actor.position = new Vec2(200, 100);
			const cs = actor.addChild(CollisionShape);
			cs.shape = Shape.capsule(8, 24);
			cs.rotation = Math.PI / 2; // Horizontal capsule

			const floor = makeStatic(new Vec2(200, 300), 400, 20);
			startScene(game, [actor, floor]);

			for (let i = 0; i < 200; i++) {
				game.step();
				if (actor.isOnFloor()) break;
			}

			expect(actor.isOnFloor()).toBe(true);
		});
	});

	describe("capsule Actor on rect floor", () => {
		it("capsule actor lands on and walks along rect floor", () => {
			const game = createGame();
			const actor = new WalkingActor();
			actor.position = new Vec2(100, 100);
			actor.speed = 100;
			const cs = actor.addChild(CollisionShape);
			cs.shape = Shape.capsule(8, 24);

			const floor = makeStatic(new Vec2(200, 300), 400, 20);
			startScene(game, [actor, floor]);

			// Wait for actor to land
			for (let i = 0; i < 200; i++) {
				game.step();
				if (actor.isOnFloor()) break;
			}
			expect(actor.isOnFloor()).toBe(true);

			// Walk along floor — should stay on floor
			const yOnFloor = actor.position.y;
			stepN(game, 60);

			expect(actor.isOnFloor()).toBe(true);
			expect(actor.position.x).toBeGreaterThan(100); // Moved right
			expect(actor.position.y).toBeCloseTo(yOnFloor, 0); // Stayed on floor
		});
	});

	describe("rotated sensor", () => {
		it("detects overlap with rotated geometry, not just AABB", () => {
			const game = createGame();

			// Sensor with 45° rotated rect shape (100x10)
			// At 45°, the long axis runs from upper-left (164.6, 164.6) to lower-right (235.4, 235.4)
			const sensor = new Sensor();
			sensor.position = new Vec2(200, 200);
			const scs = sensor.addChild(CollisionShape);
			scs.shape = Shape.rect(100, 10);
			sensor.rotation = Math.PI / 4;

			// Actor on the diagonal — should overlap the rotated rect
			const onDiagonal = makeActor(GravityActor, new Vec2(220, 220));
			onDiagonal.applyGravity = false;

			// Actor in AABB corner but off the thin diagonal — should NOT overlap
			// AABB spans ~(161, 161) to ~(239, 239)
			// (170, 230) is inside AABB but perpendicular distance from the diagonal
			// center line is |170-230|/sqrt(2) ≈ 42px, which is > the 5px half-width
			const offDiagonal = makeActor(GravityActor, new Vec2(170, 230));
			offDiagonal.applyGravity = false;

			const entered: CollisionObject[] = [];
			sensor.bodyEntered.connect((b) => entered.push(b));

			startScene(game, [sensor, onDiagonal, offDiagonal]);
			game.step();

			// Only the on-diagonal actor should be detected
			expect(entered).toContain(onDiagonal);
			expect(entered).not.toContain(offDiagonal);
		});
	});

	describe("rotation determinism", () => {
		it("same rotated scene produces identical results across runs", () => {
			function runScenario(): number[] {
				const game = createGame();

				const platform = new StaticCollider();
				platform.position = new Vec2(200, 300);
				platform.rotation = Math.PI / 6; // 30°
				const pcs = platform.addChild(CollisionShape);
				pcs.shape = Shape.rect(100, 12);

				const floor = makeStatic(new Vec2(200, 400), 400, 20);

				const actor = new GravityActor();
				actor.position = new Vec2(180, 100);
				const acs = actor.addChild(CollisionShape);
				acs.shape = Shape.capsule(6, 20);

				startScene(game, [platform, floor, actor]);

				const positions: number[] = [];
				for (let i = 0; i < 200; i++) {
					game.step();
					positions.push(actor.position.x, actor.position.y);
				}
				return positions;
			}

			const run1 = runScenario();
			const run2 = runScenario();

			expect(run1.length).toBe(run2.length);
			for (let i = 0; i < run1.length; i++) {
				expect(run1[i]).toBe(run2[i]);
			}
		});
	});

	describe("determinism: identical results across runs", () => {
		it("complex scenario with actors, platforms, sensors produces bitwise-identical results", () => {
			function runScenario(): number[] {
				const game = createGame({
					collisionGroups: {
						player: { collidesWith: ["world", "coins"] },
						world: { collidesWith: ["player"] },
						coins: { collidesWith: ["player"] },
					},
				});

				// Floor
				const floor = makeStatic(new Vec2(400, 500), 800, 20);
				floor.collisionGroup = "world";

				// Platforms
				const plat1 = makeStatic(new Vec2(200, 400), 100, 12);
				plat1.collisionGroup = "world";
				const plat2 = makeStatic(new Vec2(500, 350), 100, 12);
				plat2.collisionGroup = "world";

				// Wall
				const wall = makeStatic(new Vec2(50, 300), 20, 400);
				wall.collisionGroup = "world";

				// Moving Actor
				const actor = new VelocityActor();
				actor.position = new Vec2(200, 0);
				actor.targetVelocity = new Vec2(80, 0);
				actor.collisionGroup = "player";
				const acs = actor.addChild(CollisionShape);
				acs.shape = Shape.rect(14, 24);

				// Sensor (coin)
				const coin = new Sensor();
				coin.position = new Vec2(300, 480);
				coin.collisionGroup = "coins";
				const ccs = coin.addChild(CollisionShape);
				ccs.shape = Shape.circle(8);

				startScene(game, [floor, plat1, plat2, wall, actor, coin]);

				const positions: number[] = [];
				for (let i = 0; i < 200; i++) {
					game.step();
					positions.push(actor.position.x, actor.position.y);
				}
				return positions;
			}

			const run1 = runScenario();
			const run2 = runScenario();

			expect(run1.length).toBe(run2.length);
			for (let i = 0; i < run1.length; i++) {
				expect(run1[i]).toBe(run2[i]);
			}
		});
	});

	describe("plugin ordering: auto-install with warning", () => {
		it("PhysicsPlugin auto-installs with warning when not pre-installed", () => {
			const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
			const canvas = document.createElement("canvas");
			const game = new Game({
				width: 400,
				height: 300,
				canvas,
				renderer: null,
			});
			// Do NOT install PhysicsPlugin

			const actor = makeActor(GravityActor, new Vec2(100, 100));
			startScene(game, [actor]);

			// Should have auto-installed and warned
			expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("auto-installed"));
			expect(game.hasPlugin("physics")).toBe(true);

			// Physics should still function
			game.step();
			expect(actor.position.y).toBeGreaterThan(100);

			warnSpy.mockRestore();
		});
	});

	describe("onOverlap() API", () => {
		it("fires callback when bodies in specified groups overlap", () => {
			const game = createGame({
				collisionGroups: {
					player: { collidesWith: ["enemies"] },
					enemies: { collidesWith: ["player"] },
				},
			});

			const player = makeActor(VelocityActor, new Vec2(0, 0)) as VelocityActor;
			player.applyGravity = false;
			player.collisionGroup = "player";
			player.targetVelocity = new Vec2(200, 0);

			const enemy = makeActor(VelocityActor, new Vec2(50, 0)) as VelocityActor;
			enemy.applyGravity = false;
			enemy.collisionGroup = "enemies";
			enemy.targetVelocity = new Vec2(0, 0);

			startScene(game, [player, enemy]);

			const overlaps: Array<{ a: CollisionObject; b: CollisionObject }> = [];
			game.physics.onOverlap("player", "enemies", (a, b) => {
				overlaps.push({ a, b });
			});

			// Step until overlap
			for (let i = 0; i < 30; i++) {
				game.step();
				if (overlaps.length > 0) break;
			}

			expect(overlaps).toHaveLength(1);
			expect(overlaps[0]?.a).toBe(player);
			expect(overlaps[0]?.b).toBe(enemy);
		});

		it("fires only once per overlap (no duplicates on sustained overlap)", () => {
			const game = createGame({
				collisionGroups: {
					player: { collidesWith: ["enemies"] },
					enemies: { collidesWith: ["player"] },
				},
			});

			// Place them already overlapping
			const player = makeActor(VelocityActor, new Vec2(0, 0)) as VelocityActor;
			player.applyGravity = false;
			player.collisionGroup = "player";
			player.targetVelocity = new Vec2(0, 0);

			const enemy = makeActor(VelocityActor, new Vec2(5, 0)) as VelocityActor;
			enemy.applyGravity = false;
			enemy.collisionGroup = "enemies";
			enemy.targetVelocity = new Vec2(0, 0);

			startScene(game, [player, enemy]);

			let count = 0;
			game.physics.onOverlap("player", "enemies", () => {
				count++;
			});

			game.step();
			game.step();
			game.step();

			expect(count).toBe(1);
		});

		it("exit callback fires when overlap ends", () => {
			const game = createGame({
				collisionGroups: {
					a: { collidesWith: ["b"] },
					b: { collidesWith: ["a"] },
				},
			});

			const bodyA = makeActor(VelocityActor, new Vec2(0, 0)) as VelocityActor;
			bodyA.applyGravity = false;
			bodyA.collisionGroup = "a";
			bodyA.targetVelocity = new Vec2(0, 0);

			const bodyB = makeActor(VelocityActor, new Vec2(5, 0)) as VelocityActor;
			bodyB.applyGravity = false;
			bodyB.collisionGroup = "b";
			bodyB.targetVelocity = new Vec2(0, 0);

			startScene(game, [bodyA, bodyB]);

			let enterCount = 0;
			let exitCount = 0;
			game.physics.onOverlap(
				"a",
				"b",
				() => { enterCount++; },
				() => { exitCount++; },
			);

			game.step(); // Overlap starts
			expect(enterCount).toBe(1);
			expect(exitCount).toBe(0);

			// Separate
			bodyB.position = new Vec2(500, 0);
			game.physics.updatePosition(bodyB);
			game.step(); // Overlap ends

			expect(exitCount).toBe(1);
		});

		it("auto-enables monitoring on target bodies", () => {
			const game = createGame({
				collisionGroups: {
					player: { collidesWith: ["coins"] },
					coins: { collidesWith: ["player"] },
				},
			});

			const player = makeActor(VelocityActor, new Vec2(0, 0)) as VelocityActor;
			player.applyGravity = false;
			player.collisionGroup = "player";
			player.targetVelocity = new Vec2(0, 0);

			const coin = makeActor(VelocityActor, new Vec2(500, 0)) as VelocityActor;
			coin.applyGravity = false;
			coin.collisionGroup = "coins";
			coin.targetVelocity = new Vec2(0, 0);

			startScene(game, [player, coin]);

			expect(player.monitoring).toBe(false);
			expect(coin.monitoring).toBe(false);

			game.physics.onOverlap("player", "coins", () => {});

			expect(player.monitoring).toBe(true);
			expect(coin.monitoring).toBe(true);
		});

		it("dispose function stops further callbacks", () => {
			const game = createGame({
				collisionGroups: {
					a: { collidesWith: ["b"] },
					b: { collidesWith: ["a"] },
				},
			});

			const bodyA = makeActor(VelocityActor, new Vec2(0, 0)) as VelocityActor;
			bodyA.applyGravity = false;
			bodyA.collisionGroup = "a";
			bodyA.targetVelocity = new Vec2(0, 0);

			const bodyB = makeActor(VelocityActor, new Vec2(5, 0)) as VelocityActor;
			bodyB.applyGravity = false;
			bodyB.collisionGroup = "b";
			bodyB.targetVelocity = new Vec2(0, 0);

			startScene(game, [bodyA, bodyB]);

			let count = 0;
			const dispose = game.physics.onOverlap("a", "b", () => {
				count++;
			});

			game.step();
			expect(count).toBe(1);

			// Dispose and separate, then bring back
			dispose();
			bodyB.position = new Vec2(500, 0);
			game.physics.updatePosition(bodyB);
			game.step(); // Exit

			bodyB.position = new Vec2(5, 0);
			game.physics.updatePosition(bodyB);
			game.step(); // Re-overlap, but callback is disposed

			expect(count).toBe(1); // No new callback
		});

		it("re-fires callback after bodies separate and overlap again", () => {
			const game = createGame({
				collisionGroups: {
					a: { collidesWith: ["b"] },
					b: { collidesWith: ["a"] },
				},
			});

			const bodyA = makeActor(VelocityActor, new Vec2(0, 0)) as VelocityActor;
			bodyA.applyGravity = false;
			bodyA.collisionGroup = "a";
			bodyA.targetVelocity = new Vec2(0, 0);

			const bodyB = makeActor(VelocityActor, new Vec2(5, 0)) as VelocityActor;
			bodyB.applyGravity = false;
			bodyB.collisionGroup = "b";
			bodyB.targetVelocity = new Vec2(0, 0);

			startScene(game, [bodyA, bodyB]);

			let count = 0;
			game.physics.onOverlap("a", "b", () => {
				count++;
			});

			game.step(); // First overlap
			expect(count).toBe(1);

			// Separate
			bodyB.position = new Vec2(500, 0);
			game.physics.updatePosition(bodyB);
			game.step(); // No overlap

			// Re-overlap
			bodyB.position = new Vec2(5, 0);
			game.physics.updatePosition(bodyB);
			game.step(); // Second overlap

			expect(count).toBe(2);
		});
	});

	describe("onContact() API", () => {
		it("fires callback when player hits solid enemy during move()", () => {
			const game = createGame({
				collisionGroups: {
					player: { collidesWith: ["enemies"] },
					enemies: { collidesWith: ["player"] },
				},
			});

			const player = makeActor(VelocityActor, new Vec2(0, 0)) as VelocityActor;
			player.applyGravity = false;
			player.collisionGroup = "player";
			player.targetVelocity = new Vec2(200, 0);

			const enemy = makeActor(VelocityActor, new Vec2(50, 0)) as VelocityActor;
			enemy.applyGravity = false;
			enemy.collisionGroup = "enemies";
			enemy.solid = true;
			enemy.targetVelocity = new Vec2(0, 0);

			startScene(game, [player, enemy]);

			const contacts: Array<{ a: CollisionObject; b: CollisionObject; info: CollisionInfo }> = [];
			game.physics.onContact("player", "enemies", (a, b, info) => {
				contacts.push({ a, b, info });
			});

			// Step until collision
			for (let i = 0; i < 30; i++) {
				game.step();
				if (contacts.length > 0) break;
			}

			expect(contacts.length).toBeGreaterThanOrEqual(1);
			expect(contacts[0]!.a).toBe(player);
			expect(contacts[0]!.b).toBe(enemy);
		});

		it("provides correct normal for stomp-vs-side detection", () => {
			const game = createGame({
				collisionGroups: {
					player: { collidesWith: ["enemies", "world"] },
					enemies: { collidesWith: ["player", "world"] },
					world: { collidesWith: ["player", "enemies"] },
				},
			});

			// Player above enemy, falling down
			const player = makeActor(VelocityActor, new Vec2(100, 50)) as VelocityActor;
			player.applyGravity = false;
			player.collisionGroup = "player";
			player.targetVelocity = new Vec2(0, 300);

			const enemy = makeActor(VelocityActor, new Vec2(100, 100)) as VelocityActor;
			enemy.applyGravity = false;
			enemy.collisionGroup = "enemies";
			enemy.solid = true;
			enemy.targetVelocity = new Vec2(0, 0);

			startScene(game, [player, enemy]);

			const normals: Vec2[] = [];
			game.physics.onContact("player", "enemies", (_a, _b, info) => {
				normals.push(info.normal);
			});

			for (let i = 0; i < 30; i++) {
				game.step();
				if (normals.length > 0) break;
			}

			expect(normals.length).toBeGreaterThanOrEqual(1);
			// Normal should point up (stomp from above)
			expect(normals[0]!.y).toBeLessThan(0);
		});

		it("fires for actor-to-static contacts", () => {
			const game = createGame({
				collisionGroups: {
					player: { collidesWith: ["world"] },
					world: { collidesWith: ["player"] },
				},
			});

			const player = makeActor(VelocityActor, new Vec2(0, 0)) as VelocityActor;
			player.applyGravity = false;
			player.collisionGroup = "player";
			player.targetVelocity = new Vec2(200, 0);

			const wall = makeStatic(new Vec2(50, 0), 20, 100);
			wall.collisionGroup = "world";

			startScene(game, [player, wall]);

			const contacts: CollisionInfo[] = [];
			game.physics.onContact("player", "world", (_a, _b, info) => {
				contacts.push(info);
			});

			for (let i = 0; i < 30; i++) {
				game.step();
				if (contacts.length > 0) break;
			}

			expect(contacts.length).toBeGreaterThanOrEqual(1);
			expect(contacts[0]!.collider).toBe(wall);
		});

		it("dispose function stops callbacks", () => {
			const game = createGame({
				collisionGroups: {
					player: { collidesWith: ["world"] },
					world: { collidesWith: ["player"] },
				},
			});

			const player = makeActor(VelocityActor, new Vec2(0, 0)) as VelocityActor;
			player.applyGravity = false;
			player.collisionGroup = "player";
			player.targetVelocity = new Vec2(200, 0);

			const wall = makeStatic(new Vec2(50, 0), 20, 100);
			wall.collisionGroup = "world";

			startScene(game, [player, wall]);

			let count = 0;
			const dispose = game.physics.onContact("player", "world", () => {
				count++;
			});

			// Step until collision
			for (let i = 0; i < 60; i++) {
				game.step();
				if (count > 0) break;
			}
			const countAfterFirst = count;
			expect(countAfterFirst).toBeGreaterThanOrEqual(1);

			dispose();

			// Continue stepping — no more callbacks
			game.step();
			game.step();
			expect(count).toBe(countAfterFirst);
		});
	});

	describe("game.physics accessor", () => {
		it("game.physics returns PhysicsWorld after plugin installed", () => {
			const game = createGame();
			const world = getPhysicsWorld(game);
			expect(game.physics).toBe(world);
		});

		it("game.physics throws before PhysicsPlugin installed", () => {
			const canvas = document.createElement("canvas");
			const game = new Game({ width: 400, height: 300, canvas, renderer: null });
			expect(() => game.physics).toThrow("PhysicsPlugin not installed");
		});
	});

	describe("monitoring toggle stale overlap fix", () => {
		it("toggling monitoring off clears overlaps and fires exit events", () => {
			const game = createGame();
			const actor1 = makeActor(VelocityActor, new Vec2(0, 0)) as VelocityActor;
			actor1.applyGravity = false;
			actor1.monitoring = true;
			actor1.targetVelocity = new Vec2(0, 0);

			const actor2 = makeActor(VelocityActor, new Vec2(5, 0)) as VelocityActor;
			actor2.applyGravity = false;
			actor2.targetVelocity = new Vec2(0, 0);

			startScene(game, [actor1, actor2]);

			const entered: CollisionObject[] = [];
			const exited: CollisionObject[] = [];
			actor1.bodyEntered.connect((b) => entered.push(b));
			actor1.bodyExited.connect((b) => exited.push(b));

			game.step(); // Overlap detected
			expect(entered).toHaveLength(1);
			expect(exited).toHaveLength(0);

			// Turn off monitoring
			actor1.monitoring = false;
			game.step(); // Should fire exit events and clear overlaps

			expect(exited).toHaveLength(1);
			expect(exited[0]).toBe(actor2);

			// Turn monitoring back on
			actor1.monitoring = true;
			game.step(); // Should re-detect the overlap

			expect(entered).toHaveLength(2); // Second enter event
		});
	});

	describe("body destruction during callback", () => {
		it("destroying a body in onOverlap callback doesn't crash", () => {
			const game = createGame({
				collisionGroups: {
					player: { collidesWith: ["coins"] },
					coins: { collidesWith: ["player"] },
				},
			});

			const player = makeActor(VelocityActor, new Vec2(0, 0)) as VelocityActor;
			player.applyGravity = false;
			player.collisionGroup = "player";
			player.targetVelocity = new Vec2(200, 0);

			const coin = makeActor(VelocityActor, new Vec2(30, 0)) as VelocityActor;
			coin.applyGravity = false;
			coin.collisionGroup = "coins";
			coin.targetVelocity = new Vec2(0, 0);

			startScene(game, [player, coin]);

			game.physics.onOverlap("player", "coins", (_p, c) => {
				c.destroy();
			});

			// Should not crash
			expect(() => {
				for (let i = 0; i < 30; i++) game.step();
			}).not.toThrow();

			expect(coin.isDestroyed).toBe(true);
		});

		it("destroying a body in onContact callback doesn't crash", () => {
			const game = createGame({
				collisionGroups: {
					player: { collidesWith: ["enemies"] },
					enemies: { collidesWith: ["player"] },
				},
			});

			const player = makeActor(VelocityActor, new Vec2(0, 0)) as VelocityActor;
			player.applyGravity = false;
			player.collisionGroup = "player";
			player.targetVelocity = new Vec2(200, 0);

			const enemy = makeActor(VelocityActor, new Vec2(50, 0)) as VelocityActor;
			enemy.applyGravity = false;
			enemy.collisionGroup = "enemies";
			enemy.solid = true;
			enemy.targetVelocity = new Vec2(0, 0);

			startScene(game, [player, enemy]);

			game.physics.onContact("player", "enemies", (_p, e) => {
				e.destroy();
			});

			// Should not crash
			expect(() => {
				for (let i = 0; i < 30; i++) game.step();
			}).not.toThrow();

			expect(enemy.isDestroyed).toBe(true);
		});
	});

	describe("actor monitoring determinism", () => {
		it("monitored actor overlaps produce identical event sequence across runs", () => {
			function runScenario(): { frame: number; type: string }[] {
				const game = createGame({
					collisionGroups: {
						player: { collidesWith: ["enemies"] },
						enemies: { collidesWith: ["player", "world"] },
						world: { collidesWith: ["player", "enemies"] },
					},
				});

				const floor = makeStatic(new Vec2(200, 300), 400, 20);
				floor.collisionGroup = "world";

				const player = new VelocityActor();
				player.position = new Vec2(100, 200);
				player.collisionGroup = "player";
				player.monitoring = true;
				player.targetVelocity = new Vec2(50, 0);
				const pcs = player.addChild(CollisionShape);
				pcs.shape = Shape.rect(14, 24);

				const enemy = new VelocityActor();
				enemy.position = new Vec2(200, 200);
				enemy.collisionGroup = "enemies";
				enemy.targetVelocity = new Vec2(-30, 0);
				const ecs = enemy.addChild(CollisionShape);
				ecs.shape = Shape.rect(14, 14);

				startScene(game, [floor, player, enemy]);

				let frame = 0;
				const events: { frame: number; type: string }[] = [];
				player.bodyEntered.connect(() => events.push({ frame, type: "entered" }));
				player.bodyExited.connect(() => events.push({ frame, type: "exited" }));

				for (let i = 0; i < 200; i++) {
					frame = i;
					game.step();
				}
				return events;
			}

			const run1 = runScenario();
			const run2 = runScenario();

			expect(run1).toEqual(run2);
			// Ensure events actually fired
			expect(run1.length).toBeGreaterThan(0);
		});
	});
});
