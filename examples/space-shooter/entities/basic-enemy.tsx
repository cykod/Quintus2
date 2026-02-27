import { Damageable } from "@quintus/ai-prefabs";
import { Vec2 } from "@quintus/math";
import type { Shape2D } from "@quintus/physics";
import { Actor, CollisionShape, Shape } from "@quintus/physics";
import { Sprite } from "@quintus/sprites";
import { BASIC_ENEMY_HP, BASIC_ENEMY_POINTS, BASIC_ENEMY_SPEED, GAME_HEIGHT } from "../config.js";
import { BASIC_ENEMY_SCALE_X, BASIC_ENEMY_SCALE_Y, FRAME, tilesetAtlas } from "../sprites.js";
import { spawnFlash } from "./explosion.js";

const DamageableActor = Damageable(Actor, { invincibilityDuration: 0, deathTween: false });

/** Hexagonal hull for basic enemy (~36x32 visual). */
const BASIC_ENEMY_SHAPE: Shape2D = Shape.polygon([
	new Vec2(-8, -15),
	new Vec2(8, -15),
	new Vec2(17, 0),
	new Vec2(8, 15),
	new Vec2(-8, 15),
	new Vec2(-17, 0),
]);

export class BasicEnemy extends DamageableActor {
	override collisionGroup = "enemies";
	override solid = true;
	override gravity = 0;
	override applyGravity = false;

	override maxHealth = BASIC_ENEMY_HP;
	points = BASIC_ENEMY_POINTS;

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

	override takeDamage(amount: number, hitPoint?: Vec2): void {
		if (this.isDead() || this.isInvincible()) return;
		const willDie = this.health <= amount;
		if (willDie) {
			this.game.audio.play("enemy_die", { bus: "sfx" });
		} else {
			this.game.audio.play("enemy_hit", { bus: "sfx", volume: 0.5 });
			spawnFlash(this, hitPoint ?? this.position);
		}
		super.takeDamage(amount);
	}
}
