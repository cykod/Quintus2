import { Scene } from "@quintus/core";
import { Button, Label, Layer, Panel } from "@quintus/ui";
import { gameState } from "../state.js";

export class TitleScene extends Scene {
	override build() {
		const cx = this.game.width / 2;
		const cy = this.game.height / 2;
		return (
			<Layer fixed>
				<Panel width={this.game.width} height={this.game.height} backgroundColor="#0a0a2e" />
				<Label
					position={[cx, cy - 140]}
					text="BREAKOUT"
					fontSize={40}
					color="#4fc3f7"
					align="center"
				/>
				<Label
					position={[cx, cy - 90]}
					text="A Quintus 2.0 Demo"
					fontSize={12}
					color="#888888"
					align="center"
				/>
				<Label
					position={[cx, cy - 10]}
					text="Arrow keys / A-D to move paddle"
					fontSize={11}
					color="#aaaaaa"
					align="center"
				/>
				<Label
					position={[cx, cy + 10]}
					text="Space to launch ball"
					fontSize={11}
					color="#aaaaaa"
					align="center"
				/>
				<Button
					position={[cx - 60, cy + 80]}
					width={120}
					height={40}
					text="Start"
					fontSize={20}
					backgroundColor="#4fc3f7"
					hoverColor="#80d8ff"
					pressedColor="#0288d1"
					textColor="#0a0a2e"
					onPressed={() => {
						gameState.reset();
						this.switchTo("level1");
					}}
				/>
			</Layer>
		);
	}

	override onFixedUpdate(_dt: number) {
		if (this.game.input.isJustPressed("ui_confirm")) {
			gameState.reset();
			this.switchTo("level1");
		}
	}
}
