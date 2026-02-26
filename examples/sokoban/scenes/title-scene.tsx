import { Scene } from "@quintus/core";
import { Button, Label, Layer, Panel } from "@quintus/ui";
import { GAME_HEIGHT, GAME_WIDTH } from "../config.js";
import { gameState } from "../state.js";

export class TitleScene extends Scene {
	override build() {
		const cx = GAME_WIDTH / 2;
		return (
			<Layer fixed>
				<Panel width={GAME_WIDTH} height={GAME_HEIGHT} backgroundColor="#3b2d1f" />
				<Label position={[cx, 180]} text="SOKOBAN" fontSize={40} color="#e8c170" align="center" />
				<Label
					position={[cx, 230]}
					text="A Quintus 2.0 Demo"
					fontSize={12}
					color="#888888"
					align="center"
				/>
				<Label
					position={[cx, 300]}
					text="Push crates onto targets"
					fontSize={11}
					color="#aaaaaa"
					align="center"
				/>
				<Label
					position={[cx, 320]}
					text="Arrow keys / WASD to move"
					fontSize={11}
					color="#aaaaaa"
					align="center"
				/>
				<Label
					position={[cx, 340]}
					text="Z to undo, R to reset"
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
					backgroundColor="#e8c170"
					hoverColor="#f0d090"
					pressedColor="#c0a050"
					textColor="#3b2d1f"
					onPressed={() => {
						gameState.reset();
						this.switchTo("level-select");
					}}
				/>
			</Layer>
		);
	}
}
