import { defineConfig } from "tsup";

export default defineConfig({
	entry: {
		index: "src/index.ts",
		"jsx-runtime": "src/jsx-runtime.ts",
		"jsx-dev-runtime": "src/jsx-dev-runtime.ts",
		three: "src/three.ts",
		testing: "src/testing.ts",
	},
	format: ["esm", "cjs"],
	// Declarations are produced by `scripts/build-dts.mjs` (a dts-bundle-generator pass),
	// NOT by tsup. tsup's `dts: true` emits `export * from "@quintus/core"` for every entry,
	// which doesn't resolve for consumers (the private @quintus/* packages aren't installed).
	// See scripts/build-dts.mjs for the rationale. The build script runs tsup then the bundler.
	dts: false,
	clean: true,
	sourcemap: true,
	treeshake: true,
	// Enable code splitting so the inlined `@quintus/core` (and every other shared
	// internal) is extracted into ONE common chunk shared by all entries, rather than
	// each entry inlining its own private copy. This is load-bearing: `quintus2` exposes
	// core classes from `.` and `HeadlessGame` from `./testing`, and a game test suite
	// mixes the two. If each entry inlined its own core, `instanceof Node`/`Node2D`
	// checks (transform cascade + JSX build path) would compare against distinct class
	// objects across the boundary and silently fail. A single shared chunk keeps class
	// identity consistent across every subpath.
	//
	// INVARIANT (do not break): the bare side-effect imports below — `@quintus/tilemap/physics`
	// (see src/index.ts) and three's `./augment` — survive esbuild's tree-shaking ONLY
	// because none of the internal @quintus/* packages declare `"sideEffects": false`.
	// If any internal package is ever marked side-effect-free, esbuild becomes free to
	// drop those registration imports from the shared chunk and tile-collision / three
	// wiring will silently stop being emitted. Keep internals side-effect-agnostic.
	splitting: true,
	// Inline every internal @quintus/* workspace package into quintus2's own dist,
	// so the published package has no runtime @quintus/* dependencies.
	noExternal: [/^@quintus\//],
	// Keep three external everywhere — only the `./three` entry references it, and it
	// stays an optional peer dependency (a bare `from "three"` survives in dist/three.*).
	external: ["three", /^three\//],
});
