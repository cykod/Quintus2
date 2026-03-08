import { Scene } from "@quintus/core";
import { Button, Label, Layer, Panel } from "@quintus/ui";
import { gameState } from "../state.js";

export class GameOverScene extends Scene {
	override build() {
		const cx = this.game.width / 2;
		const cy = this.game.height / 2;
		return (
			<Layer fixed>
				<Panel width={this.game.width} height={this.game.height} backgroundColor="#1a1a2e" />
				<Label
					position={[cx, cy - 60]}
					text="Game Over"
					fontSize={24}
					color="#ef5350"
					align="center"
				/>
				<Label
					position={[cx, cy - 20]}
					text={`Score: ${gameState.score}`}
					fontSize={12}
					color="#ffffff"
					align="center"
				/>
				<Button
					position={[cx - 50, cy + 40]}
					width={100}
					height={30}
					text="Retry"
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
