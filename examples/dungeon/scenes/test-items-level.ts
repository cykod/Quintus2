import { DungeonLevel } from "./dungeon-level.js";

export class TestItemsLevel extends DungeonLevel {
	readonly levelAsset = "test-items";
	readonly nextScene = "test-items";

	protected _goToGameOver(): void {
		this.switchTo("test-items");
	}
}
