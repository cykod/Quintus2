import { BreakoutLevel, type BrickRow } from "./breakout-level.js";

const ROWS: BrickRow[] = [
	["blue", "normal"],
	["green", "normal"],
	["yellow", "normal"],
	["green", "normal"],
	["blue", "normal"],
];

/** Level 1: 5 rows × 10 columns of Normal bricks. */
export class Level1 extends BreakoutLevel {
	get nextScene() {
		return "level2";
	}

	buildBrickGrid(): void {
		this.buildBrickRows(ROWS);
	}
}
