import { Scene } from "@quintus/core";
import { AmbientLight, Camera3D, DirectionalLight } from "@quintus/three";
import { DungeonGrid } from "../entities/dungeon-grid.js";
import { PlayerCharacter } from "../entities/player.js";
import { TurnManager } from "../entities/turn-manager.js";

/** Minimal scene with close-up camera for debugging sword attachment. */
export class DebugSwordScene extends Scene {
	override onReady() {
		const turnManager = this.add(TurnManager);

		// Tiny 3x3 grid — just floor, no walls blocking view
		const grid = this.add(DungeonGrid);
		grid.parseLevel(["...", ".P.", "..."]);

		const spawn = grid.findChar("P");
		const player = this.add(PlayerCharacter, {
			dungeonGrid: grid,
			turnManager,
			gridX: spawn?.gridX ?? 1,
			gridZ: spawn?.gridZ ?? 1,
		});

		// Direct front view — character faces south (+Z), camera further south
		const cam = this.add(Camera3D, { fov: 30 });
		cam.position.set(player.position.x, 0.3, player.position.z + 1.2);
		cam.lookAt(player.position.x, 0.15, player.position.z);

		// Lighting
		this.add(AmbientLight, { intensity: 0.6 });
		const sun = this.add(DirectionalLight, { intensity: 0.8 });
		sun.position.set(3, 5, 3);
	}
}
