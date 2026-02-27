import type { Game } from "@quintus/core";
import type { Vec2 } from "@quintus/math";
import type { TouchLayoutFactory } from "../touch-plugin.js";
import { VirtualButton } from "../virtual-button.js";

export interface PointClickLayoutConfig {
	/** Optional buttons to create at specified positions. */
	buttons?: Array<{ action: string; label: string; position: Vec2 }>;
}

/**
 * Point-and-click layout: no virtual controls by default.
 * Touch passes through to the game's Input system and UI PointerDispatcher.
 * Optional buttons can be added for toolbar actions.
 *
 * Used by: Tower Defense, Point-and-Click adventures
 */
export function pointClickLayout(config?: PointClickLayoutConfig): TouchLayoutFactory {
	return (_game: Game) => ({
		createControls(_game: Game) {
			const buttons = config?.buttons ?? [];
			return buttons.map(
				(btn) =>
					new VirtualButton({
						position: btn.position,
						action: btn.action,
						label: btn.label,
					}),
			);
		},
	});
}
