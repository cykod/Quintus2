import { Scene } from "@quintus/core";
import { Button, Label, Layer, Panel } from "@quintus/ui";
import { GAME_HEIGHT, GAME_WIDTH } from "../config.js";
import { gameState } from "../state.js";

export class GameOverScene extends Scene {
	override build() {
		const cx = GAME_WIDTH / 2;
		const won = gameState.lives > 0;
		return (
			<Layer fixed>
				<Panel width={GAME_WIDTH} height={GAME_HEIGHT} backgroundColor="#1a3a0e" />
				<Label
					position={[cx, 200]}
					text={won ? "Victory!" : "Game Over"}
					fontSize={32}
					color={won ? "#8bc34a" : "#ef5350"}
					align="center"
				/>
				<Label
					position={[cx, 250]}
					text={`Score: ${gameState.score}`}
					fontSize={16}
					color="#ffffff"
					align="center"
				/>
				<Label
					position={[cx, 280]}
					text={`Waves Survived: ${gameState.wave}`}
					fontSize={14}
					color="#aaaaaa"
					align="center"
				/>
				<Button
					position={[cx - 60, 340]}
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
}
