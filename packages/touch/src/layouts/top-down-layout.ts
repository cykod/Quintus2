import type { Game, Node2D } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import type { TouchLayoutFactory } from "../touch-plugin.js";
import { VirtualButton } from "../virtual-button.js";
import { VirtualJoystick } from "../virtual-joystick.js";

export interface TopDownLayoutConfig {
	/** Action buttons on the lower-right. Default: [{ action: "fire", label: "A" }] */
	actions?: Array<{ action: string; label: string }>;
}

/**
 * Top-down game layout: analog joystick on the lower-left for 4-way movement,
 * configurable action buttons on the lower-right.
 *
 * Used by: Dungeon, Space Shooter
 */
export function topDownLayout(config?: TopDownLayoutConfig): TouchLayoutFactory {
	return (game: Game) => ({
		createControls(_game: Game) {
			const w = game.width;
			const h = game.height;
			const unit = Math.min(w, h);
			const margin = 12;
			const stickR = unit * 0.1;
			const btnR = unit * 0.07;

			const actions = config?.actions ?? [{ action: "fire", label: "A" }];

			const controls: Node2D[] = [
				new VirtualJoystick({
					position: new Vec2(margin + stickR, h - margin - stickR),
					radius: stickR,
					actions: {
						left: "move_left",
						right: "move_right",
						up: "move_up",
						down: "move_down",
					},
				}),
			];

			// Position action buttons in a grid on the lower-right
			if (actions.length <= 2) {
				// Single row
				for (const [i, btn] of actions.entries()) {
					controls.push(
						new VirtualButton({
							position: new Vec2(w - margin - btnR - i * (btnR * 2.5), h - margin - btnR),
							radius: btnR,
							action: btn.action,
							label: btn.label,
						}),
					);
				}
			} else {
				// 2x2 grid for 3-4 buttons
				const positions = [
					new Vec2(w - margin - btnR, h - margin - btnR), // bottom-right
					new Vec2(w - margin - btnR * 3.5, h - margin - btnR), // bottom-left
					new Vec2(w - margin - btnR, h - margin - btnR * 3.5), // top-right
					new Vec2(w - margin - btnR * 3.5, h - margin - btnR * 3.5), // top-left
				];
				for (const [i, btn] of actions.slice(0, 4).entries()) {
					const pos = positions[i];
					if (!pos) continue;
					controls.push(
						new VirtualButton({
							position: pos,
							radius: btnR,
							action: btn.action,
							label: btn.label,
						}),
					);
				}
			}

			return controls;
		},
	});
}
