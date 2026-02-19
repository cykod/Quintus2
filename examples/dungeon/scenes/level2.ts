import { DungeonLevel } from "./dungeon-level.js";

export class Level2 extends DungeonLevel {
	readonly levelAsset = "level2";
	readonly nextScene = "level3";

	protected _goToGameOver(): void {
		this.switchTo("game-over");
	}
}
