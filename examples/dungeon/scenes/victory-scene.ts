import { Scene } from "@quintus/core";
import { Color, Vec2 } from "@quintus/math";
import { Button, Label, Layer, Panel } from "@quintus/ui";
import { gameState, resetState } from "../state.js";
import { _Level1Ref } from "./game-over-scene.js";

export class VictoryScene extends Scene {
	override onReady() {
		const ui = this.add(Layer);
		ui.fixed = true;

		ui.addChild(Panel, {
			width: 320,
			height: 240,
			backgroundColor: Color.fromHex("#1a1a2e"),
		});

		ui.addChild(Label, {
			position: new Vec2(160, 50),
			text: "Victory!",
			fontSize: 28,
			color: Color.fromHex("#81c784"),
			align: "center",
		});

		ui.addChild(Label, {
			position: new Vec2(160, 90),
			text: "The dungeon is conquered!",
			fontSize: 10,
			color: Color.fromHex("#aaaaaa"),
			align: "center",
		});

		ui.addChild(Label, {
			position: new Vec2(160, 120),
			text: `Final Score: ${gameState.score}`,
			fontSize: 14,
			color: Color.WHITE,
			align: "center",
		});

		const playAgainBtn = ui.addChild(Button, {
			position: new Vec2(100, 170),
			width: 120,
			height: 30,
			text: "Play Again",
			fontSize: 14,
			backgroundColor: Color.fromHex("#333333"),
			hoverColor: Color.fromHex("#555555"),
			textColor: Color.WHITE,
		});
		playAgainBtn.onPressed.connect(() => {
			resetState();
			if (_Level1Ref) this.switchTo(_Level1Ref);
		});
	}
}
