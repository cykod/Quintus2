import { Scene } from "@quintus/core";
import { Button, Label, Layer, Panel } from "@quintus/ui";
import { gameState } from "../state.js";

/**
 * Game over screen — shown when player loses all lives.
 */
export class GameOverScene extends Scene {
	override build() {
		const cx = this.game.width / 2;
		return (
			<Layer fixed>
				<Panel width={this.game.width} height={this.game.height} backgroundColor="#1a0a0a" />
				<Label
					position={[cx, 220]}
					text="Game Over"
					fontSize={42}
					color="#ef5350"
					align="center"
					shadow={{ offset: [2, 2], color: "#000000" }}
				/>
				<Label
					position={[cx, 300]}
					text={`Score: ${gameState.score}`}
					fontSize={20}
					color="#ffffff"
					align="center"
				/>
				<Label
					position={[cx, 336]}
					text={`Coins: ${gameState.coins}`}
					fontSize={16}
					color="#ffd54f"
					align="center"
				/>
				<Button
					position={[cx - 70, 420]}
					width={140}
					height={44}
					text="Try Again"
					fontSize={18}
					backgroundColor="#333333"
					hoverColor="#555555"
					pressedColor="#222222"
					textColor="#ffffff"
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
