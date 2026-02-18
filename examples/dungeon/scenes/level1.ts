import type { SceneConstructor } from "@quintus/core";
import { DungeonLevel } from "./dungeon-level.js";
import { _setLevel1Ref, GameOverScene } from "./game-over-scene.js";
import { Level2 } from "./level2.js";

export class Level1 extends DungeonLevel {
	readonly levelAsset = "level1";
	readonly nextScene: SceneConstructor = Level2;

	protected _goToGameOver(): void {
		this.switchTo(GameOverScene);
	}
}

// Register Level1 so GameOverScene and VictoryScene can reference it without circular imports
_setLevel1Ref(Level1);
