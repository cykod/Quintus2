import { defineConfig } from "vite";

// Single-page game project. `quintus2` resolves from node_modules (no source
// aliases), and JSX settings come from tsconfig.json (jsxImportSource: "quintus2").
export default defineConfig({
	server: {
		port: 3050,
		// Listen on all interfaces so the dev server is reachable from a container/WSL host.
		// This also exposes it to your LAN — set to false (localhost-only) on untrusted networks.
		host: true,
	},
});
