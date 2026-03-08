import { Game, Scene } from "@quintus/core";
import { InputPlugin } from "@quintus/input";
import { AmbientLight, Camera3D, DirectionalLight, ThreePlugin } from "@quintus/three";
import { MODEL_PATHS } from "./assets.js";
import { GAME_HEIGHT, GAME_WIDTH, INPUT_BINDINGS, LEVELS, TILE_SIZE } from "./config.js";
import { DungeonGrid } from "./entities/dungeon-grid.js";

/** Temporary test scene — renders Level 1 grid with lighting. */
class TestScene extends Scene {
	onReady() {
		const level = LEVELS[0] as string[];

		// Dungeon grid
		const grid = this.add(DungeonGrid);
		grid.parseLevel(level);

		// Camera — isometric-ish view looking down at the grid center
		const cx = ((level[0]?.length ?? 8) * TILE_SIZE) / 2;
		const cz = (level.length * TILE_SIZE) / 2;
		const cam = this.add(Camera3D, { fov: 50 });
		cam.position.set(cx, 7, cz + 5);
		cam.lookAt(cx, 0, cz);

		// Lighting
		this.add(AmbientLight, { intensity: 0.4 });
		const sun = this.add(DirectionalLight, { intensity: 0.8 });
		sun.position.set(cx + 3, 8, cz - 3);
	}
}

const game = new Game({
	width: GAME_WIDTH,
	height: GAME_HEIGHT,
	renderer: null,
	scale: "fit",
});

game.use(ThreePlugin({ antialias: true, background: 0x1a1a2e }));
game.use(InputPlugin({ actions: INPUT_BINDINGS }));

game.assets
	.load({ glb: MODEL_PATHS })
	.then(() => {
		game.start(TestScene);
	})
	.catch(() => {
		// Models not found (e.g. test env) — start with fallback geometry
		game.start(TestScene);
	});
