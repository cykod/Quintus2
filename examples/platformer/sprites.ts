import { SpriteSheet } from "@quintus/sprites";

/** Shared sprite sheet for all platformer entities. Uses the Kenney Pico-8 tileset (8×8, 15 cols). */
export const entitySheet = new SpriteSheet({
	texture: "tileset",
	frameWidth: 8,
	frameHeight: 8,
	columns: 15,
	rows: 10,
	spacing: 1,
	animations: {
		// Player
		player_idle: { frames: [105, 106], fps: 3, loop: true },
		player_run: { frames: [106, 107], fps: 8, loop: true },
		player_jump: { frames: [107], fps: 1, loop: false },
		// Dark patrol enemy
		enemy_walk: { frames: [109, 112], fps: 4, loop: true },
		// Pink flying enemy
		enemy_fly: { frames: [114, 115], fps: 6, loop: true },
		// Coin (yellow star)
		coin_idle: { frames: [88], fps: 1, loop: false },
		// Spike hazard (static)
		spike: { frames: [75], fps: 1, loop: false },
		// Health pickup (yellow heart)
		health: { frames: [132], fps: 1, loop: false },
		// Exit flag
		flag: { frames: [73], fps: 1, loop: false },
	},
});
