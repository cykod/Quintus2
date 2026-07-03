import { Label, Layer } from "quintus2";
import { TOTAL_COINS } from "../config.js";
import { gameState } from "../state.js";

/** Screen-fixed overlay. Each Label updates from its own reactive signal (no polling). */
export class HUD extends Layer {
	override zIndex = 100;

	scoreLabel!: Label;
	livesLabel!: Label;
	coinsLabel!: Label;

	override build() {
		this.fixed = true;
		return (
			<>
				<Label
					ref="scoreLabel"
					position={[12, 12]}
					text={`Score: ${gameState.score}`}
					fontSize={16}
					color="#ffffff"
				/>
				<Label
					ref="coinsLabel"
					position={[12, 34]}
					text={`Coins: ${gameState.coins}/${TOTAL_COINS}`}
					fontSize={16}
					color="#ffd447"
				/>
				<Label
					ref="livesLabel"
					position={[12, 56]}
					text={`Lives: ${gameState.lives}`}
					fontSize={16}
					color="#ffffff"
				/>
			</>
		);
	}

	override onReady() {
		// Same pattern for each field: subscribe to the per-key signal, update the Label.
		gameState.on("score").connect(({ value }) => {
			this.scoreLabel.text = `Score: ${value}`;
		});
		gameState.on("coins").connect(({ value }) => {
			this.coinsLabel.text = `Coins: ${value}/${TOTAL_COINS}`;
		});
		gameState.on("lives").connect(({ value }) => {
			this.livesLabel.text = `Lives: ${value}`;
		});
	}
}
