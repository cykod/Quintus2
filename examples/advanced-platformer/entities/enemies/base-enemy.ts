import { type Signal, signal } from "@quintus/core";
import { Actor } from "@quintus/physics";
import type { AnimatedSprite } from "@quintus/sprites";
import { Ease } from "@quintus/tween";
import { gameState } from "../../state.js";

/**
 * Abstract base class for all enemies.
 *
 * Does NOT use the Damageable mixin because enemies have 1 HP,
 * use custom squash+fade death animations, and need overrideable
 * stomp() behavior (e.g., Snail's shell mechanic).
 */
export abstract class BaseEnemy extends Actor {
	abstract readonly scoreValue: number;

	override solid = true;
	override collisionGroup = "enemies";

	readonly died: Signal<void> = signal<void>();

	protected _isDead = false;
	sprite!: AnimatedSprite;

	override onReady() {
		super.onReady();
		this.tag("enemy");
	}

	/** Called when the player stomps this enemy. Awards score and plays death animation. */
	stomp(): void {
		if (this._isDead) return;
		this._isDead = true;

		gameState.score += this.scoreValue;
		this.game?.audio.play("disappear", { bus: "sfx" });

		this._playDeathAnim();
		this.died.emit();
	}

	/** Default squash + fade death animation. Subclasses can override. */
	protected _playDeathAnim(): void {
		this.killTweens();
		this.tween()
			.to({ scale: { x: 1.5, y: 0.3 } }, 0.15, Ease.quadOut)
			.onComplete(() => this.destroy());

		this.sprite.killTweens();
		this.sprite.tween().to({ alpha: 0 }, 0.15);
	}
}
