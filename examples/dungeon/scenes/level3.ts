import type { SceneConstructor } from "@quintus/core";
import { DungeonLevel } from "./dungeon-level.js";
import { GameOverScene } from "./game-over-scene.js";
import { VictoryScene } from "./victory-scene.js";

export class Level3 extends DungeonLevel {
	readonly levelAsset = "level3";
	readonly nextScene: SceneConstructor = VictoryScene;

	protected _goToGameOver(): void {
		this.switchTo(GameOverScene);
	}
}
