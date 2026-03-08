import type { Game } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import type { TouchLayoutFactory } from "../touch-plugin.js";
import { VirtualButton } from "../virtual-button.js";
import { VirtualJoystick } from "../virtual-joystick.js";

export interface PlatformerLayoutConfig {
	/** Action name for the jump button. Default: "jump" */
	jumpAction?: string;
	/**
	 * When true, use a 4-way joystick instead of left/right buttons.
	 * Enables up/down actions for ladders and climbing. Default: false
	 */
	verticalMovement?: boolean;
}

/**
 * Platformer-style layout: left/right arrow buttons on the lower-left,
 * a large jump button on the lower-right.
 *
 * With `verticalMovement: true`, uses a 4-way joystick instead of
 * discrete buttons, enabling ladder climbing on mobile.
 *
 * Used by: Platformer, Platformer-TSX, Advanced Platformer
 */
export function platformerLayout(config?: PlatformerLayoutConfig): TouchLayoutFactory {
	return (game: Game) => ({
		createControls(_game: Game) {
			const w = game.width;
			const h = game.height;
			const margin = 12;
			const btnR = Math.min(w, h) * 0.08;

			const jumpButton = new VirtualButton({
				position: new Vec2(w - margin - btnR * 1.5, h - margin - btnR * 1.5),
				radius: btnR * 1.5,
				action: config?.jumpAction ?? "jump",
				label: "A",
			});

			if (config?.verticalMovement) {
				const stickR = Math.min(w, h) * 0.1;
				return [
					new VirtualJoystick({
						position: new Vec2(margin + stickR, h - margin - stickR),
						radius: stickR,
						actions: { left: "left", right: "right", up: "up", down: "down" },
					}),
					jumpButton,
				];
			}

			return [
				new VirtualButton({
					position: new Vec2(margin + btnR, h - margin - btnR),
					radius: btnR,
					action: "left",
					label: "<",
				}),
				new VirtualButton({
					position: new Vec2(margin + btnR * 3.5, h - margin - btnR),
					radius: btnR,
					action: "right",
					label: ">",
				}),
				jumpButton,
			];
		},
	});
}
