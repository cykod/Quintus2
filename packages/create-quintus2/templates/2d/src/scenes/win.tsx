import { Label, Layer, Scene } from "quintus2";
import { GAME_HEIGHT, GAME_WIDTH } from "../config.js";
import { gameState } from "../state.js";

/** Shown after all coins are collected. Centered "You Win!" plus the final score. */
export class WinScene extends Scene {
	override build() {
		const cx = GAME_WIDTH / 2;
		return (
			<Layer>
				<Label
					position={[cx, GAME_HEIGHT / 2 - 40]}
					text="You Win!"
					fontSize={48}
					color="#ffd447"
					align="center"
				/>
				<Label
					position={[cx, GAME_HEIGHT / 2 + 20]}
					text={`Score: ${gameState.score}`}
					fontSize={20}
					color="#ffffff"
					align="center"
				/>
				<Label
					position={[cx, GAME_HEIGHT / 2 + 56]}
					text="Reload the page to play again"
					fontSize={12}
					color="#a0a0c0"
					align="center"
				/>
			</Layer>
		);
	}
}
