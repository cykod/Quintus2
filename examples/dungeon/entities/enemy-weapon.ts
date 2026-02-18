import { Timer } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import { CollisionShape, Sensor, Shape } from "@quintus/physics";

/**
 * Short-lived sensor for enemy melee attacks.
 * Damages the player on overlap.
 */
export class EnemyWeapon extends Sensor {
	override collisionGroup = "eWeapon";
	damage = 1;
	attackDirection = Vec2.ZERO;
	private _hit = false;

	override onReady() {
		super.onReady();
		this.addChild(CollisionShape).shape = Shape.rect(10, 10);

		const timer = this.addChild(Timer, { duration: 0.15, autostart: true });
		timer.timeout.connect(() => this.destroy());

		this.bodyEntered.connect((body) => {
			if (this._hit) return;
			if (
				body.hasTag("player") &&
				typeof (body as Record<string, unknown>).takeDamage === "function"
			) {
				this._hit = true;
				(body as { takeDamage: (amount: number, fromDir?: Vec2) => void }).takeDamage(
					this.damage,
					this.attackDirection,
				);
			}
		});
	}
}
