import { Scene } from "@quintus/core";
import { Label, Layer, Panel } from "@quintus/ui";
import { gameState } from "../state.js";

/**
 * End-of-round screen. The outcome is read from `gameState.won` (set by
 * `GameScene.afterShot` before switching here — `switchTo` has no params channel).
 * `ui_confirm` returns to the title, which resets `gameState` for a clean round.
 */
export class ResultsScene extends Scene {
	override build() {
		const cx = this.game.width / 2;
		const cy = this.game.height / 2;
		const won = gameState.won;
		// Three outcomes: cleared the field, blew yourself up, or ran out of ammo.
		const headline = won
			? "Field Cleared!"
			: gameState.selfDestruct
				? "You Blew Yourself Up!"
				: "Out of Ammo";
		return (
			<Layer fixed>
				<Panel width={this.game.width} height={this.game.height} backgroundColor="#0e2a3d" />
				<Label
					position={[cx, cy - 90]}
					text={headline}
					fontSize={38}
					color={won ? "#7bd88f" : "#ef5350"}
					align="center"
				/>
				<Label
					position={[cx, cy - 20]}
					text={`Final Score: ${gameState.score}`}
					fontSize={22}
					color="#ffd166"
					align="center"
				/>
				<Label
					position={[cx, cy + 90]}
					text="Press Enter or tap to play again"
					fontSize={16}
					color="#4fc3f7"
					align="center"
				/>
			</Layer>
		);
	}

	override onFixedUpdate(_dt: number): void {
		if (this.game.input.isJustPressed("ui_confirm")) {
			this.switchTo("title");
		}
	}
}
