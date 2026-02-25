import { TOWER_ARROW_DAMAGE, TOWER_ARROW_FIRE_RATE, TOWER_ARROW_RANGE } from "../config.js";
import { FRAME_ARROW, FRAME_TOWER_BASE_ROUND, FRAME_TURRET_ARROW } from "../sprites.js";
import { TowerBase } from "./tower-base.js";

export class ArrowTower extends TowerBase {
	range = TOWER_ARROW_RANGE;
	damage = TOWER_ARROW_DAMAGE;
	fireRate = TOWER_ARROW_FIRE_RATE;
	baseFrame = FRAME_TOWER_BASE_ROUND;
	turretFrame = FRAME_TURRET_ARROW;
	projectileFrame = FRAME_ARROW;
}
