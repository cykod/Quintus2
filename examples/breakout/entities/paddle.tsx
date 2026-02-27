import { type Signal, signal } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import { Actor, CollisionShape, Shape } from "@quintus/physics";
import { Sprite } from "@quintus/sprites";
import { PADDLE_HEIGHT, PADDLE_SPEED, PADDLE_WIDE_WIDTH, PADDLE_WIDTH } from "../config.js";
import {
	FRAME,
	PADDLE_SCALE_X,
	PADDLE_SCALE_Y,
	PADDLE_WIDE_SCALE_X,
	paddlesAtlas,
} from "../sprites.js";

export class Paddle extends Actor {
	override collisionGroup = "paddle";
	override solid = true;
	override gravity = 0;
	override applyGravity = false;

	private _wide = false;
	collisionShape!: CollisionShape;
	sprite!: Sprite;

	/** Current effective width (changes with wide power-up). */
	get currentWidth(): number {
		return this._wide ? PADDLE_WIDE_WIDTH : PADDLE_WIDTH;
	}

	/** Emitted when paddle width changes. */
	readonly widthChanged: Signal<boolean> = signal<boolean>();

	override onReady() {
		super.onReady();
		this.tag("paddle");
	}

	override build() {
		return (
			<>
				{/* Capsule collision shape (rotated 90° to be horizontal).
				    Rounded ends deflect the ball smoothly on side hits. */}
				<CollisionShape
					ref="collisionShape"
					shape={Shape.capsule(PADDLE_HEIGHT / 2, PADDLE_WIDTH)}
					rotation={Math.PI / 2}
				/>
				<Sprite
					ref="sprite"
					texture="paddles"
					sourceRect={paddlesAtlas.getFrameOrThrow(FRAME.PADDLE_NORMAL)}
					scale={[PADDLE_SCALE_X, PADDLE_SCALE_Y]}
				/>
			</>
		);
	}

	override onFixedUpdate(dt: number) {
		const axis = this.game.input.getAxis("left", "right");
		this.velocity = new Vec2(axis * PADDLE_SPEED, 0);
		this.move(dt);
	}

	/** Toggle wide paddle mode (for power-up). */
	setWide(wide: boolean): void {
		if (this._wide === wide) return;
		this._wide = wide;

		if (wide) {
			this.collisionShape.shape = Shape.capsule(PADDLE_HEIGHT / 2, PADDLE_WIDE_WIDTH);
			this.sprite.sourceRect = paddlesAtlas.getFrameOrThrow(FRAME.PADDLE_WIDE);
			this.sprite.scale = new Vec2(PADDLE_WIDE_SCALE_X, PADDLE_SCALE_Y);
		} else {
			this.collisionShape.shape = Shape.capsule(PADDLE_HEIGHT / 2, PADDLE_WIDTH);
			this.sprite.sourceRect = paddlesAtlas.getFrameOrThrow(FRAME.PADDLE_NORMAL);
			this.sprite.scale = new Vec2(PADDLE_SCALE_X, PADDLE_SCALE_Y);
		}

		this.widthChanged.emit(wide);
	}
}
