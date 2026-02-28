import "@quintus/tilemap/physics";
import { Camera } from "@quintus/camera";
import { Scene } from "@quintus/core";
import { Rect, Vec2 } from "@quintus/math";
import { Actor, CollisionShape, Shape } from "@quintus/physics";
import { AnimatedSprite } from "@quintus/sprites";
import { TileMap } from "@quintus/tilemap";
import { playerSheet } from "../sprites.js";

/**
 * Minimal test player for verifying asset loading.
 * Real Player class comes in Phase 3.
 */
class TestPlayer extends Actor {
	speed = 200;
	jumpForce = -450;

	sprite!: AnimatedSprite;

	override collisionGroup = "player";

	override build() {
		return (
			<>
				<CollisionShape shape={Shape.rect(40, 56)} />
				<AnimatedSprite ref="sprite" spriteSheet={playerSheet} animation="idle" centered />
			</>
		);
	}

	override onReady() {
		super.onReady();
		this.tag("player");
	}

	override onFixedUpdate(dt: number) {
		const input = this.game.input;

		this.velocity.x = 0;
		if (input.isPressed("left")) {
			this.velocity.x = -this.speed;
			this.sprite.flipH = true;
			this.sprite.play("walk");
		} else if (input.isPressed("right")) {
			this.velocity.x = this.speed;
			this.sprite.flipH = false;
			this.sprite.play("walk");
		} else if (this.isOnFloor()) {
			this.sprite.play("idle");
		}

		if (input.isJustPressed("jump") && this.isOnFloor()) {
			this.velocity.y = this.jumpForce;
			this.sprite.play("jump");
		}

		if (!this.isOnFloor() && this.velocity.y > 0) {
			this.sprite.play("jump");
		}

		this.move(dt);

		// Respawn if fallen off
		if (this.position.y > 800) {
			this.position = new Vec2(128, 300);
			this.velocity = new Vec2(0, 0);
		}
	}
}

/**
 * Test scene for Phase 2: verifies tilemap rendering, collision, and character sprite.
 */
export class TestScene extends Scene {
	protected player!: TestPlayer;
	protected map!: TileMap;

	override build() {
		return (
			<>
				<TileMap ref="map" tilesetImage="tiles" asset="level1" />
				<TestPlayer ref="player" />
				<Camera ref="camera" follow="$player" smoothing={0.1} zoom={1} />
			</>
		);
	}

	override onReady() {
		// Generate collision from the main tile layer
		const oneWayIds = this.map.getTileIdsByProperty("oneWay", true);
		this.map.generateCollision({
			layer: "main",
			allSolid: true,
			collisionGroup: "world",
			oneWayTileIds: oneWayIds,
		});

		// Position player at the spawn point
		this.player.position = this.map.getSpawnPoint("player_start");

		// Camera bounds
		const camera = this.findFirst(Camera);
		if (camera) {
			camera.bounds = new Rect(0, 0, this.map.bounds.width, this.map.bounds.height);
		}
	}
}
