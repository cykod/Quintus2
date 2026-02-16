import type { DrawContext } from "@quintus/core";
import { type Signal, signal } from "@quintus/core";
import { Color, Vec2 } from "@quintus/math";
import { Actor, CollisionShape, Shape } from "@quintus/physics";
import { Ease } from "@quintus/tween";
import { gameState } from "../state.js";

export class PatrolEnemy extends Actor {
	speed = 40;
	direction = 1;
	override solid = true;
	override collisionGroup = "enemies";

	readonly died: Signal<void> = signal<void>();

	override onReady() {
		super.onReady();
		this.addChild(CollisionShape).shape = Shape.rect(14, 12);
		this.tag("enemy");
	}

	override onFixedUpdate(dt: number) {
		const wasOnFloor = this.isOnFloor();
		this.velocity.x = this.speed * this.direction;

		if (this.isOnWall()) {
			this.direction *= -1;
		}

		this.move(dt);

		// Edge detection: if we walked off a platform, reverse and snap back
		if (wasOnFloor && !this.isOnFloor()) {
			this.position.x -= this.velocity.x * dt;
			this.velocity.x = 0;
			this.velocity.y = 0;
			this.direction *= -1;
		}
	}

	stomp(): void {
		this.game?.audio.play("stomp", { bus: "sfx" });
		gameState.score += 100;

		// Squash + fade death animation
		this.killTweens();
		this.tween()
			.to({ scale: { x: 1.5, y: 0.3 } }, 0.15, Ease.quadOut)
			.parallel()
			.to({ alpha: 0 }, 0.15)
			.onComplete(() => this.destroy());

		this.died.emit();
	}

	override onDraw(ctx: DrawContext) {
		ctx.rect(new Vec2(-7, -6), new Vec2(14, 12), {
			fill: Color.fromHex("#66bb6a"),
		});
		// Eyes
		const ex = this.direction > 0 ? 1 : -4;
		ctx.rect(new Vec2(ex, -4), new Vec2(2, 2), { fill: Color.WHITE });
	}
}
