import {
	TOWER_CANNON_DAMAGE,
	TOWER_CANNON_FIRE_RATE,
	TOWER_CANNON_RANGE,
	TOWER_CANNON_SPLASH_RADIUS,
} from "../config.js";
import { FRAME_CANNONBALL, FRAME_TOWER_BASE_SQUARE, FRAME_TURRET_CANNON } from "../sprites.js";
import { TowerBase } from "./tower-base.js";

export class CannonTower extends TowerBase {
	range = TOWER_CANNON_RANGE;
	damage = TOWER_CANNON_DAMAGE;
	fireRate = TOWER_CANNON_FIRE_RATE;
	baseFrame = FRAME_TOWER_BASE_SQUARE;
	turretFrame = FRAME_TURRET_CANNON;
	projectileFrame = FRAME_CANNONBALL;
	override splashRadius = TOWER_CANNON_SPLASH_RADIUS;
}
