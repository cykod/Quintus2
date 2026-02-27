import { Pickup } from "@quintus/ai-prefabs";
import { CollisionShape, Shape } from "@quintus/physics";
import { Sprite } from "@quintus/sprites";
import { GAME_HEIGHT, POWERUP_FALL_SPEED } from "../config.js";
import { FRAME, POWERUP_SCALE, tilesetAtlas } from "../sprites.js";

export type PowerUpType = "shield" | "rapid" | "spread";

const POWERUP_FRAMES: Record<PowerUpType, string> = {
	shield: FRAME.POWERUP_SHIELD,
	rapid: FRAME.POWERUP_RAPID,
	spread: FRAME.POWERUP_SPREAD,
};

export class PowerUp extends Pickup {
	override collisionGroup = "powerups";
	override collectTag = "player";
	override bobAmount = 0;
	override popScale = 1.5;
	override popDuration = 0.15;

	powerUpType: PowerUpType = "shield";

	override build() {
		const frame = POWERUP_FRAMES[this.powerUpType];
		return (
			<>
				<CollisionShape shape={Shape.rect(12, 12)} />
				<Sprite
					texture="tileset"
					sourceRect={tilesetAtlas.getFrameOrThrow(frame)}
					scale={[POWERUP_SCALE, POWERUP_SCALE]}
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
