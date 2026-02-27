import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "jsdom",
		globals: true,
		passWithNoTests: true,
		setupFiles: ["vitest-canvas-mock"],
		include: ["packages/*/src/**/*.test.ts"],
		typecheck: {
			enabled: true,
			tsconfig: "./packages/jsx/tsconfig.typetest.json",
			include: ["packages/jsx/src/**/*.test-d.{ts,tsx}"],
		},
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html"],
			include: ["packages/*/src/**/*.ts"],
			exclude: [
				"packages/*/src/**/*.test.ts",
				"packages/*/src/**/*.test-d.ts",
				"packages/*/src/**/*.bench.ts",
				"packages/*/src/index.ts",
				"packages/core/src/draw-context.ts",
				"packages/core/src/renderer.ts",
				"packages/core/src/snapshot-types.ts",
				"packages/jsx/src/jsx-runtime.ts",
				"packages/jsx/src/jsx-dev-runtime.ts",
				"packages/jsx/src/types.ts",
				"packages/physics/src/collision-info.ts",
				"packages/physics/src/query-types.ts",
				"packages/physics/src/snapshot-types.ts",
				"packages/debug/src/**",
				"packages/mcp/src/**",
				"packages/particles/src/**",
				"packages/three/src/**",
				"packages/quintus-core/src/**",
			],
		},
		benchmark: {
			include: ["packages/*/src/**/*.bench.ts"],
		},
	},
});
