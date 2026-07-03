import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Dedicated config for the slow, network-dependent packaging E2E (Phase 7). Kept
// separate from the root suite so `pnpm test` stays fast and offline. Run with
// `pnpm test:e2e` or the CI E2E job (which sets QUINTUS_E2E_TEMPLATE per matrix leg).
// `root` is pinned to this package (vitest otherwise resolves `include` from the
// invoking cwd, which is the repo root under `pnpm test:e2e`).
export default defineConfig({
	root: dirname(fileURLToPath(import.meta.url)),
	test: {
		include: ["e2e/**/*.test.ts"],
		environment: "node",
		testTimeout: 600_000,
		hookTimeout: 180_000,
		// Real npm installs and builds — run serially, no worker parallelism.
		fileParallelism: false,
	},
});
