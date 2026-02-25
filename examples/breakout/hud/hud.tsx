import { Label, Layer } from "@quintus/ui";
import { GAME_WIDTH } from "../config.js";
import { gameState } from "../state.js";

export class HUD extends Layer {
	override zIndex = 100;

	private scoreLabel?: Label;
	private levelLabel?: Label;
	private livesLabel?: Label;

	constructor() {
		super();
		this.fixed = true;
	}

	override build() {
		return (
			<>
				<Label
					ref="scoreLabel"
					position={[10, 6]}
					text={`Score: ${gameState.score}`}
					fontSize={14}
					color="#ffffff"
					align="left"
				/>
				<Label
					ref="levelLabel"
					position={[GAME_WIDTH / 2, 6]}
					text={`Level ${gameState.level}`}
					fontSize={14}
					color="#4fc3f7"
					align="center"
				/>
				<Label
					ref="livesLabel"
					position={[GAME_WIDTH - 10, 6]}
					text={`Lives: ${gameState.lives}`}
					fontSize={14}
					color="#ffffff"
					align="right"
				/>
			</>
		);
	}

	override onReady() {
		gameState.on("score").connect(({ value }) => {
			if (this.scoreLabel) this.scoreLabel.text = `Score: ${value}`;
		});

		gameState.on("level").connect(({ value }) => {
			if (this.levelLabel) this.levelLabel.text = `Level ${value}`;
		});

		gameState.on("lives").connect(({ value }) => {
			if (this.livesLabel) this.livesLabel.text = `Lives: ${value}`;
		});
	}
}
