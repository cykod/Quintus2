import { Scene } from "@quintus/core";
import { Color, Vec2 } from "@quintus/math";
import { Button, Label, Layer, Panel } from "@quintus/ui";
import { gameState } from "../state.js";

export class TitleScene extends Scene {
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
			text: "Quintus Platformer",
			fontSize: 20,
			color: Color.fromHex("#4fc3f7"),
			align: "center",
		});

		ui.add(Label, {
			position: new Vec2(160, 80),
			text: "A Quintus 2.0 Demo",
			fontSize: 10,
			color: Color.fromHex("#888888"),
			align: "center",
		});

		ui.add(Label, {
			position: new Vec2(160, 130),
			text: "Arrow keys to move, Up/Space to jump",
			fontSize: 8,
			color: Color.fromHex("#aaaaaa"),
			align: "center",
		});

		const startBtn = ui.add(Button, {
			position: new Vec2(110, 170),
			width: 100,
			height: 32,
			text: "Start",
			fontSize: 16,
			backgroundColor: Color.fromHex("#4fc3f7"),
			hoverColor: Color.fromHex("#81d4fa"),
			pressedColor: Color.fromHex("#29b6f6"),
			textColor: Color.WHITE,
		});
		startBtn.onPressed.connect(() => {
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
