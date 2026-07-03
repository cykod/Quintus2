import { Actor, AnimatedSprite, CollisionShape, Shape, Vec2 } from "quintus2";
import { SPRITE_SCALE } from "../config.js";
import { entitySheet } from "../sprites.js";
import { Player } from "./player.js";

/**
 * Walks back and forth along the ground, reversing at walls and platform edges.
 * On touching the player it calls `player.hitByEnemy()` (respawn + lose a life).
 */
export class Enemy extends Actor {
	speed = 45;
	direction = 1;
	override collisionGroup = "enemies";
	override solid = true;

	sprite!: AnimatedSprite;

	override build() {
		return (
			<>
				<CollisionShape shape={Shape.rect(12, 12)} />
				<AnimatedSprite
					ref="sprite"
					spriteSheet={entitySheet}
					animation="enemy_walk"
					scale={SPRITE_SCALE}
				/>
			</>
		);
	}

	override onReady() {
		super.onReady();
		this.tag("enemy");
	}

	override onFixedUpdate(dt: number) {
		const dir = this.direction > 0 ? Vec2.RIGHT : Vec2.LEFT;

		// Reverse at a wall, or at the edge of the platform/floor we're standing on.
		if (this.isOnWall() || (this.isOnFloor() && this.isEdgeAhead(dir))) {
			this.direction *= -1;
		}

		this.velocity.x = this.speed * this.direction;
		this.move(dt);
		this.sprite.flipH = this.direction < 0;

		// Simple AABB touch test against the player — robust no matter who moved.
		const player = this.scene.findByType(Player);
		if (player) {
			const dx = Math.abs(player.globalPosition.x - this.globalPosition.x);
			const dy = Math.abs(player.globalPosition.y - this.globalPosition.y);
			if (dx < 13 && dy < 13) player.hitByEnemy();
		}
	}
}
