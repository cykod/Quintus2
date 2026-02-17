import { Color, Rect, Vec2 } from "@quintus/math";
import { Sprite } from "@quintus/sprites";
import { Label, Layer } from "@quintus/ui";
import { gameState } from "../state.js";

// Heart tile source rects from the 8×8 tileset (15 columns, 1px spacing)
const HEART_FULL = new Rect(108, 72, 8, 8); // tile 132: col 12, row 8
const HEART_EMPTY = new Rect(126, 72, 8, 8); // tile 134: col 14, row 8

export class HUD extends Layer {
	private hearts: Sprite[] = [];
	private scoreLabel!: Label;
	private coinLabel!: Label;

	override onReady() {
		this.fixed = true;
		this.zIndex = 100;

		// Heart icons
		for (let i = 0; i < gameState.maxHealth; i++) {
			const heart = this.addChild(Sprite);
			heart.texture = "tileset";
			heart.sourceRect = i < gameState.health ? HEART_FULL : HEART_EMPTY;
			heart.centered = false;
			heart.position = new Vec2(4 + i * 10, 4);
			this.hearts.push(heart);
		}

		// Coin counter
		this.coinLabel = this.addChild(Label);
		this.coinLabel.position = new Vec2(8, 16);
		this.coinLabel.text = `Coins: ${gameState.coins}`;
		this.coinLabel.fontSize = 8;
		this.coinLabel.color = Color.fromHex("#ffd54f");

		// Score
		this.scoreLabel = this.addChild(Label);
		this.scoreLabel.position = new Vec2(250, 4);
		this.scoreLabel.text = `Score: ${gameState.score}`;
		this.scoreLabel.fontSize = 8;
		this.scoreLabel.color = Color.WHITE;
		this.scoreLabel.align = "right";
	}

	override onUpdate(_dt: number) {
		// Update heart sprites
		for (let i = 0; i < this.hearts.length; i++) {
			(this.hearts[i] as Sprite).sourceRect = i < gameState.health ? HEART_FULL : HEART_EMPTY;
		}

		this.scoreLabel.text = `Score: ${gameState.score}`;
		this.coinLabel.text = `Coins: ${gameState.coins}`;
	}
}
