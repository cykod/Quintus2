import { defineConfig } from "vitest/config";

export default defineConfig({
	esbuild: {
		jsx: "automatic",
		jsxImportSource: "@quintus/jsx",
	},
	server: {
		fs: {
			// Disable strict fs check (needed for git worktree symlink resolution)
			strict: false,
		},
	},
	test: {
		environment: "jsdom",
		globals: true,
		setupFiles: ["vitest-canvas-mock"],
		include: ["examples/breakout/__tests__/**/*.test.ts"],
	},
});
