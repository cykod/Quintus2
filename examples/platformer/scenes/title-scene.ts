import { Scene } from "@quintus/core";
import { Color, Vec2 } from "@quintus/math";
import { Button, Label, Layer, Panel } from "@quintus/ui";
import { resetState } from "../state.js";
import { Level1 } from "./level1.js";

export class TitleScene extends Scene {
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
		title.text = "Quintus Platformer";
		title.fontSize = 20;
		title.color = Color.fromHex("#4fc3f7");
		title.align = "center";

		// Subtitle
		const subtitle = ui.addChild(Label);
		subtitle.position = new Vec2(160, 80);
		subtitle.text = "A Quintus 2.0 Demo";
		subtitle.fontSize = 10;
		subtitle.color = Color.fromHex("#888888");
		subtitle.align = "center";

		// Instructions
		const instructions = ui.addChild(Label);
		instructions.position = new Vec2(160, 130);
		instructions.text = "Arrow keys to move, Up/Space to jump";
		instructions.fontSize = 8;
		instructions.color = Color.fromHex("#aaaaaa");
		instructions.align = "center";

		// Start button
		const startBtn = ui.addChild(Button);
		startBtn.position = new Vec2(110, 170);
		startBtn.width = 100;
		startBtn.height = 32;
		startBtn.text = "Start";
		startBtn.fontSize = 16;
		startBtn.backgroundColor = Color.fromHex("#4fc3f7");
		startBtn.hoverColor = Color.fromHex("#81d4fa");
		startBtn.pressedColor = Color.fromHex("#29b6f6");
		startBtn.textColor = Color.WHITE;
		startBtn.onPressed.connect(() => {
			resetState();
			this.switchTo(Level1);
		});
	}
}
