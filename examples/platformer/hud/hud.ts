import { Color, Vec2 } from "@quintus/math";
import { Label, Layer, ProgressBar } from "@quintus/ui";
import { gameState } from "../state.js";

export class HUD extends Layer {
	private healthBar!: ProgressBar;
	private healthLabel!: Label;
	private scoreLabel!: Label;
	private coinLabel!: Label;

	override onReady() {
		this.fixed = true;
		this.zIndex = 100;

		// Health bar
		this.healthBar = this.addChild(ProgressBar);
		this.healthBar.position = new Vec2(8, 8);
		this.healthBar.width = 48;
		this.healthBar.height = 6;
		this.healthBar.maxValue = gameState.maxHealth;
		this.healthBar.value = gameState.health;
		this.healthBar.fillColor = Color.fromHex("#ef5350");
		this.healthBar.backgroundColor = Color.fromHex("#424242");

		// Health label
		this.healthLabel = this.addChild(Label);
		this.healthLabel.position = new Vec2(60, 8);
		this.healthLabel.text = `${gameState.health}/${gameState.maxHealth}`;
		this.healthLabel.fontSize = 8;
		this.healthLabel.color = Color.WHITE;

		// Coin counter
		this.coinLabel = this.addChild(Label);
		this.coinLabel.position = new Vec2(8, 20);
		this.coinLabel.text = `Coins: ${gameState.coins}`;
		this.coinLabel.fontSize = 8;
		this.coinLabel.color = Color.fromHex("#ffd54f");

		// Score
		this.scoreLabel = this.addChild(Label);
		this.scoreLabel.position = new Vec2(250, 8);
		this.scoreLabel.text = `Score: ${gameState.score}`;
		this.scoreLabel.fontSize = 8;
		this.scoreLabel.color = Color.WHITE;
		this.scoreLabel.align = "right";
	}

	override onUpdate(_dt: number) {
		this.healthBar.value = gameState.health;
		this.healthLabel.text = `${gameState.health}/${gameState.maxHealth}`;
		this.scoreLabel.text = `Score: ${gameState.score}`;
		this.coinLabel.text = `Coins: ${gameState.coins}`;
	}
}
