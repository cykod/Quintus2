import { CollisionShape, Shape, StaticCollider } from "@quintus/physics";
import { Sprite } from "@quintus/sprites";
import type { TileSpawnInfo } from "@quintus/tilemap";
import { Ease } from "@quintus/tween";
import { FRAME, tileAtlas } from "../sprites.js";
import type { KeyColor } from "./key-pickup.js";

const LOCK_FRAMES: Record<KeyColor, string> = {
	red: FRAME.LOCK_RED,
	blue: FRAME.LOCK_BLUE,
	green: FRAME.LOCK_GREEN,
	yellow: FRAME.LOCK_YELLOW,
};

/**
 * Locked door — solid obstacle that opens when the player has the matching key.
 * The scene's `onContact("player", "world")` callback checks the key and calls `open()`.
 */
export class LockedDoor extends StaticCollider {
	override collisionGroup = "world";

	/** Lock color. Auto-detected from tile type if spawned from tilemap. */
	color: KeyColor = "red";

	sprite!: Sprite;
	tileInfo: TileSpawnInfo | null = null;

	private _opened = false;

	override build() {
		return (
			<>
				<CollisionShape shape={Shape.rect(64, 64)} />
				<Sprite ref="sprite" texture={tileAtlas.texture} centered />
			</>
		);
	}

	override onReady() {
		super.onReady();

		// Auto-detect color from tile type
		if (this.tileInfo?.definition?.type) {
			const type = this.tileInfo.definition.type;
			const match = type.match(/^lock_(\w+)$/);
			if (match) {
				this.color = match[1] as KeyColor;
			}
		}

		if (this.tileInfo) {
			this.sprite.sourceRect = this.tileInfo.sourceRect;
		} else {
			this.sprite.sourceRect = tileAtlas.getFrameOrThrow(LOCK_FRAMES[this.color]);
		}
		this.tag("locked_door");
	}

	/** Open the door — plays an animation and destroys the collider. */
	open(): void {
		if (this._opened) return;
		this._opened = true;

		this.game.audio.play("magic", { bus: "sfx" });

		// Fade out and destroy
		this.tween()
			.to({ sprite: { alpha: 0 } }, 0.3, Ease.easeOutQuad)
			.onComplete(() => this.destroy());
	}
}
