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
			position: new Vec2(this.game.width / 2, 100),
			text: "Game Over",
			fontSize: 28,
			color: Color.fromHex("#ef5350"),
			align: "center",
		});

		ui.add(Label, {
			position: new Vec2(this.game.width / 2, 160),
			text: `Score: ${gameState.score}`,
			fontSize: 16,
			color: Color.WHITE,
			align: "center",
		});

		const retryBtn = ui.add(Button, {
			position: new Vec2(this.game.width / 2 - 60, 220),
			width: 120,
			height: 36,
			text: "Retry",
			fontSize: 14,
			backgroundColor: Color.fromHex("#333333"),
			hoverColor: Color.fromHex("#555555"),
			textColor: Color.WHITE,
		});
		retryBtn.onPressed.connect(() => {
			gameState.reset();
			this.switchTo("title");
		});
	}

	override onFixedUpdate(_dt: number) {
		if (this.game.input.isJustPressed("interact")) {
			gameState.reset();
			this.switchTo("title");
		}
	}
}
