import { LEVELS } from "../config.js";
import { DungeonLevel } from "./dungeon-level.js";

export class Level3 extends DungeonLevel {
	readonly levelData = LEVELS[2] as string[];
	readonly nextScene = "win";
	readonly levelNumber = 3;
}
