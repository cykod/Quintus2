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

		ui.addChild(Panel, {
			width: 320,
			height: 240,
			backgroundColor: Color.fromHex("#1a1a2e"),
		});

		ui.addChild(Label, {
			position: new Vec2(160, 60),
			text: "Game Over",
			fontSize: 24,
			color: Color.fromHex("#ef5350"),
			align: "center",
		});

		ui.addChild(Label, {
			position: new Vec2(160, 100),
			text: `Score: ${gameState.score}`,
			fontSize: 12,
			color: Color.WHITE,
			align: "center",
		});

		ui.addChild(Label, {
			position: new Vec2(160, 120),
			text: `Coins: ${gameState.coins}`,
			fontSize: 12,
			color: Color.fromHex("#ffd54f"),
			align: "center",
		});

		const retryBtn = ui.addChild(Button, {
			position: new Vec2(110, 160),
			width: 100,
			height: 30,
			text: "Retry",
			fontSize: 14,
			backgroundColor: Color.fromHex("#333333"),
			hoverColor: Color.fromHex("#555555"),
			textColor: Color.WHITE,
		});
		retryBtn.onPressed.connect(() => {
			resetState();
			if (_Level1Ref) this.switchTo(_Level1Ref);
		});
	}
}
