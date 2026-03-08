import { Scene } from "@quintus/core";
import { Button, Label, Layer, Panel } from "@quintus/ui";
import { gameState } from "../state.js";

export class TitleScene extends Scene {
	override build() {
		const cx = this.game.width / 2;
		const cy = this.game.height / 2;
		return (
			<Layer fixed>
				<Panel width={this.game.width} height={this.game.height} backgroundColor="#1a1a2e" />
				<Label
					position={[cx, cy - 70]}
					text="Tiny Dungeon"
					fontSize={22}
					color="#e8a87c"
					align="center"
				/>
				<Label
					position={[cx, cy - 42]}
					text="A Quintus 2.0 Demo"
					fontSize={10}
					color="#888888"
					align="center"
				/>
				<Label
					position={[cx, 120]}
					text="WASD to move, J to attack"
					fontSize={8}
					color="#aaaaaa"
					align="center"
				/>
				<Label
					position={[cx, 134]}
					text="K to defend, E to interact, Q for potion"
					fontSize={8}
					color="#aaaaaa"
					align="center"
				/>
				<Button
					position={[cx - 50, cy + 50]}
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

	override onFixedUpdate(_dt: number) {
		if (this.game.input.isJustPressed("ui_confirm")) {
			gameState.reset();
			this.switchTo("level1");
		}
	}
}
