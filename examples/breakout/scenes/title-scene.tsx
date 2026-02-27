import { Scene } from "@quintus/core";
import { Button, Label, Layer, Panel } from "@quintus/ui";
import { GAME_HEIGHT, GAME_WIDTH } from "../config.js";
import { gameState } from "../state.js";

export class TitleScene extends Scene {
	override build() {
		const cx = GAME_WIDTH / 2;
		return (
			<Layer fixed>
				<Panel width={GAME_WIDTH} height={GAME_HEIGHT} backgroundColor="#0a0a2e" />
				<Label position={[cx, 180]} text="BREAKOUT" fontSize={40} color="#4fc3f7" align="center" />
				<Label
					position={[cx, 230]}
					text="A Quintus 2.0 Demo"
					fontSize={12}
					color="#888888"
					align="center"
				/>
				<Label
					position={[cx, 310]}
					text="Arrow keys / A-D to move paddle"
					fontSize={11}
					color="#aaaaaa"
					align="center"
				/>
				<Label
					position={[cx, 330]}
					text="Space to launch ball"
					fontSize={11}
					color="#aaaaaa"
					align="center"
				/>
				<Button
					position={[cx - 60, 400]}
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
}
