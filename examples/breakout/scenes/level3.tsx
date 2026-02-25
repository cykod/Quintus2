import { BreakoutLevel, type BrickRow } from "./breakout-level.js";

const ROWS: BrickRow[] = [
	["grey", "metal"],
	["red", "hard"],
	["grey", "metal"],
	["red", "hard"],
	["blue", "normal"],
	["green", "normal"],
	["yellow", "normal"],
];

/** Level 3: Mix of Normal + Hard + Metal (grey) bricks. */
export class Level3 extends BreakoutLevel {
	get nextScene() {
		return "";
	}

	buildBrickGrid(): void {
		this.buildBrickRows(ROWS);
	}
}
