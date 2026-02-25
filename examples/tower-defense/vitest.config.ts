import { defineConfig } from "vitest/config";

export default defineConfig({
	esbuild: {
		jsx: "automatic",
		jsxImportSource: "@quintus/jsx",
	},
	server: {
		fs: {
			strict: false,
		},
	},
	test: {
		environment: "jsdom",
		globals: true,
		setupFiles: ["vitest-canvas-mock"],
		include: ["examples/tower-defense/__tests__/**/*.test.ts"],
	},
});
