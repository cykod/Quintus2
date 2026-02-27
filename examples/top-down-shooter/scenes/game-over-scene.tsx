import { Scene } from "@quintus/core";
import { Button, Label, Layer, Panel } from "@quintus/ui";
import { GAME_HEIGHT, GAME_WIDTH } from "../config.js";
import { gameState } from "../state.js";

export class GameOverScene extends Scene {
	override build() {
		const cx = GAME_WIDTH / 2;
		return (
			<Layer fixed>
				<Panel width={GAME_WIDTH} height={GAME_HEIGHT} backgroundColor="#1a1a2e" />
				<Label position={[cx, 180]} text="GAME OVER" fontSize={36} color="#ef5350" align="center" />
				<Label
					position={[cx, 240]}
					text={`Score: ${gameState.score}`}
					fontSize={18}
					color="#ffffff"
					align="center"
				/>
				<Label
					position={[cx, 268]}
					text={`Waves: ${gameState.wave}  Kills: ${gameState.kills}`}
					fontSize={14}
					color="#aaaaaa"
					align="center"
				/>
				<Button
					position={[cx - 60, 330]}
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
