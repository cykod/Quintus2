import { defineConfig } from "vitest/config";

// jsdom so the headless smoke test can create a canvas stub; esbuild JSX so the
// test can import the `.tsx` entities/scenes.
export default defineConfig({
	esbuild: {
		jsx: "automatic",
		jsxImportSource: "quintus2",
	},
	test: {
		environment: "jsdom",
		globals: true,
		include: ["src/**/*.test.ts"],
	},
});
