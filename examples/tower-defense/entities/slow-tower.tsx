import {
	TOWER_SLOW_DAMAGE,
	TOWER_SLOW_DURATION,
	TOWER_SLOW_FIRE_RATE,
	TOWER_SLOW_MULTIPLIER,
	TOWER_SLOW_RANGE,
} from "../config.js";
import { FRAME_SLOW_EFFECT, FRAME_TOWER_BASE_CROSS, FRAME_TURRET_SLOW } from "../sprites.js";
import { TowerBase } from "./tower-base.js";

export class SlowTower extends TowerBase {
	range = TOWER_SLOW_RANGE;
	damage = TOWER_SLOW_DAMAGE;
	fireRate = TOWER_SLOW_FIRE_RATE;
	baseFrame = FRAME_TOWER_BASE_CROSS;
	turretFrame = FRAME_TURRET_SLOW;
	projectileFrame = FRAME_SLOW_EFFECT;
	override slowEffect = TOWER_SLOW_MULTIPLIER;
	override slowDuration = TOWER_SLOW_DURATION;
}
