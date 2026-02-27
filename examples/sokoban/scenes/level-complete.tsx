import { Scene } from "@quintus/core";
import { Button, Label, Layer, Panel } from "@quintus/ui";
import { GAME_HEIGHT, GAME_WIDTH } from "../config.js";
import { LEVELS } from "../levels.js";
import { gameState } from "../state.js";

export class LevelCompleteScene extends Scene {
	override build() {
		const cx = GAME_WIDTH / 2;
		const hasNext = gameState.currentLevel + 1 < LEVELS.length;

		return (
			<Layer fixed>
				<Panel width={GAME_WIDTH} height={GAME_HEIGHT} backgroundColor="#3b2d1f" />
				<Label
					position={[cx, 200]}
					text="Level Complete!"
					fontSize={32}
					color="#e8c170"
					align="center"
				/>
				<Label
					position={[cx, 260]}
					text={`Moves: ${gameState.moves}`}
					fontSize={18}
					color="#ffffff"
					align="center"
				/>
				{hasNext ? (
					<Button
						position={[cx - 60, 340]}
						width={120}
						height={40}
						text="Next Level"
						fontSize={18}
						backgroundColor="#e8c170"
						hoverColor="#f0d090"
						pressedColor="#c0a050"
						textColor="#3b2d1f"
						onPressed={() => {
							this.game.audio.play("click", { bus: "ui" });
							gameState.currentLevel++;
							this.switchTo("level");
						}}
					/>
				) : null}
				<Button
					position={[cx - 60, hasNext ? 400 : 340]}
					width={120}
					height={40}
					text="Level Select"
					fontSize={16}
					backgroundColor="#5a4a3a"
					hoverColor="#6b5a4a"
					pressedColor="#4a3a2a"
					textColor="#e8c170"
					onPressed={() => {
						this.game.audio.play("click", { bus: "ui" });
						this.switchTo("level-select");
					}}
				/>
			</Layer>
		);
	}

	override onFixedUpdate(_dt: number) {
		if (this.game.input.isJustPressed("ui_confirm")) {
			this.game.audio.play("click", { bus: "ui" });
			const hasNext = gameState.currentLevel + 1 < LEVELS.length;
			if (hasNext) {
				gameState.currentLevel++;
				this.switchTo("level");
			} else {
				this.switchTo("level-select");
			}
		}
	}
}
