import { BASIC_CREEP_GOLD, BASIC_CREEP_HP, BASIC_CREEP_SPEED } from "../config.js";
import { FRAME_ENEMY_BASIC } from "../sprites.js";
import { PathFollower } from "./path-follower.js";

export class BasicCreep extends PathFollower {
	speed = BASIC_CREEP_SPEED;
	override maxHealth = BASIC_CREEP_HP;
	goldReward = BASIC_CREEP_GOLD;
	frameIndex = FRAME_ENEMY_BASIC;
}
