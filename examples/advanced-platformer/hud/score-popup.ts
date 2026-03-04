import type { Node2D } from "@quintus/core";
import { Color, type Vec2 } from "@quintus/math";
import { Ease } from "@quintus/tween";
import { Label } from "@quintus/ui";

/**
 * Show a floating score/text popup that drifts up and fades out.
 * Spawns a temporary Label node as a child of `parent`.
 */
export function showScorePopup(parent: Node2D, position: Vec2, text: string): void {
	const label = parent.add(Label, {
		text,
		fontSize: 14,
		color: Color.WHITE,
		align: "center" as const,
		baseline: "middle" as const,
		position: position.clone(),
		zIndex: 150,
	});

	label
		.tween()
		.to({ position: { y: position.y - 30 } }, 0.6, Ease.easeOutQuad)
		.parallel()
		.to({ alpha: 0 }, 0.6, Ease.easeInQuad)
		.onComplete(() => label.destroy());
}
