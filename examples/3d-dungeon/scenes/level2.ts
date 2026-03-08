import { LEVELS } from "../config.js";
import { DungeonLevel } from "./dungeon-level.js";

export class Level2 extends DungeonLevel {
	readonly levelData = LEVELS[1] as string[];
	readonly nextScene = "level3";
	readonly levelNumber = 2;
}
