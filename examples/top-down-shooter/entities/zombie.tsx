import { FRAME } from "../sprites.js";
import { BaseEnemy } from "./base-enemy.js";

export class Zombie extends BaseEnemy {
	maxHealth = 50;
	speed = 60;
	contactDamage = 15;
	scoreValue = 10;
	spriteFrame = FRAME.ZOMBIE_HOLD;

	override onFixedUpdate(dt: number) {
		this._facePlayer();
		const dir = this._dirToPlayer();
		this.velocity.x = dir.x * this.speed;
		this.velocity.y = dir.y * this.speed;
		this.move(dt);
	}
}
