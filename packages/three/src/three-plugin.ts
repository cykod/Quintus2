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

			// Clear stale Three.js objects on scene transitions.
			// Node3D.onExitTree removes objects individually, but this is a
			// safety net for any orphans.  Do NOT null activeCamera here —
			// sceneSwitched fires AFTER the new scene's onReady, so the new
			// Camera3D has already registered itself via onEnterTree.
			game.sceneSwitched.connect(() => {
				ctx.scene.clear();
			});

			// Clean up on game stop
			game.stopped.connect(() => {
				ctx.dispose();
				contextMap.delete(game);
			});
		},
	});
}
