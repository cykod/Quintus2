import { Scene } from "@quintus/core";
import { Color, Vec2 } from "@quintus/math";
import { Button, Label, Layer, Panel } from "@quintus/ui";
import { resetState } from "../state.js";
import { Level1 } from "./level1.js";

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
			text: "Tiny Dungeon",
			fontSize: 22,
			color: Color.fromHex("#e8a87c"),
			align: "center",
		});

		ui.addChild(Label, {
			position: new Vec2(160, 78),
			text: "A Quintus 2.0 Demo",
			fontSize: 10,
			color: Color.fromHex("#888888"),
			align: "center",
		});

		ui.addChild(Label, {
			position: new Vec2(160, 120),
			text: "WASD to move, J to attack",
			fontSize: 8,
			color: Color.fromHex("#aaaaaa"),
			align: "center",
		});

		ui.addChild(Label, {
			position: new Vec2(160, 134),
			text: "K to defend, E to interact",
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
			backgroundColor: Color.fromHex("#e8a87c"),
			hoverColor: Color.fromHex("#f0c0a0"),
			pressedColor: Color.fromHex("#c0886c"),
			textColor: Color.fromHex("#1a1a2e"),
		});
		startBtn.onPressed.connect(() => {
			resetState();
			this.switchTo(Level1);
		});
	}
}
