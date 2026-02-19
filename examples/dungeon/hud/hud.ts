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
			const heart = this.add(Sprite, {
				texture: "tileset",
				sourceRect: rect,
				centered: false,
				position: new Vec2(4 + i * 18, 4),
			});
			this.hearts.push(heart);
		}

		// Current sword icon
		this.swordSprite = this.add(Sprite, {
			texture: "tileset",
			sourceRect: entitySheet.getFrameRect(gameState.sword.spriteFrame),
			centered: false,
			position: new Vec2(4, 24),
		});

		// Score label
		this.scoreLabel = this.add(Label, {
			position: new Vec2(250, 4),
			text: `Score: ${gameState.score}`,
			fontSize: 8,
			color: Color.WHITE,
			align: "right",
		});

		// Key count (only shown when keys > 0)
		this.keyLabel = this.add(Label, {
			position: new Vec2(250, 16),
			text: "",
			fontSize: 8,
			color: Color.fromHex("#ffd54f"),
			align: "right",
		});

		// Signal-driven updates (no polling)
		gameState.on("health").connect(({ value }) => {
			for (let i = 0; i < this.hearts.length; i++) {
				this.hearts[i].sourceRect =
					i < value
						? entitySheet.getFrameRect(TILE.HEART_FULL)
						: entitySheet.getFrameRect(TILE.HEART_EMPTY);
			}
		});

		gameState.on("score").connect(({ value }) => {
			this.scoreLabel.text = `Score: ${value}`;
		});

		gameState.on("keys").connect(({ value }) => {
			this.keyLabel.text = value > 0 ? `Keys: ${value}` : "";
		});

		gameState.on("sword").connect(({ value }) => {
			this.swordSprite.sourceRect = entitySheet.getFrameRect(value.spriteFrame);
		});
	}
}
