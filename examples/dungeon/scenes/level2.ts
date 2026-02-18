import type { SceneConstructor } from "@quintus/core";
import { DungeonLevel } from "./dungeon-level.js";
import { GameOverScene } from "./game-over-scene.js";
import { Level3 } from "./level3.js";

export class Level2 extends DungeonLevel {
	readonly levelAsset = "level2";
	readonly nextScene: SceneConstructor = Level3;

	protected _goToGameOver(): void {
		this.switchTo(GameOverScene);
	}
}
