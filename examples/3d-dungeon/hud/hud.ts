import { Color, Vec2 } from "@quintus/math";
import { Label, Layer } from "@quintus/ui";
import { gameState } from "../state.js";

export class HUD extends Layer {
	private scoreLabel!: Label;
	private healthLabel!: Label;
	private levelLabel!: Label;
	private turnLabel!: Label;
	private flashLabel!: Label;
	private _flashTimer = 0;

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

		this.turnLabel = this.add(Label, {
			position: new Vec2(8, 28),
			text: `Turn: ${gameState.turn}`,
			fontSize: 12,
			color: Color.fromHex("#b0bec5"),
		});

		this.flashLabel = this.add(Label, {
			position: new Vec2(this.game.width / 2, this.game.height / 2 - 40),
			text: "",
			fontSize: 24,
			color: Color.fromHex("#ffffff"),
			align: "center",
		});
		this.flashLabel.visible = false;

		gameState.on("score").connect(({ value }) => {
			this.scoreLabel.text = `Score: ${value}`;
		});

		gameState.on("health").connect(({ value }) => {
			this.healthLabel.text = this._heartsText(value, gameState.maxHealth);
		});

		gameState.on("level").connect(({ value }) => {
			this.levelLabel.text = `Level ${value}`;
		});

		gameState.on("turn").connect(({ value }) => {
			this.turnLabel.text = `Turn: ${value}`;
		});
	}

	/** Show a centered flash text that fades after ~1 second. */
	flash(text: string, color = "#ffffff"): void {
		this.flashLabel.text = text;
		this.flashLabel.color = Color.fromHex(color);
		this.flashLabel.visible = true;
		this._flashTimer = 1.0;
	}

	override onUpdate(dt: number): void {
		if (this._flashTimer > 0) {
			this._flashTimer -= dt;
			if (this._flashTimer <= 0) {
				this.flashLabel.visible = false;
			}
		}
	}

	private _heartsText(current: number, max: number): string {
		const filled = Math.max(0, current);
		const empty = max - filled;
		return "\u2665".repeat(filled) + "\u2661".repeat(empty);
	}
}
