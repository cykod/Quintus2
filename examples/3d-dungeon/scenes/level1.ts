import { LEVELS } from "../config.js";
import { DungeonLevel } from "./dungeon-level.js";

export class Level1 extends DungeonLevel {
	readonly levelData = LEVELS[0] as string[];
	readonly nextScene = "level2";
	readonly levelNumber = 1;
}
