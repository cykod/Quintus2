import type { Game } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import { TouchFollowZone } from "../touch-follow-zone.js";
import type { TouchLayoutFactory } from "../touch-plugin.js";
import { VirtualButton } from "../virtual-button.js";

export interface BreakoutLayoutConfig {
	/** Action for moving left. Default: "left" */
	leftAction?: string;
	/** Action for moving right. Default: "right" */
	rightAction?: string;
	/** Action for launching the ball. Default: "launch" */
	launchAction?: string;
	/** Fixed Y for the touch-follow zone mouse position. If undefined, uses touch Y. */
	followY?: number;
}

/**
 * Breakout-style layout: left/right buttons + launch button at bottom,
 * with a full-screen TouchFollowZone behind them for paddle tracking.
 *
 * The TouchFollowZone is always last so discrete buttons get hit-test priority.
 *
 * Used by: Breakout
 */
export function breakoutLayout(config?: BreakoutLayoutConfig): TouchLayoutFactory {
	return (game: Game) => ({
		createControls(_game: Game) {
			const w = game.width;
			const h = game.height;
			const unit = Math.min(w, h);
			const margin = 12;
			const btnR = unit * 0.08;

			const leftAction = config?.leftAction ?? "left";
			const rightAction = config?.rightAction ?? "right";
			const launchAction = config?.launchAction ?? "launch";

			return [
				new VirtualButton({
					position: new Vec2(margin + btnR, h - margin - btnR),
					radius: btnR,
					action: leftAction,
					label: "<",
				}),
				new VirtualButton({
					position: new Vec2(w - margin - btnR, h - margin - btnR),
					radius: btnR,
					action: rightAction,
					label: ">",
				}),
				new VirtualButton({
					position: new Vec2(w / 2, h - margin - btnR),
					radius: btnR,
					action: launchAction,
					label: "Launch",
				}),
				// TouchFollowZone must be last for hit-test priority
				new TouchFollowZone({ followY: config?.followY }),
			];
		},
	});
}
