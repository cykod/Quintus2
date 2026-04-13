import { cpSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

const pkg = (name: string) =>
	fileURLToPath(new URL(`../packages/${name}/src/index.ts`, import.meta.url));

const subpath = (name: string, path: string) =>
	fileURLToPath(new URL(`../packages/${name}/src/${path}.ts`, import.meta.url));

// Discover all example directories that contain an index.html
const examplesDir = fileURLToPath(new URL(".", import.meta.url));
const SKIP_DIRS = new Set(["node_modules", "dist", "__tests__"]);

function discoverExamples(): Record<string, string> {
	const input: Record<string, string> = {
		main: resolve(examplesDir, "index.html"),
	};
	for (const entry of readdirSync(examplesDir)) {
		if (SKIP_DIRS.has(entry)) continue;
		const dir = join(examplesDir, entry);
		try {
			if (!statSync(dir).isDirectory()) continue;
			statSync(join(dir, "index.html"));
			input[entry] = join(dir, "index.html");
		} catch {
			// Not a directory or no index.html — skip
		}
	}
	return input;
}

export default defineConfig({
	root: ".",
	base: process.env.QUINTUS_BASE || "/",
	server: {
		port: 3050,
		open: !process.env.DEVCONTAINER,
		host: process.env.DEVCONTAINER ? "0.0.0.0" : undefined,
	},
	build: {
		outDir: "dist",
		rollupOptions: {
			input: discoverExamples(),
		},
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
		{
			// Copy each example's assets/ directory into the build output.
			// Game assets are loaded at runtime via fetch() and are invisible
			// to Vite's module graph, so they must be copied explicitly.
			name: "copy-example-assets",
			apply: "build",
			writeBundle(options) {
				const outDir = options.dir || join(examplesDir, "dist");
				const examples = discoverExamples();
				for (const [name] of Object.entries(examples)) {
					if (name === "main") continue;
					const assetsDir = join(examplesDir, name, "assets");
					if (existsSync(assetsDir)) {
						const destDir = join(outDir, name, "assets");
						cpSync(assetsDir, destDir, { recursive: true });
					}
				}
				// Write .nojekyll to prevent GitHub Pages from running Jekyll
				writeFileSync(join(outDir, ".nojekyll"), "");
			},
		},
	],
	resolve: {
		alias: {
			"@quintus/jsx/jsx-runtime": subpath("jsx", "jsx-runtime"),
			"@quintus/jsx/jsx-dev-runtime": subpath("jsx", "jsx-dev-runtime"),
			"@quintus/jsx": pkg("jsx"),
			"@quintus/tilemap/physics": subpath("tilemap", "physics"),
			"@quintus/particles/three": subpath("particles", "three"),
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
			"@quintus/prefabs": pkg("prefabs"),
			"@quintus/quintus-core": pkg("quintus-core"),
		},
	},
});
