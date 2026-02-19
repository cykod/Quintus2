import { DungeonLevel } from "./dungeon-level.js";

export class Level1 extends DungeonLevel {
	readonly levelAsset = "level1";
	readonly nextScene = "level2";

	protected _goToGameOver(): void {
		this.switchTo("game-over");
	}
}
