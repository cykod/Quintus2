import { Game, Node2D, Scene } from "@quintus/core";
import { describe, expect, it } from "vitest";
import { TweenPlugin } from "./tween-plugin.js";
import "./augment.js";

class TestScene extends Scene {
	onReady() {
		const node = new Node2D();
		node.name = "target";
		this.add(node);
	}
}

function createGame(): Game {
	return new Game({
		width: 320,
		height: 240,
		renderer: null,
	});
}

describe("Tween integration", () => {
	it("tween works through Game + Scene + step()", () => {
		const game = createGame();
		game.use(TweenPlugin());
		game.start(TestScene);

		const target = (game.currentScene as Scene).find("target") as Node2D;
		expect(target).toBeTruthy();

		target.alpha = 1;
		target.tween().to({ alpha: 0 }, game.fixedDeltaTime * 2);

		// Step one frame
		game.step();
		expect(target.alpha).toBeLessThan(1);
		expect(target.alpha).toBeGreaterThan(0);

		// Step second frame
		game.step();
		expect(target.alpha).toBeCloseTo(0, 1);

		game.stop();
	});

	it("node.tween() throws without TweenPlugin", () => {
		const game = createGame();
		game.start(TestScene);

		const target = (game.currentScene as Scene).find("target") as Node2D;
		expect(() => target.tween()).toThrow("TweenPlugin not installed");

		game.stop();
	});

	it("node.killTweens() kills all tweens on the node", () => {
		const game = createGame();
		game.use(TweenPlugin());
		game.start(TestScene);

		const target = (game.currentScene as Scene).find("target") as Node2D;
		target.alpha = 1;
		target.rotation = 0;
		target.tween().to({ alpha: 0 }, 1);
		target.tween().to({ rotation: Math.PI }, 1);

		target.killTweens();
		game.step();

		expect(target.alpha).toBe(1);
		expect(target.rotation).toBe(0);

		game.stop();
	});

	it("tween + position sub-property through game.step()", () => {
		const game = createGame();
		game.use(TweenPlugin());
		game.start(TestScene);

		const target = (game.currentScene as Scene).find("target") as Node2D;
		target.position.x = 0;
		target.position.y = 0;
		const dt = game.fixedDeltaTime;
		target.tween().to({ position: { x: 100, y: 200 } }, dt * 4);

		game.step();
		game.step();
		expect(target.position.x).toBeGreaterThan(0);
		expect(target.position.y).toBeGreaterThan(0);

		game.step();
		game.step();
		expect(target.position.x).toBeCloseTo(100, 0);
		expect(target.position.y).toBeCloseTo(200, 0);

		game.stop();
	});

	it("game.stop() kills all tweens", () => {
		const game = createGame();
		game.use(TweenPlugin());
		game.start(TestScene);

		const target = (game.currentScene as Scene).find("target") as Node2D;
		target.alpha = 1;
		const tween = target.tween().to({ alpha: 0 }, 1);

		game.stop();
		expect(tween.isKilled).toBe(true);
	});
});
