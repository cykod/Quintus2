import { definePlugin, type Game, type Plugin } from "@quintus/core";
import { AudioSystem } from "./audio-system.js";
import { AutoplayGate } from "./autoplay-gate.js";

const audioMap = new WeakMap<Game, AudioSystem>();

export function getAudio(game: Game): AudioSystem | null {
	return audioMap.get(game) ?? null;
}

export function AudioPlugin(): Plugin {
	return definePlugin({
		name: "audio",
		install(game: Game) {
			let context: AudioContext | null = null;
			try {
				context = new AudioContext();
			} catch {
				// Headless or unsupported environment
			}

			const system = new AudioSystem(context, game.assets);
			audioMap.set(game, system);

			// Autoplay gate (browser only)
			if (context && typeof document !== "undefined") {
				const gate = new AutoplayGate(context, game.canvas);
				system._setGate(gate);
			}

			// Register audio asset loader
			if (context) {
				game.assets.registerLoader("audio", async (_name, path) => {
					const response = await fetch(path);
					const buffer = await response.arrayBuffer();
					return await (context as AudioContext).decodeAudioData(buffer);
				});
			} else {
				game.assets.registerLoader("audio", async () => null);
			}

			// Cleanup on game stop
			game.stopped.connect(() => {
				system.stopAll();
				context?.close();
				audioMap.delete(game);
			});
		},
	});
}
