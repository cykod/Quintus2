import { Game, Scene } from "@quintus/core";
import { InputPlugin } from "@quintus/input";
import {
    AmbientLight,
    Camera3D,
    DirectionalLight,
    ThreePlugin,
} from "@quintus/three";
import * as THREE from "three";
import { MODEL_PATHS } from "./assets.js";
import {
    COIN_SCORE,
    GAME_HEIGHT,
    GAME_WIDTH,
    INPUT_BINDINGS,
    LEVELS,
} from "./config.js";
import { DungeonGrid } from "./entities/dungeon-grid.js";
import { PlayerCharacter } from "./entities/player.js";
import { gameState } from "./state.js";

/** Temporary test scene — renders Level 1 grid with lighting and player. */
class TestScene extends Scene {
    onReady() {
        const level = LEVELS[0] as string[];

        // Dungeon grid
        const grid = this.add(DungeonGrid);
        grid.parseLevel(level);

        // Player — props must be set before add() triggers onReady()
        const spawn = grid.findChar("P");
        const player = this.add(PlayerCharacter, {
            dungeonGrid: grid,
            gridX: spawn?.gridX ?? 1,
            gridZ: spawn?.gridZ ?? 1,
        });

        // Camera — follows the player from above
        const cam = this.add(Camera3D, {
            fov: 50,
            follow: player,
            followOffset: new THREE.Vector3(0, 4, 4),
            followSmoothing: 4,
        });
        // Set initial position near the player so the first frame isn't jarring
        const startWorld = grid.gridToWorld(player.gridX, player.gridZ);
        cam.position.set(startWorld.x, 12, startWorld.z + 8);

        // Lighting
        this.add(AmbientLight, { intensity: 0.4 });
        const sun = this.add(DirectionalLight, { intensity: 0.8 });
        sun.position.set(startWorld.x + 3, 8, startWorld.z - 3);

        // Signal wiring
        player.collected.connect(({ gridX, gridZ }) => {
            gameState.score += COIN_SCORE;
            grid.clearCell(gridX, gridZ);
        });

        player.reachedExit.connect(() => {
            console.log("Exit reached! Level complete.");
        });

        player.died.connect(() => {
            console.log("Player died!");
        });
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
