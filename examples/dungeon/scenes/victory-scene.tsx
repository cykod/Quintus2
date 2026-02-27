import { Scene } from "@quintus/core";
import { Button, Label, Layer, Panel } from "@quintus/ui";
import { gameState } from "../state.js";

export class VictoryScene extends Scene {
	override build() {
		return (
			<Layer fixed>
				<Panel width={320} height={240} backgroundColor="#1a1a2e" />
				<Label position={[160, 50]} text="Victory!" fontSize={28} color="#81c784" align="center" />
				<Label
					position={[160, 90]}
					text="The dungeon is conquered!"
					fontSize={10}
					color="#aaaaaa"
					align="center"
				/>
				<Label
					position={[160, 120]}
					text={`Final Score: ${gameState.score}`}
					fontSize={14}
					color="#ffffff"
					align="center"
				/>
				<Button
					position={[100, 170]}
					width={120}
					height={30}
					text="Play Again"
					fontSize={14}
					backgroundColor="#333333"
					hoverColor="#555555"
					textColor="#ffffff"
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
