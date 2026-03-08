import { Scene } from "@quintus/core";
import { Button, Label, Layer, Panel } from "@quintus/ui";
import { gameState } from "../state.js";

export class GameOverScene extends Scene {
	override build() {
		const cx = this.game.width / 2;
		const cy = this.game.height / 2;
		return (
			<Layer fixed>
				<Panel width={this.game.width} height={this.game.height} backgroundColor="#0a0a2e" />
				<Label
					position={[cx, cy - 120]}
					text="Game Over"
					fontSize={32}
					color="#ef5350"
					align="center"
				/>
				<Label
					position={[cx, cy - 60]}
					text={`Final Score: ${gameState.score}`}
					fontSize={16}
					color="#ffffff"
					align="center"
				/>
				<Button
					position={[cx - 60, cy + 20]}
					width={120}
					height={36}
					text="Play Again"
					fontSize={16}
					backgroundColor="#333333"
					hoverColor="#555555"
					pressedColor="#222222"
					textColor="#ffffff"
					onPressed={() => {
						gameState.reset();
						this.switchTo("title");
					}}
				/>
			</Layer>
		);
	}

	override onFixedUpdate(_dt: number) {
		if (this.game.input.isJustPressed("ui_confirm")) {
			gameState.reset();
			this.switchTo("title");
		}
	}
}
