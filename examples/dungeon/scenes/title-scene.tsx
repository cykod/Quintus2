import { Scene } from "@quintus/core";
import { Button, Label, Layer, Panel } from "@quintus/ui";
import { gameState } from "../state.js";

export class TitleScene extends Scene {
	override build() {
		return (
			<Layer fixed>
				<Panel width={320} height={240} backgroundColor="#1a1a2e" />
				<Label
					position={[160, 50]}
					text="Tiny Dungeon"
					fontSize={22}
					color="#e8a87c"
					align="center"
				/>
				<Label
					position={[160, 78]}
					text="A Quintus 2.0 Demo"
					fontSize={10}
					color="#888888"
					align="center"
				/>
				<Label
					position={[160, 120]}
					text="WASD to move, J to attack"
					fontSize={8}
					color="#aaaaaa"
					align="center"
				/>
				<Label
					position={[160, 134]}
					text="K to defend, E to interact, Q for potion"
					fontSize={8}
					color="#aaaaaa"
					align="center"
				/>
				<Button
					position={[110, 170]}
					width={100}
					height={32}
					text="Start"
					fontSize={16}
					backgroundColor="#e8a87c"
					hoverColor="#f0c0a0"
					pressedColor="#c0886c"
					textColor="#1a1a2e"
					onPressed={() => {
						gameState.reset();
						this.switchTo("level1");
					}}
				/>
			</Layer>
		);
	}
}
