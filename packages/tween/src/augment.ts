import { Node } from "@quintus/core";
import type { Tween } from "./tween.js";
import { getTweenSystem } from "./tween-plugin.js";

Object.defineProperty(Node.prototype, "tween", {
	value: function (this: Node): Tween {
		const game = this.game;
		if (!game) {
			throw new Error("Cannot create tween: node is not in a scene tree.");
		}
		const system = getTweenSystem(game);
		if (!system) {
			throw new Error(
				"TweenPlugin not installed. Call game.use(TweenPlugin()) before using node.tween().",
			);
		}
		return system.create(this);
	},
	configurable: true,
	writable: true,
});

Object.defineProperty(Node.prototype, "killTweens", {
	value: function (this: Node): void {
		const game = this.game;
		if (!game) return;
		const system = getTweenSystem(game);
		system?.killTweensOf(this);
	},
	configurable: true,
	writable: true,
});

declare module "@quintus/core" {
	interface Node {
		tween(): Tween;
		killTweens(): void;
	}
}
