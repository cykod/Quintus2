import { Game, Scene } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import { describe, expect, it } from "vitest";
import { Button } from "./button.js";
import { Container } from "./container.js";
import { Label } from "./label.js";
import { Layer } from "./layer.js";
import { Panel } from "./panel.js";
import { ProgressBar } from "./progress-bar.js";

class TestScene extends Scene {
	onReady() {}
}

function createGame(): Game {
	return new Game({
		width: 320,
		height: 240,
		renderer: null,
	});
}

describe("UI integration", () => {
	it("HUD with multiple widgets composed", () => {
		const game = createGame();
		game.start(TestScene);
		const scene = game.currentScene as Scene;

		// Create HUD layer
		const hud = new Layer();
		hud.fixed = true;
		hud.zIndex = 100;
		scene.addChild(hud);

		// Panel background
		const panel = new Panel();
		panel.width = 300;
		panel.height = 50;
		panel.position = new Vec2(10, 10);
		hud.addChild(panel);

		// Container inside panel
		const container = new Container();
		container.direction = "horizontal";
		container.gap = 10;
		container.width = 280;
		container.height = 40;
		container.position = new Vec2(10, 5);
		panel.addChild(container);

		// Score label
		const score = new Label();
		score.text = "Score: 0";
		score.width = 80;
		score.height = 20;
		container.addChild(score);

		// Health bar
		const health = new ProgressBar();
		health.width = 100;
		health.height = 20;
		health.maxValue = 100;
		health.value = 75;
		container.addChild(health);

		// All children should be renderFixed
		expect(panel.renderFixed).toBe(true);
		expect(container.renderFixed).toBe(true);
		expect(score.renderFixed).toBe(true);
		expect(health.renderFixed).toBe(true);

		// Step to trigger container layout
		game.step();

		// Container should have positioned children
		expect(score.position.x).toBe(0);
		expect(health.position.x).toBe(90); // 80 + 10 gap

		// Health bar ratio
		expect(health.ratio).toBeCloseTo(0.75);

		game.stop();
	});

	it("button in scene responds to pointer events", () => {
		const game = createGame();
		game.start(TestScene);
		const scene = game.currentScene as Scene;

		const btn = new Button();
		btn.text = "Play";
		btn.width = 120;
		btn.height = 40;
		btn.position = new Vec2(100, 100);
		scene.addChild(btn);

		let clicked = false;
		btn.onPressed.connect(() => {
			clicked = true;
		});

		// Simulate click
		btn._onPointerDown(150, 120);
		btn._onPointerUp(150, 120);
		expect(clicked).toBe(true);

		game.stop();
	});
});
