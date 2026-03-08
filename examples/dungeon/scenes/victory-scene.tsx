import { Scene } from "@quintus/core";
import { Button, Label, Layer, Panel } from "@quintus/ui";
import { gameState } from "../state.js";

export class VictoryScene extends Scene {
	override build() {
		const cx = this.game.width / 2;
		const cy = this.game.height / 2;
		return (
			<Layer fixed>
				<Panel width={this.game.width} height={this.game.height} backgroundColor="#1a1a2e" />
				<Label
					position={[cx, cy - 70]}
					text="Victory!"
					fontSize={28}
					color="#81c784"
					align="center"
				/>
				<Label
					position={[cx, cy - 30]}
					text="The dungeon is conquered!"
					fontSize={10}
					color="#aaaaaa"
					align="center"
				/>
				<Label
					position={[cx, cy]}
					text={`Final Score: ${gameState.score}`}
					fontSize={14}
					color="#ffffff"
					align="center"
				/>
				<Button
					position={[cx - 60, cy + 50]}
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
