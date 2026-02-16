import { Scene } from "@quintus/core";
import { Color, Vec2 } from "@quintus/math";
import { Button, Label, Layer, Panel } from "@quintus/ui";
import { gameState, resetState } from "../state.js";
import { _Level1Ref } from "./game-over-scene.js";

export class VictoryScene extends Scene {
	override onReady() {
		const ui = this.add(Layer);
		ui.fixed = true;

		// Background
		const bg = ui.addChild(Panel);
		bg.width = 320;
		bg.height = 240;
		bg.backgroundColor = Color.fromHex("#1a1a2e");

		// Title
		const title = ui.addChild(Label);
		title.position = new Vec2(160, 50);
		title.text = "Victory!";
		title.fontSize = 28;
		title.color = Color.fromHex("#81c784");
		title.align = "center";

		// Score
		const score = ui.addChild(Label);
		score.position = new Vec2(160, 100);
		score.text = `Final Score: ${gameState.score}`;
		score.fontSize = 14;
		score.color = Color.WHITE;
		score.align = "center";

		// Coins
		const coins = ui.addChild(Label);
		coins.position = new Vec2(160, 120);
		coins.text = `Coins: ${gameState.coins}`;
		coins.fontSize = 12;
		coins.color = Color.fromHex("#ffd54f");
		coins.align = "center";

		// Play Again button
		const playAgainBtn = ui.addChild(Button);
		playAgainBtn.position = new Vec2(100, 160);
		playAgainBtn.width = 120;
		playAgainBtn.height = 30;
		playAgainBtn.text = "Play Again";
		playAgainBtn.fontSize = 14;
		playAgainBtn.backgroundColor = Color.fromHex("#333333");
		playAgainBtn.hoverColor = Color.fromHex("#555555");
		playAgainBtn.textColor = Color.WHITE;
		playAgainBtn.onPressed.connect(() => {
			resetState();
			if (_Level1Ref) this.switchTo(_Level1Ref);
		});
	}
}
