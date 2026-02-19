import { Level } from "./level.js";

export class Level1 extends Level {
	readonly levelAsset = "level1";
	readonly nextScene = "level2";

	protected _goToGameOver(): void {
		this.switchTo("game-over");
	}
}
