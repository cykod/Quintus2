import { Button, Label, Layer } from "@quintus/ui";
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
				<Button
					position={[10, 600]}
					width={70}
					height={30}
					text="Undo"
					fontSize={12}
					backgroundColor="#5a4a3a"
					hoverColor="#6b5a4a"
					pressedColor="#4a3a2a"
					textColor="#e8c170"
					onPressed={() => {
						this.game.input.inject("undo", true);
						this.after(1 / 60, () => this.game.input.inject("undo", false));
					}}
				/>
				<Button
					position={[90, 600]}
					width={70}
					height={30}
					text="Reset"
					fontSize={12}
					backgroundColor="#5a4a3a"
					hoverColor="#6b5a4a"
					pressedColor="#4a3a2a"
					textColor="#e8c170"
					onPressed={() => {
						this.game.input.inject("reset", true);
						this.after(1 / 60, () => this.game.input.inject("reset", false));
					}}
				/>
				<Button
					position={[GAME_WIDTH - 80, 600]}
					width={70}
					height={30}
					text="Menu"
					fontSize={12}
					backgroundColor="#5a4a3a"
					hoverColor="#6b5a4a"
					pressedColor="#4a3a2a"
					textColor="#e8c170"
					onPressed={() => {
						this.game.currentScene?.switchTo("level-select");
					}}
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
