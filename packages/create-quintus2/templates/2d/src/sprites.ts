import { SpriteSheet } from "quintus2";

// One sprite sheet, defined in code (no Tiled tileset), shared by every entity. It slices the
// Kenney Pico-8 tileset (8×8 tiles, 15-column, 1px-spaced grid) loaded as "tiles" in main.ts.
// Add your own animations here by frame index — the whole tileset is available.
export const entitySheet = new SpriteSheet({
	texture: "tiles",
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
		// Coin (spinning star)
		coin_idle: { frames: [88], fps: 1, loop: false },
		// Patrolling enemy
		enemy_walk: { frames: [109, 112], fps: 4, loop: true },
	},
});
