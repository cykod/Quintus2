import { Level } from "./level.js";

export class Level2 extends Level {
	readonly levelAsset = "level2";
	readonly nextScene = "victory";

	protected _goToGameOver(): void {
		this.switchTo("game-over");
	}
}
