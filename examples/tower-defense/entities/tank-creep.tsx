import { TANK_CREEP_GOLD, TANK_CREEP_HP, TANK_CREEP_SPEED } from "../config.js";
import { FRAME_ENEMY_TANK } from "../sprites.js";
import { PathFollower } from "./path-follower.js";

export class TankCreep extends PathFollower {
	speed = TANK_CREEP_SPEED;
	hp = TANK_CREEP_HP;
	goldReward = TANK_CREEP_GOLD;
	frameIndex = FRAME_ENEMY_TANK;
}
