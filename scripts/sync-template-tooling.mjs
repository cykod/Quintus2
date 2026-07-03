#!/usr/bin/env node
// Sync the monorepo's vendored debug tooling into both scaffold templates.
//
// The templates published by `create-quintus2` must be self-contained (no
// `workspace:*`, no source aliases — see PACKAGING_DESIGN D3), so they carry a
// real, byte-for-byte copy of the monorepo `bin/qdbg` and the debug-game skill's
// `references/**`. Those copies have a single source of truth in the monorepo;
// this script re-derives them so a future edit to the source can't leave the
// template copies stale. `scripts/sync-template-tooling.test.mjs` fails CI if
// they ever drift out of sync.
//
// NOTE: the skill's SKILL.md is intentionally NOT synced — the template copy is
// *adapted* for a single-page scaffold (no-arg `qdbg connect`, scaffold-correct
// `allowed-tools`) and is expected to diverge from the monorepo SKILL.md.
//
// Dependency-free ESM. Run: `pnpm sync:templates` (or `node scripts/sync-template-tooling.mjs`).
import { chmodSync, copyFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

/** Templates that receive the vendored tooling. */
const TEMPLATES = ["2d", "3d"].map((t) =>
	join(repoRoot, "packages", "create-quintus2", "templates", t),
);

const QDBG_SRC = join(repoRoot, "bin", "qdbg");
const REFERENCES_SRC = join(repoRoot, ".claude", "skills", "debug-game", "references");
const SKILL_REL = join(".claude", "skills", "debug-game");

/** Recursively copy a directory tree (files + subdirs), skipping symlinks. */
function copyDir(src, dest) {
	mkdirSync(dest, { recursive: true });
	for (const entry of readdirSync(src, { withFileTypes: true })) {
		if (entry.isSymbolicLink()) continue;
		const from = join(src, entry.name);
		const to = join(dest, entry.name);
		if (entry.isDirectory()) copyDir(from, to);
		else if (entry.isFile()) copyFileSync(from, to);
	}
}

/** Sync the tooling into one template dir; returns the list of relative paths written. */
function syncTemplate(templateDir) {
	const written = [];

	// bin/qdbg — copy and preserve the 0755 exec bit from the source.
	const qdbgDest = join(templateDir, "bin", "qdbg");
	mkdirSync(dirname(qdbgDest), { recursive: true });
	copyFileSync(QDBG_SRC, qdbgDest);
	chmodSync(qdbgDest, statSync(QDBG_SRC).mode & 0o777);
	written.push(relative(repoRoot, qdbgDest));

	// skill references/** (NOT SKILL.md — that copy is intentionally adapted).
	const refDest = join(templateDir, SKILL_REL, "references");
	copyDir(REFERENCES_SRC, refDest);
	written.push(`${relative(repoRoot, refDest)}/**`);

	return written;
}

export function syncTemplateTooling() {
	const all = [];
	for (const templateDir of TEMPLATES) all.push(...syncTemplate(templateDir));
	return all;
}

// Run when invoked directly (not when imported by the drift-guard test).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const written = syncTemplateTooling();
	console.log(`Synced template tooling (${written.length} targets):`);
	for (const p of written) console.log(`  ${p}`);
}
