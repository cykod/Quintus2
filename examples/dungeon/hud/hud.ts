import { Color, Vec2 } from "@quintus/math";
import { Sprite } from "@quintus/sprites";
import { Label, Layer } from "@quintus/ui";
import { entitySheet, TILE } from "../sprites.js";
import { gameState } from "../state.js";

export class HUD extends Layer {
	private hearts: Sprite[] = [];
	private scoreLabel!: Label;
	private keyLabel!: Label;
	private swordSprite!: Sprite;

	override onReady() {
		this.fixed = true;
		this.zIndex = 100;

		// Heart icons
		for (let i = 0; i < gameState.maxHealth; i++) {
			const rect =
				i < gameState.health
					? entitySheet.getFrameRect(TILE.HEART_FULL)
					: entitySheet.getFrameRect(TILE.HEART_EMPTY);
			const heart = this.addChild(Sprite, {
				texture: "tileset",
				sourceRect: rect,
				centered: false,
				position: new Vec2(4 + i * 18, 4),
			});
			this.hearts.push(heart);
		}

		// Current sword icon
		this.swordSprite = this.addChild(Sprite, {
			texture: "tileset",
			sourceRect: entitySheet.getFrameRect(gameState.sword.spriteFrame),
			centered: false,
			position: new Vec2(4, 24),
		});

		// Score label
		this.scoreLabel = this.addChild(Label, {
			position: new Vec2(250, 4),
			text: `Score: ${gameState.score}`,
			fontSize: 8,
			color: Color.WHITE,
			align: "right",
		});

		// Key count (only shown when keys > 0)
		this.keyLabel = this.addChild(Label, {
			position: new Vec2(250, 16),
			text: "",
			fontSize: 8,
			color: Color.fromHex("#ffd54f"),
			align: "right",
		});
	}

	override onUpdate(_dt: number) {
		// Update heart sprites
		for (let i = 0; i < this.hearts.length; i++) {
			this.hearts[i].sourceRect =
				i < gameState.health
					? entitySheet.getFrameRect(TILE.HEART_FULL)
					: entitySheet.getFrameRect(TILE.HEART_EMPTY);
		}

		// Update sword icon
		this.swordSprite.sourceRect = entitySheet.getFrameRect(gameState.sword.spriteFrame);

		// Update score
		this.scoreLabel.text = `Score: ${gameState.score}`;

		// Update key count
		this.keyLabel.text = gameState.keys > 0 ? `Keys: ${gameState.keys}` : "";
	}
}
