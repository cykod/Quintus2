import { Scene } from "@quintus/core";
import { Button, Label, Layer, Panel } from "@quintus/ui";
import { gameState } from "../state.js";

export class GameOverScene extends Scene {
	override build() {
		return (
			<Layer fixed>
				<Panel width={320} height={240} backgroundColor="#1a1a2e" />
				<Label position={[160, 60]} text="Game Over" fontSize={24} color="#ef5350" align="center" />
				<Label
					position={[160, 100]}
					text={`Score: ${gameState.score}`}
					fontSize={12}
					color="#ffffff"
					align="center"
				/>
				<Label
					position={[160, 120]}
					text={`Coins: ${gameState.coins}`}
					fontSize={12}
					color="#ffd54f"
					align="center"
				/>
				<Button
					position={[110, 160]}
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
