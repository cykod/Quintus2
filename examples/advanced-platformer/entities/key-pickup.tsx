import { CollisionShape, Sensor, Shape } from "@quintus/physics";
import { Sprite } from "@quintus/sprites";
import type { TileSpawnInfo } from "@quintus/tilemap";
import { FRAME, tileAtlas } from "../sprites.js";
import { gameState } from "../state.js";

export type KeyColor = "red" | "blue" | "green" | "yellow";

const KEY_FRAMES: Record<KeyColor, string> = {
	red: FRAME.KEY_RED,
	blue: FRAME.KEY_BLUE,
	green: FRAME.KEY_GREEN,
	yellow: FRAME.KEY_YELLOW,
};

/**
 * Key pickup sensor — unlocks matching LockedDoor.
 * Color is auto-detected from tileInfo type (e.g., "key_red" → "red").
 */
export class KeyPickup extends Sensor {
	override collisionGroup = "items";

	/** Key color. Auto-detected from tile type if spawned from tilemap. */
	color: KeyColor = "red";

	sprite!: Sprite;
	tileInfo: TileSpawnInfo | null = null;

	override build() {
		return (
			<>
				<CollisionShape shape={Shape.circle(20)} />
				<Sprite ref="sprite" texture={tileAtlas.texture} centered />
			</>
		);
	}

	override onReady() {
		super.onReady();

		// Auto-detect color from tile type
		if (this.tileInfo?.definition?.type) {
			const type = this.tileInfo.definition.type;
			const match = type.match(/^key_(\w+)$/);
			if (match) {
				this.color = match[1] as KeyColor;
			}
		}

		if (this.tileInfo) {
			this.sprite.sourceRect = this.tileInfo.sourceRect;
		} else {
			this.sprite.sourceRect = tileAtlas.getFrameOrThrow(KEY_FRAMES[this.color]);
		}
		this.tag("collectible");
		this.tag("key");

		this.bodyEntered.connect((body) => {
			if (body.hasTag("player")) {
				gameState.keys[this.color] = true;
				this.game.audio.play("magic", { bus: "sfx" });
				this.destroy();
			}
		});
	}
}
