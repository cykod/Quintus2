// === Game dimensions ===
export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 600;

// === Tile grid ===
export const TILE_SIZE = 1;

// === Player ===
export const MOVE_DURATION = 0.2;
export const PLAYER_HEALTH = 3;
export const PLAYER_INVINCIBILITY = 1.0;

// === Scoring ===
export const COIN_SCORE = 10;
export const CHEST_SCORE = 50;
export const TRAP_DAMAGE = 1;

// === Level data ===
export const LEVELS: string[][] = [
	// Level 1 (8×8)
	["########", "#P....E#", "#..C...#", "#......#", "#...T..#", "#......#", "#....C.#", "########"],
	// Level 2 (10×10)
	[
		"##########",
		"#P.......#",
		"#..##.C..#",
		"#..##....#",
		"#...T....#",
		"#....##..#",
		"#.C..##.E#",
		"#........#",
		"##########",
	],
	// Level 3 (12×12)
	[
		"############",
		"#P.........#",
		"#..###..C..#",
		"#..#.T..#..#",
		"#....C..#..#",
		"#.####.....#",
		"#......T...#",
		"#..##.##...#",
		"#..##......#",
		"#.....C..T.#",
		"#.........E#",
		"############",
	],
];

// === Input bindings ===
export const INPUT_BINDINGS: Record<string, string[]> = {
	move_up: ["KeyW", "ArrowUp", "gamepad:left-stick-up"],
	move_down: ["KeyS", "ArrowDown", "gamepad:left-stick-down"],
	move_left: ["KeyA", "ArrowLeft", "gamepad:left-stick-left"],
	move_right: ["KeyD", "ArrowRight", "gamepad:left-stick-right"],
	interact: ["KeyE", "Space", "gamepad:a"],
};
