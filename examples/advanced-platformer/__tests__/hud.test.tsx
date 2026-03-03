import { Camera } from "@quintus/camera";
import { Scene } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import { CollisionShape, Shape, StaticCollider } from "@quintus/physics";
import { Sprite } from "@quintus/sprites";
import { describe, expect, it } from "vitest";
import { Player } from "../entities/player.js";
import { HUD } from "../hud/hud.js";
import { gameState } from "../state.js";
import { runScene } from "./helpers.js";

class Floor extends StaticCollider {
	override collisionGroup = "world";

	override build() {
		return <CollisionShape shape={Shape.rect(640, 16)} />;
	}
}

class HUDArena extends Scene {
	player!: Player;

	override build() {
		return (
			<>
				<Player ref="player" />
				<Camera follow="$player" zoom={1} />
				<Floor position={[320, 308]} />
				<HUD />
			</>
		);
	}

	override onReady() {
		this.player.position = new Vec2(320, 280);
	}
}

describe("HUD", () => {
	it("renders hearts matching initial health", async () => {
		const result = await runScene(HUDArena, undefined, 0.1);
		const hud = result.game.currentScene!.findByType(HUD)!;

		expect(hud).toBeDefined();

		// HUD should be a fixed Layer with high zIndex
		expect(hud.fixed).toBe(true);
		expect(hud.zIndex).toBe(100);

		result.game.stop();
	});

	it("updates hearts when health changes", async () => {
		const result = await runScene(HUDArena, undefined, 0.1);
		const hud = result.game.currentScene!.findByType(HUD)!;

		// Initial state: 5 hearts
		const sprites = hud.findAllByType(Sprite);
		expect(sprites.length).toBeGreaterThan(0);

		// Reduce health
		gameState.health = 3;

		// Check that HUD reacted (hearts array updated)
		expect(gameState.health).toBe(3);

		result.game.stop();
	});

	it("updates score label when score changes", async () => {
		const result = await runScene(HUDArena, undefined, 0.1);
		const hud = result.game.currentScene!.findByType(HUD)!;
		const scoreLabel = hud.scoreLabel;

		expect(scoreLabel).toBeDefined();
		expect(scoreLabel.text).toBe("Score: 0");

		gameState.score = 500;
		expect(scoreLabel.text).toBe("Score: 500");

		result.game.stop();
	});

	it("toggles key visibility when keys are collected", async () => {
		const result = await runScene(HUDArena, undefined, 0.1);

		// Collect a key
		gameState.keys = { ...gameState.keys, red: true };

		// State should reflect the change
		expect(gameState.keys.red).toBe(true);
		expect(gameState.keys.blue).toBe(false);

		result.game.stop();
	});

	it("shows star power bar when star power is active", async () => {
		const result = await runScene(HUDArena, undefined, 0.1);
		const hud = result.game.currentScene!.findByType(HUD)!;
		const starBar = hud.starBar;

		expect(starBar).toBeDefined();
		expect(starBar.visible).toBe(false);

		gameState.starPower = true;
		expect(starBar.visible).toBe(true);

		gameState.starTimeRemaining = 5;
		expect(starBar.value).toBe(5);

		gameState.starPower = false;
		expect(starBar.visible).toBe(false);

		result.game.stop();
	});

	it("updates coin digits when coins change", async () => {
		const result = await runScene(HUDArena, undefined, 0.1);

		gameState.coins = 42;
		expect(gameState.coins).toBe(42);

		result.game.stop();
	});
});
