import { Label, Layer } from "quintus2";
import { gameState } from "../state.js";

/** Screen-fixed overlay. Each Label updates from its own reactive signal (no polling). */
export class HUD extends Layer {
	override zIndex = 100;

	scoreLabel!: Label;
	livesLabel!: Label;

	override build() {
		this.fixed = true;
		return (
			<>
				<Label
					ref="scoreLabel"
					position={[8, 8]}
					text={`Score: ${gameState.score}`}
					fontSize={8}
					color="#ffffff"
				/>
				<Label
					ref="livesLabel"
					position={[8, 20]}
					text={`Lives: ${gameState.lives}`}
					fontSize={8}
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
		gameState.on("lives").connect(({ value }) => {
			this.livesLabel.text = `Lives: ${value}`;
		});
	}
}
