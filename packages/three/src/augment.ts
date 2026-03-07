import { Game } from "@quintus/core";
import type { ThreeContext } from "./three-context.js";
import { getThreeContext } from "./three-plugin.js";

Object.defineProperty(Game.prototype, "three", {
	get(this: Game): ThreeContext {
		const ctx = getThreeContext(this);
		if (!ctx) {
			throw new Error(
				"ThreePlugin not installed. Call game.use(ThreePlugin()) before accessing game.three.",
			);
		}
		return ctx;
	},
	configurable: true,
});

declare module "@quintus/core" {
	interface Game {
		/** Three.js context. Requires ThreePlugin to be installed. */
		get three(): ThreeContext;
	}
}
