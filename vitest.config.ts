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
			exclude: ["packages/*/src/**/*.test.ts", "packages/*/src/**/*.bench.ts"],
		},
		benchmark: {
			include: ["packages/*/src/**/*.bench.ts"],
		},
	},
});
