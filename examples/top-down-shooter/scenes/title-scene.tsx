import { Scene } from "@quintus/core";
import { Button, Label, Layer, Panel } from "@quintus/ui";
import { GAME_HEIGHT, GAME_WIDTH } from "../config.js";
import { gameState } from "../state.js";

export class TitleScene extends Scene {
	override build() {
		const cx = GAME_WIDTH / 2;
		return (
			<Layer fixed>
				<Panel width={GAME_WIDTH} height={GAME_HEIGHT} backgroundColor="#1a1a2e" />
				<Label
					position={[cx, 150]}
					text="TOP-DOWN SHOOTER"
					fontSize={36}
					color="#4fc3f7"
					align="center"
				/>
				<Label
					position={[cx, 200]}
					text="A Quintus 2.0 Pooling Demo"
					fontSize={12}
					color="#888888"
					align="center"
				/>
				<Label
					position={[cx, 280]}
					text="WASD to move, mouse to aim"
					fontSize={11}
					color="#aaaaaa"
					align="center"
				/>
				<Label
					position={[cx, 300]}
					text="Click or Space to fire"
					fontSize={11}
					color="#aaaaaa"
					align="center"
				/>
				<Label
					position={[cx, 320]}
					text="Kill enemies to find weapon pickups!"
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
					textColor="#1a1a2e"
					onPressed={() => {
						gameState.reset();
						this.switchTo("arena");
					}}
				/>
			</Layer>
		);
	}
}
