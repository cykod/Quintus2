import { Scene } from "@quintus/core";
import { Button, Label, Layer, Panel } from "@quintus/ui";
import { GAME_HEIGHT, GAME_WIDTH } from "../config.js";
import { gameState } from "../state.js";

export class TitleScene extends Scene {
	override build() {
		const cx = GAME_WIDTH / 2;
		return (
			<Layer fixed>
				<Panel width={GAME_WIDTH} height={GAME_HEIGHT} backgroundColor="#0a0a1e" />
				<Label
					position={[cx, 160]}
					text="SPACE SHOOTER"
					fontSize={36}
					color="#4fc3f7"
					align="center"
				/>
				<Label
					position={[cx, 210]}
					text="A Quintus 2.0 Demo"
					fontSize={12}
					color="#888888"
					align="center"
				/>
				<Label
					position={[cx, 290]}
					text="Arrow keys / WASD to move"
					fontSize={11}
					color="#aaaaaa"
					align="center"
				/>
				<Label
					position={[cx, 310]}
					text="Space to fire"
					fontSize={11}
					color="#aaaaaa"
					align="center"
				/>
				<Button
					position={[cx - 60, 380]}
					width={120}
					height={40}
					text="Start"
					fontSize={20}
					backgroundColor="#4fc3f7"
					hoverColor="#80d8ff"
					pressedColor="#0288d1"
					textColor="#0a0a1e"
					onPressed={() => {
						gameState.reset();
						this.switchTo("game");
					}}
				/>
			</Layer>
		);
	}

	override onFixedUpdate(_dt: number) {
		if (this.game.input.isJustPressed("ui_confirm")) {
			gameState.reset();
			this.switchTo("game");
		}
	}
}
