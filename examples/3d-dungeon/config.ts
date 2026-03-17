// === Game dimensions ===
export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 600;

// === Tile grid ===
export const TILE_SIZE = 1;

// === Player ===
export const MOVE_DURATION = 0.2;
export const TURN_DURATION = 0.15;
export const PLAYER_HEALTH = 3;
export const PLAYER_ATTACK_DAMAGE = 1;
export const PLAYER_ATTACK_WINDUP = 0.15;
export const PLAYER_ATTACK_DURATION = 0.3;
export const PLAYER_INVINCIBILITY = 1.0;

// === Turns ===
export const ENEMY_TURN_INTERVAL = 2;

// === Enemies ===
export const ENEMY_HEALTH = 2;
export const ENEMY_DAMAGE = 1;
export const ENEMY_MOVE_DURATION = 0.3;
export const ENEMY_ATTACK_DURATION = 0.3;
export const ENEMY_KILL_SCORE = 25;

// === Scoring ===
export const COIN_SCORE = 10;
export const CHEST_SCORE = 50;
export const TRAP_DAMAGE = 1;

// === Level data ===
export const LEVELS: string[][] = [
	// Level 1 (8×8)
	["########", "#P....E#", "#..C...#", "#.G....#", "#...T..#", "#.....H#", "#....C.#", "########"],
	// Level 2 (10×10)
	[
		"##########",
		"#P.......#",
		"#..##.C..#",
		"#..##..G.#",
		"#...T....#",
		"#....##..#",
		"#.C..##.E#",
		"#..G...H.#",
		"##########",
	],
	// Level 3 (12×12)
	[
		"############",
		"#P.........#",
		"#..###..C..#",
		"#..#.T..#..#",
		"#....C..#..#",
		"#.####..G..#",
		"#......T...#",
		"#..##.##.H.#",
		"#..##....G.#",
		"#.....C..T.#",
		"#.........E#",
		"############",
	],
];

// === Fog of War ===
export const FOG_SIGHT_RANGE = 3;
export const FOG_VISITED_OPACITY = 0.5;
export const FOG_HIDDEN_OPACITY = 1.0;

// === Transitions ===
export const TRANSITION_FADE_DURATION = 0.4;
export const TRANSITION_DEATH_FADE_DURATION = 0.5;
export const STAIR_DESCENT_DURATION = 0.4;

// === Camera ===
export const CAMERA_ORBIT_DURATION = 0.2;

// === Input bindings ===
export const INPUT_BINDINGS: Record<string, string[]> = {
	move_forward: ["KeyW", "ArrowUp", "gamepad:left-stick-up"],
	move_backward: ["KeyS", "ArrowDown", "gamepad:left-stick-down"],
	turn_left: ["KeyA", "ArrowLeft", "gamepad:left-stick-left"],
	turn_right: ["KeyD", "ArrowRight", "gamepad:left-stick-right"],
	interact: ["Space", "gamepad:a"],
	camera_left: ["KeyQ", "gamepad:left-bumper"],
	camera_right: ["KeyE", "gamepad:right-bumper"],
};
