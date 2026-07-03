import { Actor, AnimatedSprite, CollisionShape, Shape, Vec2 } from "quintus2";
import { SPRITE_SCALE } from "../config.js";
import { entitySheet } from "../sprites.js";
import { gameState } from "../state.js";

/** Code-controlled player: run left/right, jump from the floor, gravity from the physics plugin. */
export class Player extends Actor {
	speed = 130;
	jumpForce = -340;
	override collisionGroup = "player";
	override solid = true;

	sprite!: AnimatedSprite;

	/** Where to respawn after an enemy hit — captured from the starting position. */
	private spawn = new Vec2(0, 0);
	/** Frames of post-hit invulnerability remaining (blinks + ignores enemy touches). */
	private invulnerable = 0;

	override build() {
		return (
			<>
				<CollisionShape shape={Shape.rect(12, 14)} />
				<AnimatedSprite
					ref="sprite"
					spriteSheet={entitySheet}
					animation="player_idle"
					scale={SPRITE_SCALE}
				/>
			</>
		);
	}

	override onReady() {
		super.onReady(); // Actor.onReady initializes gravity from the world + registers the body
		this.tag("player");
		this.spawn = this.position.clone();
	}

	/** Called by an enemy on contact: lose a life, respawn, and go briefly invulnerable. */
	hitByEnemy() {
		if (this.invulnerable > 0) return;
		gameState.lives = Math.max(0, gameState.lives - 1);
		this.position = this.spawn.clone();
		this.velocity = new Vec2(0, 0);
		this.invulnerable = 90; // ~1.5s at 60fps
	}

	override onFixedUpdate(dt: number) {
		const input = this.game.input;

		if (this.invulnerable > 0) {
			this.invulnerable--;
			this.sprite.visible = Math.floor(this.invulnerable / 6) % 2 === 0;
			if (this.invulnerable === 0) this.sprite.visible = true;
		}

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
