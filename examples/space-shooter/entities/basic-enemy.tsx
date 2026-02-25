import { type Signal, signal } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import { Actor, CollisionShape, Shape } from "@quintus/physics";
import type { Shape2D } from "@quintus/physics";
import { Sprite } from "@quintus/sprites";
import { BASIC_ENEMY_HP, BASIC_ENEMY_POINTS, BASIC_ENEMY_SPEED, GAME_HEIGHT } from "../config.js";
import { BASIC_ENEMY_SCALE_X, BASIC_ENEMY_SCALE_Y, FRAME, tilesetAtlas } from "../sprites.js";
import { spawnFlash } from "./explosion.js";

/** Hexagonal hull for basic enemy (~36×32 visual). */
const BASIC_ENEMY_SHAPE: Shape2D = Shape.polygon([
	new Vec2(-8, -15),
	new Vec2(8, -15),
	new Vec2(17, 0),
	new Vec2(8, 15),
	new Vec2(-8, 15),
	new Vec2(-17, 0),
]);

export class BasicEnemy extends Actor {
	override collisionGroup = "enemies";
	override solid = true;
	override gravity = 0;
	override applyGravity = false;

	hp = BASIC_ENEMY_HP;
	points = BASIC_ENEMY_POINTS;

	readonly died: Signal<BasicEnemy> = signal<BasicEnemy>();

	override build() {
		return (
			<>
				<CollisionShape shape={BASIC_ENEMY_SHAPE} />
				<Sprite
					texture="tileset"
					sourceRect={tilesetAtlas.getFrameOrThrow(FRAME.BASIC_ENEMY)}
					scale={[BASIC_ENEMY_SCALE_X, BASIC_ENEMY_SCALE_Y]}
				/>
			</>
		);
	}

	override onReady() {
		super.onReady();
		this.tag("enemy");
	}

	override onFixedUpdate(dt: number) {
		this.velocity._set(0, BASIC_ENEMY_SPEED);
		this.move(dt);

		// Wrap to top when off-screen bottom
		if (this.position.y > GAME_HEIGHT + 40) {
			this.position._set(this.position.x, -30);
			const world = this._getWorld();
			if (world) world.updatePosition(this);
		}
	}

	takeDamage(amount: number, hitPoint?: Vec2): void {
		this.hp -= amount;
		if (this.hp <= 0) {
			this.game.audio.play("enemy_die", { bus: "sfx" });
			this.died.emit(this);
			this.destroy();
		} else {
			this.game.audio.play("enemy_hit", { bus: "sfx", volume: 0.5 });
			spawnFlash(this, hitPoint ?? this.position);
		}
	}

	serialize(): Record<string, unknown> {
		return { hp: this.hp, x: this.position.x, y: this.position.y };
	}
}
