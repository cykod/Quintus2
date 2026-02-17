import type { Plugin } from "@quintus/core";
import { HeadlessGame, type HeadlessGameOptions } from "./headless-game.js";

export interface CreateHeadlessGameOptions extends HeadlessGameOptions {
	plugins?: Plugin[];
}

/**
 * Create a HeadlessGame with plugins pre-installed.
 *
 * @example
 * const game = createHeadlessGame({
 *   width: 320, height: 240, seed: 42,
 *   plugins: [PhysicsPlugin({ gravity: new Vec2(0, 800) })],
 * });
 */
export function createHeadlessGame(options: CreateHeadlessGameOptions): HeadlessGame {
	const { plugins, ...gameOptions } = options;
	const game = new HeadlessGame(gameOptions);
	if (plugins) {
		for (const plugin of plugins) {
			game.use(plugin);
		}
	}
	return game;
}
