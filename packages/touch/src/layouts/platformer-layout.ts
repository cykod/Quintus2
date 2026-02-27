import type { Game } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import type { TouchLayoutFactory } from "../touch-plugin.js";
import { VirtualButton } from "../virtual-button.js";

export interface PlatformerLayoutConfig {
	/** Action name for the jump button. Default: "jump" */
	jumpAction?: string;
}

/**
 * Platformer-style layout: left/right arrow buttons on the lower-left,
 * a large jump button on the lower-right.
 *
 * Used by: Platformer, Platformer-TSX
 */
export function platformerLayout(config?: PlatformerLayoutConfig): TouchLayoutFactory {
	return (game: Game) => ({
		createControls(_game: Game) {
			const w = game.width;
			const h = game.height;
			const margin = 12;
			const btnR = Math.min(w, h) * 0.08;

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
				new VirtualButton({
					position: new Vec2(w - margin - btnR * 1.5, h - margin - btnR * 1.5),
					radius: btnR * 1.5,
					action: config?.jumpAction ?? "jump",
					label: "A",
				}),
			];
		},
	});
}
