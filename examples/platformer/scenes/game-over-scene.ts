import { Scene } from "@quintus/core";
import { Color, Vec2 } from "@quintus/math";
import { Button, Label, Layer, Panel } from "@quintus/ui";
import { gameState } from "../state.js";

export class GameOverScene extends Scene {
	override onReady() {
		const ui = this.add(Layer);
		ui.fixed = true;

		ui.add(Panel, {
			width: this.game.width,
			height: this.game.height,
			backgroundColor: Color.fromHex("#1a1a2e"),
		});

		ui.add(Label, {
			position: new Vec2(this.game.width / 2, 60),
			text: "Game Over",
			fontSize: 24,
			color: Color.fromHex("#ef5350"),
			align: "center",
		});

		ui.add(Label, {
			position: new Vec2(this.game.width / 2, 100),
			text: `Score: ${gameState.score}`,
			fontSize: 12,
			color: Color.WHITE,
			align: "center",
		});

		ui.add(Label, {
			position: new Vec2(this.game.width / 2, 120),
			text: `Coins: ${gameState.coins}`,
			fontSize: 12,
			color: Color.fromHex("#ffd54f"),
			align: "center",
		});

		const retryBtn = ui.add(Button, {
			position: new Vec2(this.game.width / 2 - 50, 160),
			width: 100,
			height: 30,
			text: "Retry",
			fontSize: 14,
			backgroundColor: Color.fromHex("#333333"),
			hoverColor: Color.fromHex("#555555"),
			textColor: Color.WHITE,
		});
		retryBtn.onPressed.connect(() => {
			gameState.reset();
			this.switchTo("level1");
		});
	}

	override onFixedUpdate(_dt: number) {
		if (this.game.input.isJustPressed("ui_confirm")) {
			gameState.reset();
			this.switchTo("level1");
		}
	}
}
