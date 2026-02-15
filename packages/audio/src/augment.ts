import { Game } from "@quintus/core";
import { getAudio } from "./audio-plugin.js";
import type { AudioSystem } from "./audio-system.js";

Object.defineProperty(Game.prototype, "audio", {
	get(this: Game): AudioSystem {
		const audio = getAudio(this);
		if (!audio) {
			throw new Error(
				"AudioPlugin not installed. Call game.use(AudioPlugin()) before accessing game.audio.",
			);
		}
		return audio;
	},
	configurable: true,
});

declare module "@quintus/core" {
	interface Game {
		get audio(): AudioSystem;
	}
}
