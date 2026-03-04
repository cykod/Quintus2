import { Scene } from "@quintus/core";
import { Button, Label, Layer, Panel } from "@quintus/ui";
import { gameState } from "../state.js";

/**
 * Victory screen — shown when player reaches the exit door.
 */
export class VictoryScene extends Scene {
	override build() {
		const cx = this.game.width / 2;
		return (
			<Layer fixed>
				<Panel width={this.game.width} height={this.game.height} backgroundColor="#0a1a0a" />
				<Label
					position={[cx, 200]}
					text="Victory!"
					fontSize={44}
					color="#81c784"
					align="center"
					shadow={{ offset: [2, 2], color: "#000000" }}
				/>
				<Label
					position={[cx, 260]}
					text="All Levels Complete!"
					fontSize={14}
					color="#aaaaaa"
					align="center"
				/>
				<Label
					position={[cx, 310]}
					text={`Final Score: ${gameState.score}`}
					fontSize={22}
					color="#ffffff"
					align="center"
				/>
				<Label
					position={[cx, 350]}
					text={`Coins: ${gameState.coins}`}
					fontSize={16}
					color="#ffd54f"
					align="center"
				/>
				<Button
					position={[cx - 70, 440]}
					width={140}
					height={44}
					text="Play Again"
					fontSize={18}
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
