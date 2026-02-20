import { Scene } from "@quintus/core";
import { Button, Label, Layer, Panel } from "@quintus/ui";
import { gameState } from "../state.js";

export class TitleScene extends Scene {
	override build() {
		return (
			<Layer fixed>
				<Panel width={320} height={240} backgroundColor="#1a1a2e" />
				<Label position={[160, 50]} text="Quintus Platformer" fontSize={20} color="#4fc3f7" align="center" />
				<Label position={[160, 80]} text="A Quintus 2.0 Demo" fontSize={10} color="#888888" align="center" />
				<Label position={[160, 130]} text="Arrow keys to move, Up/Space to jump" fontSize={8} color="#aaaaaa" align="center" />
				<Button
					position={[110, 170]}
					width={100}
					height={32}
					text="Start"
					fontSize={16}
					backgroundColor="#4fc3f7"
					hoverColor="#81d4fa"
					pressedColor="#29b6f6"
					textColor="#ffffff"
					onPressed={() => {
						gameState.reset();
						this.switchTo("level1");
					}}
				/>
			</Layer>
		);
	}
}
