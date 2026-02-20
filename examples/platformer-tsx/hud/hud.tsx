import { Rect } from "@quintus/math";
import { Sprite } from "@quintus/sprites";
import { Label, Layer } from "@quintus/ui";
import { gameState } from "../state.js";

// Heart tile source rects from the 8×8 tileset (15 columns, 1px spacing)
const HEART_FULL = new Rect(108, 72, 8, 8); // tile 132: col 12, row 8
const HEART_EMPTY = new Rect(126, 72, 8, 8); // tile 134: col 14, row 8

export class HUD extends Layer {
	override zIndex = 100;

	private hearts: Sprite[] = [];
	coinLabel!: Label;
	scoreLabel!: Label;

	override build() {
		this.fixed = true;
		this.hearts = Array.from(
			{ length: gameState.maxHealth },
			(_, i) =>
				(
					<Sprite
						texture="tileset"
						sourceRect={i < gameState.health ? HEART_FULL : HEART_EMPTY}
						centered={false}
						position={[4 + i * 10, 4]}
					/>
				) as Sprite,
		);

		return (
			<>
				{this.hearts}
				<Label
					ref="coinLabel"
					position={[8, 16]}
					text={`Coins: ${gameState.coins}`}
					fontSize={8}
					color="#ffd54f"
				/>
				<Label
					ref="scoreLabel"
					position={[250, 4]}
					text={`Score: ${gameState.score}`}
					fontSize={8}
					color="#ffffff"
					align="right"
				/>
			</>
		);
	}

	override onReady() {
		// Signal-driven updates (no polling)
		gameState.on("health").connect(({ value }) => {
			for (let i = 0; i < this.hearts.length; i++) {
				(this.hearts[i] as Sprite).sourceRect = i < value ? HEART_FULL : HEART_EMPTY;
			}
		});

		gameState.on("coins").connect(({ value }) => {
			this.coinLabel.text = `Coins: ${value}`;
		});

		gameState.on("score").connect(({ value }) => {
			this.scoreLabel.text = `Score: ${value}`;
		});
	}
}
