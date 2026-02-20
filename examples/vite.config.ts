import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

const pkg = (name: string) =>
	fileURLToPath(new URL(`../packages/${name}/src/index.ts`, import.meta.url));

const subpath = (name: string, path: string) =>
	fileURLToPath(new URL(`../packages/${name}/src/${path}.ts`, import.meta.url));

export default defineConfig({
	root: ".",
	server: {
		port: 3050,
		open: true,
	},
	resolve: {
		alias: {
			"@quintus/jsx/jsx-runtime": subpath("jsx", "jsx-runtime"),
			"@quintus/jsx/jsx-dev-runtime": subpath("jsx", "jsx-dev-runtime"),
			"@quintus/jsx": pkg("jsx"),
			"@quintus/tilemap/physics": subpath("tilemap", "physics"),
			"@quintus/core": pkg("core"),
			"@quintus/math": pkg("math"),
			"@quintus/physics": pkg("physics"),
			"@quintus/sprites": pkg("sprites"),
			"@quintus/tilemap": pkg("tilemap"),
			"@quintus/input": pkg("input"),
			"@quintus/audio": pkg("audio"),
			"@quintus/ui": pkg("ui"),
			"@quintus/tween": pkg("tween"),
			"@quintus/camera": pkg("camera"),
			"@quintus/particles": pkg("particles"),
			"@quintus/three": pkg("three"),
			"@quintus/debug": pkg("debug"),
			"@quintus/headless": pkg("headless"),
			"@quintus/test": pkg("test"),
			"@quintus/snapshot": pkg("snapshot"),
			"@quintus/mcp": pkg("mcp"),
			"@quintus/ai-prefabs": pkg("ai-prefabs"),
			"@quintus/quintus-core": pkg("quintus-core"),
		},
	},
});
