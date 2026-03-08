import { Scene } from "@quintus/core";
import { Color, Vec2 } from "@quintus/math";
import { isTouchDevice } from "@quintus/touch";
import { Button, Label, Layer, Panel } from "@quintus/ui";
import { gameState } from "../state.js";

export class TitleScene extends Scene {
	override onReady() {
		const ui = this.add(Layer);
		ui.fixed = true;

		ui.add(Panel, {
			width: this.game.width,
			height: this.game.height,
			backgroundColor: Color.fromHex("#1a1a2e"),
		});

		ui.add(Label, {
			position: new Vec2(this.game.width / 2, 120),
			text: "3D Dungeon",
			fontSize: 32,
			color: Color.fromHex("#ffd54f"),
			align: "center",
		});

		ui.add(Label, {
			position: new Vec2(this.game.width / 2, 180),
			text: "Collect coins and find the exit!",
			fontSize: 12,
			color: Color.WHITE,
			align: "center",
		});

		const prompt = isTouchDevice() ? "Tap to Start" : "Press Space to Start";
		ui.add(Label, {
			position: new Vec2(this.game.width / 2, 240),
			text: prompt,
			fontSize: 14,
			color: Color.fromHex("#42a5f5"),
			align: "center",
		});

		const startBtn = ui.add(Button, {
			position: new Vec2(this.game.width / 2 - 60, 300),
			width: 120,
			height: 36,
			text: "Start",
			fontSize: 16,
			backgroundColor: Color.fromHex("#333333"),
			hoverColor: Color.fromHex("#555555"),
			textColor: Color.WHITE,
		});
		startBtn.onPressed.connect(() => {
			gameState.reset();
			this.switchTo("level1");
		});
	}

	override onFixedUpdate(_dt: number) {
		if (this.game.input.isJustPressed("interact")) {
			gameState.reset();
			this.switchTo("level1");
		}
	}
}
