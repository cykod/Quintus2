import { Node2D } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import { type Actor, CollisionShape, Shape, StaticCollider } from "@quintus/physics";
import { Sprite } from "@quintus/sprites";
import type { TileSpawnInfo } from "@quintus/tilemap";
import { Ease } from "@quintus/tween";
import { FRAME, tileAtlas } from "../sprites.js";
import { gameState } from "../state.js";

// ─── Base BreakableBlock ─────────────────────────────────────────

/**
 * Base class for blocks the player can hit from below.
 * Subclasses implement `onHit()` to define behavior.
 */
export abstract class BreakableBlock extends StaticCollider {
	override collisionGroup = "world";
	sprite!: Sprite;
	tileInfo: TileSpawnInfo | null = null;

	protected abstract frameName: string;

	override build() {
		const shape = this._buildCollisionShape();
		const offset = this._buildCollisionOffset();
		return (
			<>
				<CollisionShape shape={shape} position={offset} />
				<Sprite ref="sprite" texture={tileAtlas.texture} centered />
			</>
		);
	}

	override onReady() {
		super.onReady();
		if (this.tileInfo) {
			this.sprite.sourceRect = this.tileInfo.sourceRect;
		} else {
			this.sprite.sourceRect = tileAtlas.getFrameOrThrow(this.frameName);
		}
	}

	/** Compute collision shape from tile objectgroup or fall back to full-tile rect. */
	private _buildCollisionShape(): ReturnType<typeof Shape.rect> {
		const obj = this.tileInfo?.definition?.objectgroup?.objects[0];
		if (obj) {
			return Shape.rect(obj.width, obj.height);
		}
		return Shape.rect(64, 64);
	}

	/** Compute collision offset from tile objectgroup or return zero. */
	private _buildCollisionOffset(): Vec2 {
		const obj = this.tileInfo?.definition?.objectgroup?.objects[0];
		if (obj) {
			const halfTile = 32; // tileWidth / 2
			return new Vec2(
				obj.x + obj.width / 2 - halfTile,
				obj.y + obj.height / 2 - halfTile,
			);
		}
		return Vec2.ZERO;
	}

	/** Called by contact callback when player hits from below. */
	hitFromBelow(_player: Actor): void {
		this.onHit();
	}

	protected abstract onHit(): void;
}

// ─── BrickBlock ──────────────────────────────────────────────────

/** Breakable brick — bump animation then destroy. */
export class BrickBlock extends BreakableBlock {
	protected frameName = FRAME.BRICK_BROWN;

	protected onHit(): void {
		this.game.audio.play("bump", { bus: "sfx" });
		this.tween()
			.to({ position: { y: this.position.y - 8 } }, 0.08, Ease.easeOutQuad)
			.to({ position: { y: this.position.y } }, 0.08, Ease.easeInQuad)
			.onComplete(() => this.destroy());
	}
}

// ─── CoinBlock ───────────────────────────────────────────────────

/** Coin block — spawns coin popup on first hit, becomes empty. */
export class CoinBlock extends BreakableBlock {
	protected frameName = FRAME.BLOCK_COIN;
	private _hit = false;

	protected onHit(): void {
		if (this._hit) return;
		this._hit = true;

		this.game.audio.play("coin", { bus: "sfx" });

		// Bump tween
		const baseY = this.position.y;
		this.tween()
			.to({ position: { y: baseY - 8 } }, 0.08, Ease.easeOutQuad)
			.to({ position: { y: baseY } }, 0.08, Ease.easeInQuad);

		// Swap to empty frame
		this.sprite.sourceRect = tileAtlas.getFrameOrThrow(FRAME.BLOCK_EMPTY);

		// Spawn coin popup above
		const popup = new CoinPopup();
		popup.position.x = this.position.x;
		popup.position.y = this.position.y - 32;
		this.parent?.add(popup);

		// Award
		gameState.coins += 1;
		gameState.score += 100;
	}
}

// ─── ExclamationBlock ────────────────────────────────────────────

/** Exclamation block — spawns power-up popup on first hit, becomes empty. */
export class ExclamationBlock extends BreakableBlock {
	protected frameName = FRAME.BLOCK_EXCLAMATION;
	private _hit = false;

	protected onHit(): void {
		if (this._hit) return;
		this._hit = true;

		this.game.audio.play("magic", { bus: "sfx" });

		// Bump tween
		const baseY = this.position.y;
		this.tween()
			.to({ position: { y: baseY - 8 } }, 0.08, Ease.easeOutQuad)
			.to({ position: { y: baseY } }, 0.08, Ease.easeInQuad);

		// Swap to empty frame
		this.sprite.sourceRect = tileAtlas.getFrameOrThrow(FRAME.BLOCK_EMPTY);

		// Spawn power-up popup above
		const popup = new PowerUpPopup();
		popup.position.x = this.position.x;
		popup.position.y = this.position.y - 32;
		this.parent?.add(popup);

		// Award
		gameState.score += 200;
	}
}

// ─── CoinPopup ───────────────────────────────────────────────────

/** Visual-only coin sprite that tweens up and fades, then destroys itself. */
class CoinPopup extends Node2D {
	sprite!: Sprite;

	override build() {
		return <Sprite ref="sprite" texture={tileAtlas.texture} centered />;
	}

	override onReady() {
		this.sprite.sourceRect = tileAtlas.getFrameOrThrow(FRAME.COIN_GOLD);

		this.tween()
			.to({ position: { y: this.position.y - 40 } }, 0.4, Ease.easeOutQuad)
			.parallel()
			.to({ sprite: { alpha: 0 } }, 0.4, Ease.easeInQuad)
			.onComplete(() => this.destroy());
	}
}

// ─── PowerUpPopup ────────────────────────────────────────────────

/** Visual-only star sprite that tweens up and fades, then destroys itself. */
class PowerUpPopup extends Node2D {
	sprite!: Sprite;

	override build() {
		return <Sprite ref="sprite" texture={tileAtlas.texture} centered />;
	}

	override onReady() {
		this.sprite.sourceRect = tileAtlas.getFrameOrThrow(FRAME.STAR);

		this.tween()
			.to({ position: { y: this.position.y - 40 } }, 0.4, Ease.easeOutQuad)
			.parallel()
			.to({ sprite: { alpha: 0 } }, 0.4, Ease.easeInQuad)
			.onComplete(() => this.destroy());
	}
}
