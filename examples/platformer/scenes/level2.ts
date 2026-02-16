import type { Game, SceneConstructor } from "@quintus/core";
import { GameOverScene } from "./game-over-scene.js";
import { Level } from "./level.js";
import { VictoryScene } from "./victory-scene.js";

export class Level2 extends Level {
	readonly levelAsset = "level2";
	readonly nextScene: SceneConstructor = VictoryScene;

	constructor(game: Game) {
		super(game);
	}

	protected _goToGameOver(): void {
		this.switchTo(GameOverScene);
	}
}
