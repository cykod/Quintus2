/**
 * End-to-end packaging smoke test (Phase 7).
 *
 * Proves the whole chain works against *published-shaped* artifacts:
 *   npm pack quintus2  →  scaffold a template  →  point its `quintus2` dep at the
 *   packed tarball  →  npm install  →  build  →  test  →  `tsc --noEmit`.
 *
 * This is the repeatable form of the manual "local-tarball dance" the Phase 4/5/6
 * agents ran by hand. It does REAL `npm install` + `vite build` (network + heavy),
 * so it is deliberately OUT of the default `pnpm test` run: it lives under `e2e/`
 * (not `src/`), so the root vitest config's src-only include glob never picks it
 * up. Run it explicitly with `pnpm test:e2e` (or the CI E2E job).
 *
 * Fidelity choices (see the Phase 7 design notes):
 *   - `quintus2` is installed from an actual `npm pack` tarball — the load-bearing
 *     check (real bundled engine + self-contained `.d.ts`, no `@quintus/*`).
 *   - `create-quintus2` is ALSO packed with `npm pack` and the scaffolder is run
 *     from the EXTRACTED tarball (not the workspace `dist/`). This exercises the
 *     scaffolder's own published shape: that `files:["dist","templates"]` actually
 *     ships every template file, that npm's dotfile handling preserves `.claude/`,
 *     `.qdbg.json`, and the `_gitignore`/`_npmrc` renames, and that the `bin/qdbg`
 *     `0644 → 0755` chmod path runs against a real tarball-normalized mode. The
 *     scaffold-output assertions below hard-fail if any of those regress.
 *
 * The `QUINTUS_E2E_TEMPLATE` env var restricts the run to a single template
 * (`2d` | `3d`) — the CI matrix sets it per job; unset runs both.
 */

import { execFileSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(HERE, "..", "..", "..");
const quintus2Dir = join(repoRoot, "packages", "quintus2");
const createDir = join(repoRoot, "packages", "create-quintus2");

/** Valid templates — the CI matrix only ever sets one of these. */
const VALID_TEMPLATES = ["2d", "3d"] as const;

/** Templates to exercise — restricted by QUINTUS_E2E_TEMPLATE (CI matrix), else both. */
const only = process.env.QUINTUS_E2E_TEMPLATE?.trim();
if (only && !(VALID_TEMPLATES as readonly string[]).includes(only)) {
	throw new Error(
		`QUINTUS_E2E_TEMPLATE="${only}" is invalid — expected one of: ${VALID_TEMPLATES.join(", ")}`,
	);
}
const templates = only ? [only] : [...VALID_TEMPLATES];

/**
 * The scaffolder CLI entry — assigned in `beforeAll` to the `dist/index.js` of an
 * EXTRACTED `create-quintus2` tarball, so the E2E validates the published shape of
 * the scaffolder (its `files`/dotfiles/bin), not the workspace working tree.
 */
let cliEntry: string;

/** Run a command, capturing combined output; throw a readable error on non-zero exit. */
function run(file: string, args: string[], cwd: string): string {
	try {
		return execFileSync(file, args, {
			cwd,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
			env: { ...process.env },
			maxBuffer: 64 * 1024 * 1024,
		});
	} catch (err) {
		const e = err as { stdout?: string; stderr?: string; message?: string };
		const out = `${e.stdout ?? ""}${e.stderr ?? ""}`.trim();
		throw new Error(`\`${file} ${args.join(" ")}\` failed in ${cwd}:\n${out || e.message}`);
	}
}

/** True if any string anywhere in a parsed JSON value contains `needle`. */
function jsonContains(value: unknown, needle: string): boolean {
	if (typeof value === "string") return value.includes(needle);
	if (Array.isArray(value)) return value.some((v) => jsonContains(v, needle));
	if (value && typeof value === "object") {
		return Object.values(value as Record<string, unknown>).some((v) => jsonContains(v, needle));
	}
	return false;
}

let workRoot: string;
let tarball: string;

describe("create-quintus2 E2E: scaffold → install → build → test → tsc", () => {
	beforeAll(() => {
		// The E2E consumes built output; fail with a clear hint rather than a cryptic
		// downstream error if the repo hasn't been built (CI runs `pnpm build` first).
		if (!existsSync(join(quintus2Dir, "dist", "index.js"))) {
			throw new Error("packages/quintus2/dist is missing — run `pnpm build` before the E2E.");
		}
		if (!existsSync(join(createDir, "dist", "index.js"))) {
			throw new Error("create-quintus2 dist is missing — run `pnpm build` before the E2E.");
		}

		workRoot = mkdtempSync(join(tmpdir(), "quintus2-e2e-"));
		const registry = join(workRoot, "registry");
		mkdirSync(registry, { recursive: true });

		// Pack BOTH published packages. `npm pack ./dir` (leading ./) packs a local
		// folder; a bare `dir` would be misread as a git shorthand spec.
		run("npm", ["pack", "./packages/quintus2", "--pack-destination", registry], repoRoot);
		run("npm", ["pack", "./packages/create-quintus2", "--pack-destination", registry], repoRoot);
		const tgzs = readdirSync(registry).filter((f) => f.endsWith(".tgz"));
		const quintus2Tgz = tgzs.find((f) => f.startsWith("quintus2-"));
		const createTgz = tgzs.find((f) => f.startsWith("create-quintus2-"));
		if (!quintus2Tgz) throw new Error("npm pack produced no tarball for quintus2");
		if (!createTgz) throw new Error("npm pack produced no tarball for create-quintus2");
		tarball = join(registry, quintus2Tgz);

		// Extract the create-quintus2 tarball and run the scaffolder from it, so the
		// E2E validates the scaffolder's PUBLISHED shape (its `files` field, the
		// specially-handled dotfiles, and the `bin/qdbg` mode) rather than the working
		// tree. `tar` extracts the standard `package/` root.
		const cliRoot = join(workRoot, "cli");
		mkdirSync(cliRoot, { recursive: true });
		run("tar", ["-xzf", join(registry, createTgz), "-C", cliRoot], repoRoot);
		const cliPkgDir = join(cliRoot, "package");
		cliEntry = join(cliPkgDir, "dist", "index.js");
		if (!existsSync(cliEntry)) {
			throw new Error(
				`create-quintus2 tarball did not contain dist/index.js — check its \`files\` field (looked at ${cliEntry})`,
			);
		}
		// Install the scaffolder's own runtime `dependencies` (picocolors, prompts) as a
		// real `npm create quintus2` would — also validates those deps are declared.
		run("npm", ["install", "--omit=dev", "--no-audit", "--no-fund", "--loglevel=error"], cliPkgDir);
	}, 180_000);

	afterAll(() => {
		if (workRoot) rmSync(workRoot, { recursive: true, force: true });
	});

	for (const template of templates) {
		it(`scaffolds, installs from the tarball, builds, tests, and typechecks the ${template} template`, () => {
			const projectDir = join(workRoot, `app-${template}`);

			// 1. Scaffold non-interactively from the built CLI (no install/git here).
			run(
				process.execPath,
				[
					cliEntry,
					projectDir,
					"--template",
					template,
					"--name",
					`e2e-${template}`,
					"--no-install",
					"--no-git",
				],
				repoRoot,
			);

			// 1b. The scaffold must contain the files that only survive if
			//     `create-quintus2`'s `files` field + npm's dotfile handling are correct.
			//     Since the CLI ran from the EXTRACTED tarball, a dropped `templates/`
			//     entry or a stripped dotfile shows up here as a missing scaffold file.
			for (const rel of [
				".claude/skills/debug-game/SKILL.md",
				".qdbg.json",
				".devcontainer/devcontainer.json", // ships as-is (npm doesn't strip .devcontainer)
				"bin/qdbg",
				".gitignore", // renamed from the packed `_gitignore`
				".npmrc", // renamed from the packed `_npmrc`
			]) {
				expect(
					existsSync(join(projectDir, rel)),
					`scaffold is missing ${rel} — a create-quintus2 \`files\`/dotfile regression`,
				).toBe(true);
			}
			// `bin/qdbg` must be re-marked executable (npm normalizes tarball modes to 0644).
			expect((statSync(join(projectDir, "bin", "qdbg")).mode & 0o111) !== 0).toBe(true);

			// 2. Validate the scaffolder's OWN output BEFORE we rewrite anything: it must
			//    reference only `quintus2` for the engine — no `@quintus/`, no `workspace:`.
			const pkgPath = join(projectDir, "package.json");
			const generated = JSON.parse(readFileSync(pkgPath, "utf8")) as {
				dependencies: Record<string, string>;
			};
			expect(generated.dependencies.quintus2).toBeDefined();
			expect(/^\d/.test(generated.dependencies.quintus2)).toBe(true); // plain version, not a path/tag
			expect(jsonContains(generated, "@quintus/")).toBe(false);
			expect(jsonContains(generated, "workspace:")).toBe(false);

			// 3. Repoint the injected `quintus2` dep at the local tarball; keep `three`
			//    (3D) resolving from npm as a real consumer would.
			const pkg = { ...generated };
			pkg.dependencies.quintus2 = `file:${tarball}`;
			writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));

			// 4. Install. `quintus2` comes from the tarball; the private `@quintus/*`
			//    are its devDependencies and are never installed by a consumer.
			run("npm", ["install", "--no-audit", "--no-fund", "--loglevel=error"], projectDir);

			// 5. The installed project must reference ONLY `quintus2` for the engine
			//    (backstops the pre-install checks above with the real install result).
			expect(existsSync(join(projectDir, "node_modules", "@quintus"))).toBe(false);
			const installedPkg = JSON.parse(readFileSync(pkgPath, "utf8"));
			expect(jsonContains(installedPkg, "@quintus/")).toBe(false);
			expect(jsonContains(installedPkg, "workspace:")).toBe(false);
			expect(existsSync(join(projectDir, "node_modules", "quintus2", "dist", "index.js"))).toBe(
				true,
			);

			// 6. Build → emits dist/.
			run("npm", ["run", "build"], projectDir);
			expect(existsSync(join(projectDir, "dist"))).toBe(true);

			// 7. The bundled headless smoke test passes.
			run("npm", ["test"], projectDir);

			// 8. Consumer typecheck is clean — hard gate guarding the self-contained
			//    `.d.ts` fix against any future regression.
			run("npx", ["tsc", "--noEmit"], projectDir);
		}, 600_000);
	}
});
