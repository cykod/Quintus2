import { Pickup } from "@quintus/ai-prefabs";
import { CollisionShape, Shape } from "@quintus/physics";
import { Sprite } from "@quintus/sprites";
import { GAME_HEIGHT, POWERUP_FALL_SPEED, POWERUP_SIZE } from "../config.js";
import { COIN_SCALE, coinsAtlas, FRAME } from "../sprites.js";

export type PowerUpType = "wide" | "multi" | "speed";

const POWERUP_FRAMES: Record<PowerUpType, string> = {
	wide: FRAME.COIN_BLUE,
	multi: FRAME.COIN_YELLOW,
	speed: FRAME.COIN_BRONZE,
};

export class PowerUp extends Pickup {
	override collisionGroup = "powerup";
	override collectTag = "paddle";
	override bobAmount = 0;

	powerUpType: PowerUpType = "wide";

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

	override onFixedUpdate(dt: number) {
		super.onFixedUpdate(dt);

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
