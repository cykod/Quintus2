import type { Game } from "@quintus/core";
import { definePlugin, type Plugin } from "@quintus/core";

const systemMap = new WeakMap<Game, true>();

/** Check if the particle plugin is installed on a game instance */
export function getParticleSystem(game: Game): boolean {
	return systemMap.has(game);
}

/**
 * Register particle system with the game.
 * Lightweight — emitters self-update via onFixedUpdate, no central system needed.
 * Provides game.emitParticles() convenience.
 */
export function ParticlePlugin(): Plugin {
	return definePlugin({
		name: "particles",
		install(game: Game) {
			systemMap.set(game, true);
			game.stopped.connect(() => {
				systemMap.delete(game);
			});
		},
	});
}
