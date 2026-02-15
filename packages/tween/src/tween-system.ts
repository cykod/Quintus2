import type { Node } from "@quintus/core";
import { Tween } from "./tween.js";

/** @internal Central manager for all active tweens. */
export class TweenSystem {
	private tweens: Tween[] = [];

	create(target: Node): Tween {
		const tween = new Tween(target, this);
		this.tweens.push(tween);
		return tween;
	}

	update(dt: number): void {
		for (let i = this.tweens.length - 1; i >= 0; i--) {
			const tween = this.tweens[i] as Tween;

			if (tween.isKilled || tween.target.isDestroyed) {
				this.tweens.splice(i, 1);
				continue;
			}

			if (tween.paused) continue;

			tween._tick(dt);

			if (tween.isComplete) {
				this.tweens.splice(i, 1);
			}
		}
	}

	killTweensOf(node: Node): void {
		for (const t of this.tweens) {
			if (t.target === node) t.kill();
		}
	}

	killAll(): void {
		for (const t of this.tweens) t.kill();
		this.tweens.length = 0;
	}
}
