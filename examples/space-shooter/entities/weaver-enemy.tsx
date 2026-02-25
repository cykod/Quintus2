import { type Signal, signal } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import { Actor, CollisionShape, Shape } from "@quintus/physics";
import type { Shape2D } from "@quintus/physics";
import { Sprite } from "@quintus/sprites";
import {
	GAME_HEIGHT,
	WEAVER_AMPLITUDE,
	WEAVER_ENEMY_HP,
	WEAVER_ENEMY_POINTS,
	WEAVER_ENEMY_SPEED,
	WEAVER_FREQUENCY,
} from "../config.js";
import { FRAME, tilesetAtlas, WEAVER_ENEMY_SCALE_X, WEAVER_ENEMY_SCALE_Y } from "../sprites.js";
import { spawnFlash } from "./explosion.js";

/** Hexagonal hull for weaver enemy (~36×28 visual). */
const WEAVER_ENEMY_SHAPE: Shape2D = Shape.polygon([
	new Vec2(-8, -13),
	new Vec2(8, -13),
	new Vec2(17, 0),
	new Vec2(8, 13),
	new Vec2(-8, 13),
	new Vec2(-17, 0),
]);

export class WeaverEnemy extends Actor {
	override collisionGroup = "enemies";
	override solid = true;
	override gravity = 0;
	override applyGravity = false;

	hp = WEAVER_ENEMY_HP;
	points = WEAVER_ENEMY_POINTS;

	/** Starting X position (sine oscillation center). */
	startX = 0;

	readonly died: Signal<WeaverEnemy> = signal<WeaverEnemy>();

	private _elapsed = 0;

	override build() {
		return (
			<>
				<CollisionShape shape={WEAVER_ENEMY_SHAPE} />
				<Sprite
					texture="tileset"
					sourceRect={tilesetAtlas.getFrameOrThrow(FRAME.WEAVER_ENEMY)}
					scale={[WEAVER_ENEMY_SCALE_X, WEAVER_ENEMY_SCALE_Y]}
				/>
			</>
		);
	}

	override onReady() {
		super.onReady();
		this.tag("enemy");
		this.startX = this.position.x;
	}

	override onFixedUpdate(dt: number) {
		this._elapsed += dt;

		// Sine wave horizontal + downward drift
		const targetX = this.startX + Math.sin(this._elapsed * WEAVER_FREQUENCY) * WEAVER_AMPLITUDE;
		this.velocity._set((targetX - this.position.x) / dt, WEAVER_ENEMY_SPEED);
		this.move(dt);

		// Wrap to top when off-screen bottom
		if (this.position.y > GAME_HEIGHT + 40) {
			this.position._set(this.startX, -30);
			this._elapsed = 0;
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
