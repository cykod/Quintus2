import { Scene, type SceneConstructor } from "@quintus/core";
import { Color, Vec2 } from "@quintus/math";
import { Button, Label, Layer, Panel } from "@quintus/ui";
import { gameState, resetState } from "../state.js";

/** Lazily set by level1.ts to avoid circular imports. */
export let _Level1Ref: SceneConstructor | null = null;
export function _setLevel1Ref(ref: SceneConstructor): void {
	_Level1Ref = ref;
}

export class GameOverScene extends Scene {
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
		title.position = new Vec2(160, 60);
		title.text = "Game Over";
		title.fontSize = 24;
		title.color = Color.fromHex("#ef5350");
		title.align = "center";

		// Score
		const score = ui.addChild(Label);
		score.position = new Vec2(160, 100);
		score.text = `Score: ${gameState.score}`;
		score.fontSize = 12;
		score.color = Color.WHITE;
		score.align = "center";

		// Coins
		const coins = ui.addChild(Label);
		coins.position = new Vec2(160, 120);
		coins.text = `Coins: ${gameState.coins}`;
		coins.fontSize = 12;
		coins.color = Color.fromHex("#ffd54f");
		coins.align = "center";

		// Retry button
		const retryBtn = ui.addChild(Button);
		retryBtn.position = new Vec2(110, 160);
		retryBtn.width = 100;
		retryBtn.height = 30;
		retryBtn.text = "Retry";
		retryBtn.fontSize = 14;
		retryBtn.backgroundColor = Color.fromHex("#333333");
		retryBtn.hoverColor = Color.fromHex("#555555");
		retryBtn.textColor = Color.WHITE;
		retryBtn.onPressed.connect(() => {
			resetState();
			if (_Level1Ref) this.switchTo(_Level1Ref);
		});
	}
}
