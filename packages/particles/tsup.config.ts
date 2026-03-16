import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/index.ts", "src/three.ts"],
	format: ["esm", "cjs"],
	dts: true,
	clean: true,
	sourcemap: true,
	treeshake: true,
	external: ["three", "@quintus/three"],
});
