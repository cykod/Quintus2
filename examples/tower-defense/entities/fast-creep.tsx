import { FAST_CREEP_GOLD, FAST_CREEP_HP, FAST_CREEP_SPEED } from "../config.js";
import { FRAME_ENEMY_FAST } from "../sprites.js";
import { PathFollower } from "./path-follower.js";

export class FastCreep extends PathFollower {
	speed = FAST_CREEP_SPEED;
	override maxHealth = FAST_CREEP_HP;
	goldReward = FAST_CREEP_GOLD;
	frameIndex = FRAME_ENEMY_FAST;
}
