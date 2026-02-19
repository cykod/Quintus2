import { Scene } from "@quintus/core";
import { Color, Vec2 } from "@quintus/math";
import { Button, Label, Layer, Panel } from "@quintus/ui";
import { resetState } from "../state.js";

export class TitleScene extends Scene {
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
			text: "Quintus Platformer",
			fontSize: 20,
			color: Color.fromHex("#4fc3f7"),
			align: "center",
		});

		ui.addChild(Label, {
			position: new Vec2(160, 80),
			text: "A Quintus 2.0 Demo",
			fontSize: 10,
			color: Color.fromHex("#888888"),
			align: "center",
		});

		ui.addChild(Label, {
			position: new Vec2(160, 130),
			text: "Arrow keys to move, Up/Space to jump",
			fontSize: 8,
			color: Color.fromHex("#aaaaaa"),
			align: "center",
		});

		const startBtn = ui.addChild(Button, {
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
			resetState();
			this.switchTo("level1");
		});
	}
}
