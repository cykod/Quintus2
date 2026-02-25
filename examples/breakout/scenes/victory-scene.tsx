import { Scene } from "@quintus/core";
import { Button, Label, Layer, Panel } from "@quintus/ui";
import { GAME_HEIGHT, GAME_WIDTH } from "../config.js";
import { gameState } from "../state.js";

export class VictoryScene extends Scene {
	override build() {
		const cx = GAME_WIDTH / 2;
		return (
			<Layer fixed>
				<Panel width={GAME_WIDTH} height={GAME_HEIGHT} backgroundColor="#0a0a2e" />
				<Label
					position={[cx, 180]}
					text="You Win!"
					fontSize={36}
					color="#81c784"
					align="center"
				/>
				<Label
					position={[cx, 230]}
					text="All levels cleared!"
					fontSize={12}
					color="#aaaaaa"
					align="center"
				/>
				<Label
					position={[cx, 270]}
					text={`Final Score: ${gameState.score}`}
					fontSize={18}
					color="#ffffff"
					align="center"
				/>
				<Button
					position={[cx - 60, 360]}
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
