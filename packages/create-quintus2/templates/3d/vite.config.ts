import { defineConfig } from "vite";

// Single-page 3D game project. `quintus2` and `three` resolve from node_modules
// (no source aliases). ThreePlugin creates the WebGL canvas at runtime.
export default defineConfig({
	server: {
		port: 3050,
		// Listen on all interfaces so the dev server is reachable from a container/WSL host.
		// This also exposes it to your LAN — set to false (localhost-only) on untrusted networks.
		host: true,
	},
});
