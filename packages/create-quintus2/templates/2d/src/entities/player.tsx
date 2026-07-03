import { Actor, AnimatedSprite, CollisionShape, Shape } from "quintus2";
import { entitySheet } from "../sprites.js";

/** Code-controlled player: run left/right, jump from the floor, gravity from the physics plugin. */
export class Player extends Actor {
	speed = 120;
	jumpForce = -300;
	override collisionGroup = "player";
	override solid = true;

	sprite!: AnimatedSprite;

	override build() {
		return (
			<>
				<CollisionShape shape={Shape.rect(6, 7)} />
				<AnimatedSprite ref="sprite" spriteSheet={entitySheet} animation="player_idle" />
			</>
		);
	}

	override onReady() {
		super.onReady(); // Actor.onReady initializes gravity from the world + registers the body
		this.tag("player");
	}

	override onFixedUpdate(dt: number) {
		const input = this.game.input;

		this.velocity.x = 0;
		if (input.isPressed("left")) {
			this.velocity.x = -this.speed;
			this.sprite.flipH = true;
		}
		if (input.isPressed("right")) {
			this.velocity.x = this.speed;
			this.sprite.flipH = false;
		}

		if (input.isJustPressed("jump") && this.isOnFloor()) {
			this.velocity.y = this.jumpForce;
		}

		this.move(dt);

		if (!this.isOnFloor()) {
			this.sprite.play("player_jump");
		} else if (Math.abs(this.velocity.x) > 1) {
			this.sprite.play("player_run");
		} else {
			this.sprite.play("player_idle");
		}
	}
}
