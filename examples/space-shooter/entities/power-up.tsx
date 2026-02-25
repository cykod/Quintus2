import { type Signal, signal } from "@quintus/core";
import type { CollisionObject } from "@quintus/physics";
import { CollisionShape, Sensor, Shape } from "@quintus/physics";
import { Sprite } from "@quintus/sprites";
import { GAME_HEIGHT, POWERUP_FALL_SPEED } from "../config.js";
import { FRAME, POWERUP_SCALE, tilesetAtlas } from "../sprites.js";

export type PowerUpType = "shield" | "rapid" | "spread";

const POWERUP_FRAMES: Record<PowerUpType, string> = {
	shield: FRAME.POWERUP_SHIELD,
	rapid: FRAME.POWERUP_RAPID,
	spread: FRAME.POWERUP_SPREAD,
};

export class PowerUp extends Sensor {
	override collisionGroup = "powerups";

	powerUpType: PowerUpType = "shield";

	readonly collected: Signal<PowerUpType> = signal<PowerUpType>();

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

	override onReady() {
		super.onReady();
		this.bodyEntered.connect((body: CollisionObject) => {
			if (body.collisionGroup === "player") {
				this.collected.emit(this.powerUpType);
				this.destroy();
			}
		});
	}

	override onFixedUpdate(dt: number) {
		this.position._set(this.position.x, this.position.y + POWERUP_FALL_SPEED * dt);
		const world = this._getWorld();
		if (world) world.updatePosition(this);

		if (this.position.y > GAME_HEIGHT + 20) {
			this.destroy();
		}
	}
}
