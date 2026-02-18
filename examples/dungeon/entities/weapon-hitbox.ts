import { Timer } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import type { CollisionObject } from "@quintus/physics";
import { CollisionShape, Sensor, Shape } from "@quintus/physics";

/**
 * Short-lived sensor that deals damage to enemies it overlaps.
 * Spawned by the player's attack action; auto-destroys after a brief duration.
 */
export class WeaponHitbox extends Sensor {
	override collisionGroup = "weapon";
	damage = 1;
	/** Direction the weapon was swung (for knockback). */
	attackDirection = Vec2.ZERO;
	/** Prevent hitting the same target multiple times per swing. */
	private _hitSet = new Set<CollisionObject>();

	override onReady() {
		super.onReady();
		this.addChild(CollisionShape).shape = Shape.rect(12, 12);

		// Auto-destroy after 0.15s
		const timer = this.addChild(Timer, { duration: 0.15, autostart: true });
		timer.timeout.connect(() => this.destroy());

		// Deal damage on overlap
		this.bodyEntered.connect((body) => {
			if (this._hitSet.has(body)) return;
			this._hitSet.add(body);

			if (
				body.hasTag("enemy") &&
				typeof (body as Record<string, unknown>).takeDamage === "function"
			) {
				(body as { takeDamage: (amount: number, fromDir?: Vec2) => void }).takeDamage(
					this.damage,
					this.attackDirection,
				);
			}
		});
	}
}
