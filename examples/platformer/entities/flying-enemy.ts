import type { DrawContext } from "@quintus/core";
import { type Signal, signal } from "@quintus/core";
import { Color, Vec2 } from "@quintus/math";
import { Actor, CollisionShape, Shape } from "@quintus/physics";
import { Ease } from "@quintus/tween";
import { gameState } from "../state.js";

export class FlyingEnemy extends Actor {
	speed = 50;
	amplitude = 30;
	frequency = 2;
	direction = -1;
	override solid = true;
	override collisionGroup = "enemies";

	private _time = 0;

	readonly died: Signal<void> = signal<void>();

	override onReady() {
		super.onReady();
		this.addChild(CollisionShape).shape = Shape.rect(16, 10);
		this.tag("enemy");
		this.applyGravity = false;
	}

	override onFixedUpdate(dt: number) {
		this._time += dt;
		this.velocity.x = this.speed * this.direction;
		this.velocity.y =
			this.amplitude *
			this.frequency *
			Math.PI *
			2 *
			Math.cos(this._time * this.frequency * Math.PI * 2);

		if (this.isOnWall()) {
			this.direction *= -1;
		}

		this.move(dt);
	}

	stomp(): void {
		this.game?.audio.play("stomp", { bus: "sfx" });
		gameState.score += 200;

		this.killTweens();
		this.tween()
			.to({ scale: { y: 0 }, alpha: 0 }, 0.2, Ease.quadIn)
			.onComplete(() => this.destroy());

		this.died.emit();
	}

	override onDraw(ctx: DrawContext) {
		// Body
		ctx.rect(new Vec2(-8, -5), new Vec2(16, 10), {
			fill: Color.fromHex("#ab47bc"),
		});
		// Wings
		const wingY = Math.sin(this._time * 10) * 2;
		ctx.rect(new Vec2(-10, -7 + wingY), new Vec2(4, 4), {
			fill: Color.fromHex("#ce93d8"),
		});
		ctx.rect(new Vec2(6, -7 + wingY), new Vec2(4, 4), {
			fill: Color.fromHex("#ce93d8"),
		});
	}
}
