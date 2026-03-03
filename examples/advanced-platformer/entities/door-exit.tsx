import { signal } from "@quintus/core";
import { CollisionShape, Sensor, Shape } from "@quintus/physics";
import { Sprite } from "@quintus/sprites";
import type { TileSpawnInfo } from "@quintus/tilemap";
import { FRAME, tileAtlas } from "../sprites.js";

/**
 * Exit door sensor — emits `levelComplete` signal when the player enters.
 * Actual scene transition is deferred to a later phase.
 */
export class DoorExit extends Sensor {
	override collisionGroup = "items";

	/** Emitted when the player enters the door. */
	readonly levelComplete = signal<void>();

	sprite!: Sprite;
	tileInfo: TileSpawnInfo | null = null;

	private _triggered = false;

	override build() {
		return (
			<>
				<CollisionShape shape={Shape.rect(56, 64)} />
				<Sprite ref="sprite" texture={tileAtlas.texture} centered />
			</>
		);
	}

	override onReady() {
		super.onReady();
		if (this.tileInfo) {
			this.sprite.sourceRect = this.tileInfo.sourceRect;
		} else {
			this.sprite.sourceRect = tileAtlas.getFrameOrThrow(FRAME.DOOR_CLOSED);
		}
		this.tag("door_exit");

		this.bodyEntered.connect((body) => {
			if (body.hasTag("player") && !this._triggered) {
				this._triggered = true;
				this.sprite.sourceRect = tileAtlas.getFrameOrThrow(FRAME.DOOR_OPEN);
				this.game.audio.play("select", { bus: "sfx" });
				this.levelComplete.emit();
			}
		});
	}
}
