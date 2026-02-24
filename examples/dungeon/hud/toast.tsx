import type { Node2D } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import { Ease } from "@quintus/tween";
import { Label, Layer, Panel } from "@quintus/ui";

/**
 * Self-managing toast notification.
 * Fades in (0.3s) → holds (2s) → fades out (0.5s) → destroys itself.
 */
class Toast extends Layer {
	override zIndex = 200;
	message = "";

	constructor() {
		super();
		this.fixed = true;
	}

	override build() {
		return (
			<>
				<Panel position={[-60, -6]} size={new Vec2(120, 14)} backgroundColor="#000000cc" />
				<Label text={this.message} fontSize={7} color="#ffffff" align="center" baseline="middle" />
			</>
		);
	}

	override onReady() {
		// Start invisible, fade in
		this.alpha = 0;
		this.tween()
			.to({ alpha: 1 }, 0.3, Ease.quadOut)
			.onComplete(() => {
				// Hold for 2s, then fade out
				this.after(2, () => {
					this.tween()
						.to({ alpha: 0 }, 0.5, Ease.quadIn)
						.onComplete(() => this.destroy());
				});
			});
	}
}

/** Show a toast message centered near the bottom of the 320×240 canvas. */
export function showToast(parent: Node2D, message: string): void {
	const toast = parent.add(Toast, { message });
	toast.position.x = 160;
	toast.position.y = 200;
}
