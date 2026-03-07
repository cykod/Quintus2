import type { Game, Plugin } from "@quintus/core";
import { definePlugin } from "@quintus/core";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { ThreeContext, type ThreePluginConfig } from "./three-context.js";
import { ThreeRenderer } from "./three-renderer.js";

const contextMap = new WeakMap<Game, ThreeContext>();

export function getThreeContext(game: Game): ThreeContext | null {
	return contextMap.get(game) ?? null;
}

export function ThreePlugin(config: ThreePluginConfig = {}): Plugin {
	return definePlugin({
		name: "three",
		install(game: Game) {
			const fullMode = !game.hasRenderer;

			let canvas: HTMLCanvasElement;
			if (fullMode) {
				canvas = game.canvas;
			} else {
				canvas = document.createElement("canvas");
				canvas.width = game.width;
				canvas.height = game.height;
			}

			const ctx = new ThreeContext(canvas, game.width, game.height, config, !fullMode);
			contextMap.set(game, ctx);

			if (fullMode) {
				const renderer = new ThreeRenderer(ctx);
				game._setRenderer(renderer);
			}

			// Register GLTF/GLB asset loaders
			game.assets.registerLoader("gltf", async (_name: string, path: string) => {
				const loader = new GLTFLoader();
				return loader.loadAsync(path);
			});
			game.assets.registerLoader("glb", async (_name: string, path: string) => {
				const loader = new GLTFLoader();
				return loader.loadAsync(path);
			});

			// Clear Three.js scene on scene transitions
			game.sceneSwitched.connect(() => {
				ctx.scene.clear();
				ctx.activeCamera = null;
			});

			// Clean up on game stop
			game.stopped.connect(() => {
				ctx.dispose();
				contextMap.delete(game);
			});
		},
	});
}
