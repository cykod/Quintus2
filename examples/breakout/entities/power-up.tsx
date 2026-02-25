import { type Signal, signal } from "@quintus/core";
import { type CollisionObject, CollisionShape, Sensor, Shape } from "@quintus/physics";
import { Sprite } from "@quintus/sprites";
import { GAME_HEIGHT, POWERUP_FALL_SPEED, POWERUP_SIZE } from "../config.js";
import { COIN_SCALE, coinsAtlas, FRAME } from "../sprites.js";

export type PowerUpType = "wide" | "multi" | "speed";

const POWERUP_FRAMES: Record<PowerUpType, string> = {
	wide: FRAME.COIN_BLUE,
	multi: FRAME.COIN_YELLOW,
	speed: FRAME.COIN_BRONZE,
};

export class PowerUp extends Sensor {
	override collisionGroup = "powerup";

	powerUpType: PowerUpType = "wide";

	/** Emitted when the power-up is collected by the paddle. */
	readonly collected: Signal<void> = signal<void>();

	override build() {
		const frame = POWERUP_FRAMES[this.powerUpType];
		return (
			<>
				<CollisionShape shape={Shape.rect(POWERUP_SIZE, POWERUP_SIZE)} />
				<Sprite
					texture="coins"
					sourceRect={coinsAtlas.getFrameOrThrow(frame)}
					scale={[COIN_SCALE, COIN_SCALE]}
				/>
			</>
		);
	}

	override onReady() {
		super.onReady();
		// Detect paddle overlap
		this.bodyEntered.connect((body: CollisionObject) => {
			if (body.collisionGroup === "paddle") {
				this.collected.emit();
				this.destroy();
			}
		});
	}

	override onFixedUpdate(dt: number) {
		// Manual downward movement (Sensors don't use move())
		this.position._set(this.position.x, this.position.y + POWERUP_FALL_SPEED * dt);

		// Update spatial hash after manual position change
		const world = this._getWorld();
		if (world) world.updatePosition(this);

		// Remove if off-screen
		if (this.position.y > GAME_HEIGHT + 20) {
			this.destroy();
		}
	}
}
