import type { Game, Node2D } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import type { TouchLayoutFactory } from "../touch-plugin.js";
import { VirtualAimStick } from "../virtual-aim-stick.js";
import { VirtualButton } from "../virtual-button.js";
import { VirtualJoystick } from "../virtual-joystick.js";

export interface DualStickLayoutConfig {
	/** Action to inject when aim stick is active outside dead zone. */
	fireAction?: string;
	/** Node name to aim from (resolved via scene.find()). */
	aimFrom?: string;
	/** Distance from aim node to place the virtual crosshair. Default: 200 */
	aimDistance?: number;
	/** Optional weapon/ability buttons positioned above the move stick. */
	weaponButtons?: Array<{ action: string; label: string }>;
}

/**
 * Dual-stick layout: movement joystick on the lower-left,
 * aim stick on the lower-right, optional weapon buttons above left stick.
 *
 * Used by: Twin-stick shooters
 */
export function dualStickLayout(config?: DualStickLayoutConfig): TouchLayoutFactory {
	return (game: Game) => ({
		createControls(_game: Game) {
			const w = game.width;
			const h = game.height;
			const unit = Math.min(w, h);
			const margin = 12;
			const stickR = unit * 0.1;
			const btnR = unit * 0.06;

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
				new VirtualAimStick({
					position: new Vec2(w - margin - stickR, h - margin - stickR),
					radius: stickR,
					fireAction: config?.fireAction,
					aimFrom: config?.aimFrom,
					aimDistance: config?.aimDistance,
				}),
			];

			// Weapon buttons above the move stick
			const buttons = config?.weaponButtons ?? [];
			for (const [i, btn] of buttons.entries()) {
				controls.push(
					new VirtualButton({
						position: new Vec2(
							margin + btnR + i * (btnR * 2.5),
							h - margin - stickR * 2 - btnR * 1.5,
						),
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
