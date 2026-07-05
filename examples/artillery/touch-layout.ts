import type { Game } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import { type TouchLayoutFactory, VirtualButton } from "@quintus/touch";

/**
 * Mobile touch controls for Artillery: two aim buttons on the lower-left
 * (◀ raises the barrel, ▶ lowers it — matching the Left / Right keys) and a
 * large FIRE button on the lower-right.
 *
 * `VirtualButton` holds its bound action while pressed and releases it on lift,
 * so holding FIRE charges muzzle power and releasing launches the shell — the
 * same hold-to-charge mechanic as the Space key, no extra wiring needed.
 */
export function artilleryLayout(): TouchLayoutFactory {
	return (game: Game) => ({
		createControls(_game: Game) {
			const w = game.width;
			const h = game.height;
			const margin = 14;
			const btnR = Math.min(w, h) * 0.09;
			return [
				new VirtualButton({
					position: new Vec2(margin + btnR, h - margin - btnR),
					radius: btnR,
					action: "aim_raise",
					icon: "◀",
				}),
				new VirtualButton({
					position: new Vec2(margin + btnR * 3.3, h - margin - btnR),
					radius: btnR,
					action: "aim_lower",
					icon: "▶",
				}),
				new VirtualButton({
					position: new Vec2(w - margin - btnR * 1.4, h - margin - btnR * 1.4),
					radius: btnR * 1.4,
					action: "fire",
					label: "FIRE",
				}),
			];
		},
	});
}
