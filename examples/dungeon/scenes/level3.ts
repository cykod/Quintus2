import { DungeonLevel } from "./dungeon-level.js";

export class Level3 extends DungeonLevel {
	readonly levelAsset = "level3";
	readonly nextScene = "victory";

	protected _goToGameOver(): void {
		this.switchTo("game-over");
	}
}
