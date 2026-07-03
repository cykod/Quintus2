import { defineConfig } from "vitest/config";

// jsdom so the headless scene test can create Three.js objects (geometry, materials,
// lights, cameras). Note: the WebGL renderer needs a real GL context, which jsdom lacks —
// the scene test therefore exercises the scene graph and update loop without ThreePlugin.
export default defineConfig({
	test: {
		environment: "jsdom",
		globals: true,
		include: ["src/**/*.test.ts"],
	},
});
