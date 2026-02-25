import { BreakoutLevel, type BrickRow } from "./breakout-level.js";

const ROWS: BrickRow[] = [
	["red", "hard"],
	["blue", "normal"],
	["red", "hard"],
	["green", "normal"],
	["yellow", "normal"],
	["green", "normal"],
];

/** Level 2: Mix of Normal + Hard (red) bricks. */
export class Level2 extends BreakoutLevel {
	get nextScene() {
		return "level3";
	}

	buildBrickGrid(): void {
		this.buildBrickRows(ROWS);
	}
}
