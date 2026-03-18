import { Game, type Scene } from "@quintus/core";
import { ThreePlugin } from "../three-plugin.js";

export interface TestGame3DOptions {
	width?: number;
	height?: number;
	SceneClass?: typeof Scene;
}

/**
 * Create a Game with ThreePlugin installed, ready for 3D testing.
 * If SceneClass is provided, starts the game with that scene.
 */
export function createTestGame3D(options: TestGame3DOptions = {}): Game {
	const { width = 800, height = 600, SceneClass } = options;
	const game = new Game({ width, height, renderer: null });
	game.use(ThreePlugin());
	if (SceneClass) {
		game.start(SceneClass);
	}
	return game;
}
