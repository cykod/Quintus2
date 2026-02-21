import { Game, Node2D, Scene } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import { Actor, PhysicsPlugin } from "@quintus/physics";
import { describe, expect, it } from "vitest";
import "./augment.js";
import { TweenPlugin } from "./tween-plugin.js";

class TestActor extends Actor {
	override gravity = 0;
	override applyGravity = false;
	override upDirection = Vec2.ZERO;
}

class TestScene extends Scene {
	onReady() {
		const actor = new TestActor();
		actor.name = "actor";
		this.addChild(actor);

		const child = new Node2D();
		child.name = "child";
		actor.addChild(child);
	}
}

function createGame(): Game {
	return new Game({
		width: 320,
		height: 240,
		renderer: null,
	});
}

describe("Tween on Actor child during physics", () => {
	it("tween on child Node2D of Actor works during physics", () => {
		const game = createGame();
		game.use(PhysicsPlugin());
		game.use(TweenPlugin());
		game.start(TestScene);

		const scene = game.currentScene as Scene;
		const actor = scene.find("actor") as Actor;
		const child = scene.find("child") as Node2D;
		expect(actor).toBeTruthy();
		expect(child).toBeTruthy();

		child.rotation = 0;
		const dt = game.fixedDeltaTime;
		child.tween().to({ rotation: Math.PI }, dt * 10);

		// Step several frames
		for (let i = 0; i < 5; i++) game.step();
		expect(child.rotation).toBeGreaterThan(0);
		expect(child.rotation).toBeLessThan(Math.PI);

		// Step to completion
		for (let i = 0; i < 5; i++) game.step();
		expect(child.rotation).toBeCloseTo(Math.PI, 1);

		game.stop();
	});

	it("tween on child position of Actor works during physics", () => {
		const game = createGame();
		game.use(PhysicsPlugin());
		game.use(TweenPlugin());
		game.start(TestScene);

		const scene = game.currentScene as Scene;
		const child = scene.find("child") as Node2D;
		expect(child).toBeTruthy();

		child.position.x = 0;
		child.position.y = 0;
		const dt = game.fixedDeltaTime;
		child.tween().to({ position: { x: 10, y: 5 } }, dt * 4);

		game.step();
		game.step();
		expect(child.position.x).toBeGreaterThan(0);
		expect(child.position.y).toBeGreaterThan(0);

		game.step();
		game.step();
		expect(child.position.x).toBeCloseTo(10, 0);
		expect(child.position.y).toBeCloseTo(5, 0);

		game.stop();
	});
});
