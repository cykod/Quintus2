import { Game } from "@quintus/core";
import type { Input } from "./input.js";
import { getInput } from "./input-plugin.js";

// Runtime: add getter to Game.prototype
Object.defineProperty(Game.prototype, "input", {
	get(this: Game): Input {
		const input = getInput(this);
		if (!input) {
			throw new Error(
				"InputPlugin not installed. Call game.use(InputPlugin({...})) before accessing game.input.",
			);
		}
		return input;
	},
	configurable: true,
});

// TypeScript: merge Input accessor into Game's type
declare module "@quintus/core" {
	interface Game {
		/** Input system. Requires InputPlugin to be installed. */
		get input(): Input;
	}
}
