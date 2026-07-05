import { Scene } from "@quintus/core";
import { Label, Layer, Panel } from "@quintus/ui";
import { gameState } from "../state.js";

/**
 * Title screen: shows the game name + controls, waits for `ui_confirm` to start.
 *
 * Resets `gameState` on entry so every new round (including "play again" from the
 * results screen) starts clean — score/ammo/targetsRemaining/wind/angle/power/won
 * all restored to their defaults. `gameState` is a module singleton, so without
 * this reset a second round would inherit the previous round's values.
 */
export class TitleScene extends Scene {
	override build() {
		const cx = this.game.width / 2;
		const cy = this.game.height / 2;
		return (
			<Layer fixed>
				<Panel width={this.game.width} height={this.game.height} backgroundColor="#0e2a3d" />
				<Label
					position={[cx, cy - 150]}
					text="ARTILLERY"
					fontSize={44}
					color="#ffd166"
					align="center"
				/>
				<Label
					position={[cx, cy - 100]}
					text="Destructible-Terrain Demo — Quintus 2.0"
					fontSize={12}
					color="#88a0b0"
					align="center"
				/>
				<Label
					position={[cx, cy - 30]}
					text="Left / Right  —  aim angle"
					fontSize={13}
					color="#cfe3ef"
					align="center"
				/>
				<Label
					position={[cx, cy]}
					text="Hold Space  —  charge power, release to fire"
					fontSize={13}
					color="#cfe3ef"
					align="center"
				/>
				<Label
					position={[cx, cy + 30]}
					text="Longer hold = stronger shot  (mind the wind!)"
					fontSize={13}
					color="#cfe3ef"
					align="center"
				/>
				<Label
					position={[cx, cy + 110]}
					text="Press Enter or tap to start"
					fontSize={18}
					color="#4fc3f7"
					align="center"
				/>
			</Layer>
		);
	}

	override onReady(): void {
		gameState.reset();
	}

	override onFixedUpdate(_dt: number): void {
		if (this.game.input.isJustPressed("ui_confirm")) {
			this.switchTo("game");
		}
	}
}
