import { Color, Vec2 } from "@quintus/math";
import { Label, Layer } from "@quintus/ui";
import { gameState } from "../state.js";

export class HUD extends Layer {
	private scoreLabel!: Label;
	private healthLabel!: Label;
	private levelLabel!: Label;

	override onReady() {
		this.fixed = true;
		this.zIndex = 100;

		this.scoreLabel = this.add(Label, {
			position: new Vec2(8, 8),
			text: `Score: ${gameState.score}`,
			fontSize: 14,
			color: Color.fromHex("#ffd54f"),
		});

		this.healthLabel = this.add(Label, {
			position: new Vec2(this.game.width / 2, 8),
			text: this._heartsText(gameState.health, gameState.maxHealth),
			fontSize: 14,
			color: Color.fromHex("#ef5350"),
			align: "center",
		});

		this.levelLabel = this.add(Label, {
			position: new Vec2(this.game.width - 8, 8),
			text: `Level ${gameState.level}`,
			fontSize: 14,
			color: Color.fromHex("#42a5f5"),
			align: "right",
		});

		gameState.on("score").connect(({ value }) => {
			this.scoreLabel.text = `Score: ${value}`;
		});

		gameState.on("health").connect(({ value }) => {
			this.healthLabel.text = this._heartsText(value, gameState.maxHealth);
		});

		gameState.on("level").connect(({ value }) => {
			this.levelLabel.text = `Level ${value}`;
		});
	}

	private _heartsText(current: number, max: number): string {
		const filled = Math.max(0, current);
		const empty = max - filled;
		return "\u2665".repeat(filled) + "\u2661".repeat(empty);
	}
}
