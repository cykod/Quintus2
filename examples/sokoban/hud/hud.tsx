import { Label, Layer } from "@quintus/ui";
import { GAME_WIDTH } from "../config.js";
import { gameState } from "../state.js";

export class HUD extends Layer {
	override zIndex = 100;

	private levelLabel?: Label;
	private movesLabel?: Label;

	constructor() {
		super();
		this.fixed = true;
	}

	override build() {
		return (
			<>
				<Label
					ref="levelLabel"
					position={[10, 10]}
					text={`Level: ${gameState.currentLevel + 1}`}
					fontSize={14}
					color="#e8c170"
					align="left"
				/>
				<Label
					ref="movesLabel"
					position={[GAME_WIDTH - 10, 10]}
					text={`Moves: ${gameState.moves}`}
					fontSize={14}
					color="#ffffff"
					align="right"
				/>
			</>
		);
	}

	override onReady() {
		gameState.on("moves").connect(({ value }) => {
			if (this.movesLabel) this.movesLabel.text = `Moves: ${value}`;
		});

		gameState.on("currentLevel").connect(({ value }) => {
			if (this.levelLabel) this.levelLabel.text = `Level: ${value + 1}`;
		});
	}
}
