import "@quintus/tilemap/physics";
import { Camera } from "@quintus/camera";
import { Scene } from "@quintus/core";
import { Rect } from "@quintus/math";
import { TileMap } from "@quintus/tilemap";
import { BuffManager } from "../entities/buff-manager.js";
import { Door } from "../entities/door.js";
import { Player } from "../entities/player.js";
import { HUD } from "../hud/hud.js";
import { ENTITY_MAPPING } from "./entity-mapping.js";

/** Base scene for dungeon levels. Subclasses set levelAsset + nextScene. */
export abstract class DungeonLevel extends Scene {
	abstract readonly levelAsset: string;
	abstract readonly nextScene: string;

	protected player!: Player;
	protected map!: TileMap;
	protected camera!: Camera;

	override onReady() {
		// Load tilemap — TileMap itself is the Y-sorted entity container
		this.map = this.add(TileMap);
		this.map.tilesetImage = "tileset";
		this.map.asset = this.levelAsset;
		this.map.ySortChildren = true;

		// Generate collision from walls layer
		this.map.generateCollision({
			layer: "walls",
			allSolid: true,
			collisionGroup: "world",
		});

		// Spawn player at designated spawn point (child of map for Y-sorting)
		const spawnPos = this.map.getSpawnPoint("player_start");
		this.player = this.map.add(Player);
		this.player.position = spawnPos;

		// Spawn all entities from object layer (auto-applies Tiled properties)
		const spawned = this.map.spawnObjects("entities", ENTITY_MAPPING);

		// Post-spawn: set Door.nextScene (comes from scene, not Tiled)
		for (const node of spawned) {
			if (node instanceof Door) {
				node.nextScene = this.nextScene;
			}
		}

		// Camera setup
		this.camera = this.add(Camera);
		this.camera.follow = this.player;
		this.camera.smoothing = 0.1;
		this.camera.zoom = 2;
		this.camera.bounds = new Rect(0, 0, this.map.bounds.width, this.map.bounds.height);

		// Handle player damage → camera shake
		this.player.damaged.connect(() => {
			this.camera.shake(2, 0.2);
		});

		// Buff timer manager
		this.add(BuffManager);

		// HUD (fixed layer, stays on screen)
		this.add(HUD);

		// Handle player death
		this.player.died.connect(() => this._onPlayerDied());
	}

	private _deathTriggered = false;

	protected _onPlayerDied() {
		if (this._deathTriggered) return;
		this._deathTriggered = true;

		this.after(0.5, () => this._goToGameOver());
	}

	protected abstract _goToGameOver(): void;
}
