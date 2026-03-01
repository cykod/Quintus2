import { readFileSync } from "node:fs";
import { join } from "node:path";
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
		open: !process.env.DEVCONTAINER,
		host: process.env.DEVCONTAINER ? "0.0.0.0" : undefined,
	},
	plugins: [
		{
			// Serve Tiled tileset .tsx files (XML) as plain text instead of
			// transforming them as TypeScript JSX. Tiled uses .tsx for its
			// external tileset format, which collides with TypeScript's .tsx.
			name: "serve-tiled-tsx",
			enforce: "pre",
			load(id) {
				if (id.endsWith(".tsx") && id.includes("/assets/")) {
					return `export default ""`;
				}
			},
			configureServer(server) {
				server.middlewares.use((req, res, next) => {
					if (req.url?.endsWith(".tsx") && req.url.includes("/assets/")) {
						const filePath = join(server.config.root, req.url);
						try {
							const content = readFileSync(filePath, "utf-8");
							res.setHeader("Content-Type", "text/xml");
							res.end(content);
						} catch {
							next();
						}
					} else {
						next();
					}
				});
			},
		},
	],
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
