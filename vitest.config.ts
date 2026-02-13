import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "jsdom",
		globals: true,
		passWithNoTests: true,
		include: ["packages/*/src/**/*.test.ts"],
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
