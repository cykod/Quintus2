import { Vec2 } from "@quintus/math";
import { CollisionShape, Shape } from "@quintus/physics";
import { AnimatedSprite } from "@quintus/sprites";
import { slimeSheet } from "../../sprites.js";
import { BaseEnemy } from "./base-enemy.js";

/** Ground patrol enemy. Walks back and forth, reverses at edges and walls. */
export class Slime extends BaseEnemy {
	speed = 60;
	direction = 1;
	readonly scoreValue = 100;

	override build() {
		return (
			<>
				<CollisionShape shape={Shape.rect(48, 32)} />
				<AnimatedSprite ref="sprite" spriteSheet={slimeSheet} animation="walk" centered />
			</>
		);
	}

	override onFixedUpdate(dt: number) {
		if (this._isDead) return;

		const dir = this.direction > 0 ? Vec2.RIGHT : Vec2.LEFT;

		if (this.isOnFloor() && this.isEdgeAhead(dir)) {
			this.direction *= -1;
		}
		if (this.isOnWall()) {
			this.direction *= -1;
		}

		this.velocity.x = this.speed * this.direction;
		this.move(dt);

		this.sprite.flipH = this.direction > 0;
	}

	override stomp(): void {
		if (this._isDead) return;
		this.sprite.play("flat");
		super.stomp();
	}
}
