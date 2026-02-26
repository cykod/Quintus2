import { Pickup } from "@quintus/ai-prefabs";
import type { Actor } from "@quintus/physics";
import { CollisionShape, Shape } from "@quintus/physics";
import { AnimatedSprite } from "@quintus/sprites";
import { entitySheet } from "../sprites.js";
import { gameState } from "../state.js";

// Coin uses the Pickup base class from @quintus/ai-prefabs which provides:
// - Sine-wave bob animation (replaces repeating tween)
// - Tag-based collection with double-collect guard
// - Pop scale effect + self-destruction on collect
// Coin only adds game-specific scoring, audio, and a sprite fade.
export class Coin extends Pickup {
	override collisionGroup = "items";

	sprite!: AnimatedSprite;

	constructor() {
		super();
		this.collectTag = "player";
		this.bobAmount = 2; // ±2 px oscillation (4 px total range, matching original tween)
		this.bobSpeed = 1.6; // 1.6 s full sine cycle ≈ original 0.8 s × 2 tween legs
		this.popScale = 1.8;
		this.popDuration = 0.2;
	}

	override build() {
		return (
			<>
				<CollisionShape shape={Shape.circle(4)} />
				<AnimatedSprite ref="sprite" spriteSheet={entitySheet} animation="coin_idle" />
			</>
		);
	}

	override onReady() {
		super.onReady(); // Pickup wires bodyEntered + stores baseY for bob
		this.tag("coin");
	}

	protected override onCollect(_collector: Actor): void {
		gameState.coins++;
		gameState.score += 10;
		this.game?.audio.play("coin", { bus: "sfx" });
		// Fade sprite alongside Pickup's pop scale effect
		this.sprite.killTweens();
		this.sprite.tween().to({ alpha: 0 }, this.popDuration);
	}
}
