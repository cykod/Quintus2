import { Scene } from "@quintus/core";
import { Color, Vec2 } from "@quintus/math";
import { Button, Label, Layer, Panel } from "@quintus/ui";
import { gameState } from "../state.js";

export class VictoryScene extends Scene {
	override onReady() {
		const ui = this.add(Layer);
		ui.fixed = true;

		ui.add(Panel, {
			width: 320,
			height: 240,
			backgroundColor: Color.fromHex("#1a1a2e"),
		});

		ui.add(Label, {
			position: new Vec2(160, 50),
			text: "Victory!",
			fontSize: 28,
			color: Color.fromHex("#81c784"),
			align: "center",
		});

		ui.add(Label, {
			position: new Vec2(160, 100),
			text: `Final Score: ${gameState.score}`,
			fontSize: 14,
			color: Color.WHITE,
			align: "center",
		});

		ui.add(Label, {
			position: new Vec2(160, 120),
			text: `Coins: ${gameState.coins}`,
			fontSize: 12,
			color: Color.fromHex("#ffd54f"),
			align: "center",
		});

		const playAgainBtn = ui.add(Button, {
			position: new Vec2(100, 160),
			width: 120,
			height: 30,
			text: "Play Again",
			fontSize: 14,
			backgroundColor: Color.fromHex("#333333"),
			hoverColor: Color.fromHex("#555555"),
			textColor: Color.WHITE,
		});
		playAgainBtn.onPressed.connect(() => {
			gameState.reset();
			this.switchTo("level1");
		});
	}
}
