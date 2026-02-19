import { Timer } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import { CollisionShape, Sensor, Shape } from "@quintus/physics";
import { Player } from "./player.js";

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
		this.add(CollisionShape).shape = Shape.rect(10, 10);

		const timer = this.add(Timer, { duration: 0.15, autostart: true });
		timer.timeout.connect(() => this.destroy());

		this.bodyEntered.connect((body) => {
			if (this._hit) return;
			if (body.is(Player)) {
				this._hit = true;
				body.takeDamage(this.damage, this.attackDirection);
			}
		});
	}
}
