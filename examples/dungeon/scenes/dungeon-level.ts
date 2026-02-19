import "@quintus/tilemap/physics";
import { Camera } from "@quintus/camera";
import { Node2D, Scene } from "@quintus/core";
import { Rect, Vec2 } from "@quintus/math";
import { TileMap } from "@quintus/tilemap";
import { Chest, type LootType } from "../entities/chest.js";
import { Door } from "../entities/door.js";
import { HealthPickup } from "../entities/health-pickup.js";
import { Orc } from "../entities/orc.js";
import { Player } from "../entities/player.js";
import { Skeleton } from "../entities/skeleton.js";
import { HUD } from "../hud/hud.js";

/** Base scene for dungeon levels. Subclasses set levelAsset + nextScene. */
export abstract class DungeonLevel extends Scene {
	abstract readonly levelAsset: string;
	abstract readonly nextScene: string;

	protected player!: Player;
	protected map!: TileMap;
	protected camera!: Camera;
	/** Y-sorted container for entities (player, enemies, items). */
	protected entities!: Node2D;

	override onReady() {
		// Load tilemap
		this.map = this.add(TileMap);
		this.map.tilesetImage = "tileset";
		this.map.asset = this.levelAsset;

		// Generate collision from walls layer
		this.map.generateCollision({
			layer: "walls",
			allSolid: true,
			collisionGroup: "world",
		});

		// Y-sorted entity container (renders above tilemap)
		this.entities = this.add(Node2D);
		this.entities.ySortChildren = true;
		this.entities.zIndex = 1;

		// Spawn player at designated spawn point
		const spawnPos = this.map.getSpawnPoint("player_start");
		this.player = this.entities.add(Player);
		this.player.position = spawnPos;

		// Spawn all entities from object layer
		this._spawnEntities();

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

		// HUD (fixed layer, stays on screen)
		this.add(HUD);

		// Handle player death
		this.player.died.connect(() => this._onPlayerDied());
	}

	private _spawnEntities(): void {
		const objects = this.map.getObjects("entities");
		for (const obj of objects) {
			const pos = new Vec2(obj.x, obj.y);
			switch (obj.type) {
				case "Skeleton": {
					const skel = this.entities.add(Skeleton);
					skel.position = pos;
					break;
				}
				case "Orc": {
					const orc = this.entities.add(Orc);
					orc.position = pos;
					break;
				}
				case "Chest": {
					const chest = this.entities.add(Chest);
					chest.position = pos;
					const lt = obj.properties.get("lootType");
					if (lt) chest.lootType = lt as LootType;
					const tier = obj.properties.get("lootTier");
					if (tier != null) chest.lootTier = Number(tier);
					break;
				}
				case "HealthPickup": {
					const hp = this.entities.add(HealthPickup);
					hp.position = pos;
					break;
				}
				case "Door": {
					const door = this.entities.add(Door);
					door.position = pos;
					door.nextScene = this.nextScene;
					if (obj.properties.get("locked") === true) {
						door.locked = true;
					}
					break;
				}
			}
		}
	}

	private _deathTriggered = false;

	protected _onPlayerDied() {
		if (this._deathTriggered) return;
		this._deathTriggered = true;

		this.after(0.5, () => this._goToGameOver());
	}

	protected abstract _goToGameOver(): void;
}
