import type { Game, Node2D } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import type { TouchLayoutFactory } from "../touch-plugin.js";
import { VirtualButton } from "../virtual-button.js";
import { VirtualDPad } from "../virtual-dpad.js";

export interface PuzzleLayoutConfig {
	/** Extra utility buttons on the lower-left (e.g., undo, reset, menu). */
	buttons?: Array<{ action: string; label: string }>;
}

/**
 * Puzzle game layout: 4-way D-pad on the lower-right,
 * optional utility buttons on the lower-left.
 *
 * Used by: Sokoban
 */
export function puzzleLayout(config?: PuzzleLayoutConfig): TouchLayoutFactory {
	return (game: Game) => ({
		createControls(_game: Game) {
			const w = game.width;
			const h = game.height;
			const unit = Math.min(w, h);
			const margin = 12;
			const dpadSize = unit * 0.08;
			const btnR = unit * 0.06;

			const controls: Node2D[] = [
				new VirtualDPad({
					position: new Vec2(w - margin - dpadSize * 1.5, h - margin - dpadSize * 1.5),
					buttonSize: dpadSize,
					actions: {
						left: "move_left",
						right: "move_right",
						up: "move_up",
						down: "move_down",
					},
				}),
			];

			// Utility buttons on the lower-left
			const buttons = config?.buttons ?? [];
			for (const [i, btn] of buttons.entries()) {
				controls.push(
					new VirtualButton({
						position: new Vec2(margin + btnR + i * (btnR * 2.5), h - margin - btnR),
						radius: btnR,
						action: btn.action,
						label: btn.label,
					}),
				);
			}

			return controls;
		},
	});
}
