// Drift guard for the vendored debug tooling shipped in both scaffold templates.
//
// The monorepo `bin/qdbg` and the debug-game skill's `references/**` are the single
// source of truth; `scripts/sync-template-tooling.mjs` copies them into
// `templates/{2d,3d}`. This test asserts the template copies are byte-identical to
// the source, so a future edit that forgets to re-run the sync fails CI loudly.
//
// SKILL.md is deliberately excluded: the template copy is *adapted* for a single-page
// scaffold (no-arg `qdbg connect`, scaffold-correct `allowed-tools`) and is expected
// to diverge from the monorepo SKILL.md.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Vitest runs with the repo root as cwd (root vitest.config.ts owns this suite).
const repoRoot = process.cwd();
const templatesRoot = join(repoRoot, "packages", "create-quintus2", "templates");
const TEMPLATES = ["2d", "3d"];
const SKILL_REL = join(".claude", "skills", "debug-game");

/** Collect relative file paths under a directory tree (files only, sorted). */
function walk(dir, base = dir) {
	const out = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (entry.isSymbolicLink()) continue;
		const full = join(dir, entry.name);
		if (entry.isDirectory()) out.push(...walk(full, base));
		else if (entry.isFile()) out.push(full.slice(base.length + 1));
	}
	return out.sort();
}

describe("template tooling is in sync with the monorepo source", () => {
	for (const template of TEMPLATES) {
		const templateDir = join(templatesRoot, template);

		it(`${template}: bin/qdbg is byte-identical to the monorepo bin/qdbg`, () => {
			const source = readFileSync(join(repoRoot, "bin", "qdbg"));
			const copy = readFileSync(join(templateDir, "bin", "qdbg"));
			expect(copy.equals(source)).toBe(true);
		});

		it(`${template}: skill references/** are byte-identical to the monorepo skill`, () => {
			const sourceRefs = join(repoRoot, SKILL_REL, "references");
			const copyRefs = join(templateDir, SKILL_REL, "references");

			// Same set of reference files (no additions/omissions).
			expect(walk(copyRefs)).toEqual(walk(sourceRefs));

			for (const rel of walk(sourceRefs)) {
				const source = readFileSync(join(sourceRefs, rel));
				const copy = readFileSync(join(copyRefs, rel));
				expect(copy.equals(source), `references/${rel} drifted`).toBe(true);
			}
		});
	}
});
