#!/usr/bin/env node
/**
 * scripts/release.mjs — lockstep npm release for the Quintus2 monorepo.
 *
 * Flow:
 *   1. Read the target version from the topmost `## [x.y.z]` heading in CHANGELOG.md.
 *   2. Verify it is greater than the currently published version.
 *   3. Verify the working tree is clean EXCEPT for CHANGELOG.md (the release entry)
 *      and ASKS.md (the ask log) — the only paths allowed to be uncommitted.
 *   4. Run the full pre-release gate: install, lint, test, build.
 *   5. Bump EVERY publishable package (skips `"private": true`) to the target version.
 *   6. Commit ("Release vX.Y.Z"), tag (vX.Y.Z).
 *   7. Fan the root LICENSE.md into each publishable package, publish all public
 *      packages (`pnpm -r publish` rewrites `workspace:*` and skips private
 *      packages), remove the copies, then push the commit and tag.
 *
 * Usage:
 *   pnpm release            # interactive — confirms before mutating
 *   pnpm release --yes      # non-interactive (CI / scripted)
 *   pnpm release --dry-run  # run all checks, print the plan, mutate nothing
 *
 * The pure helpers (`parseChangelogVersion`, `semverCmp`) are exported for unit
 * tests; the CLI flow only runs when this file is executed directly.
 */
import { execSync } from "node:child_process";
import {
	copyFileSync,
	existsSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { pathToFileURL } from "node:url";

/**
 * Repo-root paths allowed to be uncommitted when a release starts: the release
 * entry (`CHANGELOG.md`) and the appended ask log (`ASKS.md`). Any other dirty
 * path aborts the release. These get folded into the `Release v<x>` commit.
 */
const ALLOWED_DIRTY = new Set(["CHANGELOG.md", "ASKS.md"]);

/**
 * Parse the target release version from a CHANGELOG.md body: the version in the
 * topmost `## [x.y.z]` heading (an `## [Unreleased]` heading above it is ignored).
 * Returns the version string (e.g. `"0.0.2"`) or `null` if none is found.
 */
export function parseChangelogVersion(changelog) {
	const match = changelog.match(/^##\s*\[?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?)\]?/m);
	return match ? match[1] : null;
}

/** Compare two semver strings. Returns >0 if a>b, <0 if a<b, 0 if equal. */
export function semverCmp(a, b) {
	const core = (v) => v.split("-")[0].split(".").map(Number);
	const [a0, b0] = [core(a), core(b)];
	for (let i = 0; i < 3; i++) {
		if (a0[i] !== b0[i]) return a0[i] - b0[i];
	}
	const preA = a.includes("-");
	const preB = b.includes("-");
	if (preA !== preB) return preA ? -1 : 1; // a release outranks its prereleases
	// Two prereleases sharing a core: lexical compare. This orders numeric tails
	// like `alpha.10` before `alpha.2`, which is not strict semver — but it is
	// intentionally unreachable here: the 0.x line uses no prerelease tagging and
	// the lockstep bump makes the "max across packages" trivial. Tightened only if
	// prerelease tagging is ever adopted.
	return a.localeCompare(b);
}

async function main() {
	const ROOT = process.cwd();
	const DRY = process.argv.includes("--dry-run");
	const YES = process.argv.includes("--yes");

	const fail = (msg) => {
		console.error(`\n✗ ${msg}`);
		process.exit(1);
	};
	const step = (msg) => console.log(`\n→ ${msg}`);
	const sh = (cmd, { capture = false } = {}) => {
		console.log(`  $ ${cmd}`);
		return execSync(cmd, { cwd: ROOT, stdio: capture ? "pipe" : "inherit", encoding: "utf8" });
	};
	const mutate = (cmd) => {
		if (DRY) {
			console.log(`  $ ${cmd}   (dry-run: skipped)`);
			return;
		}
		sh(cmd);
	};

	// --- Guards ----------------------------------------------------------------
	if (!existsSync(join(ROOT, "CHANGELOG.md")) || !existsSync(join(ROOT, "packages"))) {
		fail("Run this from the repo root (CHANGELOG.md and packages/ must exist).");
	}

	// 1. Target version from CHANGELOG.md
	step("Reading target version from CHANGELOG.md");
	const changelog = readFileSync(join(ROOT, "CHANGELOG.md"), "utf8");
	const target = parseChangelogVersion(changelog);
	if (!target) {
		fail("No `## [x.y.z]` version heading found in CHANGELOG.md — add a release entry first.");
	}
	console.log(`  target version: ${target}`);

	// 2. Collect publishable packages and check monotonicity
	const pkgsDir = join(ROOT, "packages");
	const publishable = [];
	for (const dir of readdirSync(pkgsDir)) {
		const path = join(pkgsDir, dir, "package.json");
		if (!existsSync(path)) continue;
		const json = JSON.parse(readFileSync(path, "utf8"));
		if (json.private) continue; // stubs / non-published packages opt out with "private": true
		publishable.push({ dir, path, json });
	}
	if (publishable.length === 0) fail("No publishable packages found under packages/.");
	const current = publishable
		.map((p) => p.json.version)
		.sort(semverCmp)
		.at(-1);
	console.log(`  current published version (max across packages): ${current}`);
	if (semverCmp(target, current) <= 0) {
		fail(`CHANGELOG top version ${target} must be greater than the current version ${current}.`);
	}
	console.log(`  ${publishable.length} package(s) will be published:`);
	for (const p of publishable) console.log(`    - ${p.json.name}`);

	// 3. Working tree clean except for the allowed release-bookkeeping files
	// (CHANGELOG.md — the release entry; ASKS.md — the appended ask log). Each
	// porcelain line is `XY <path>` (a two-char status + space); the path starts
	// at column 3. Do NOT trim the whole blob first — that would eat the leading
	// space of the first line and shift its parse by one column (so a lone dirty
	// `CHANGELOG.md`, the normal release case, would misparse and abort).
	step("Checking working tree");
	const status = sh("git status --porcelain", { capture: true });
	const dirty = status
		.split("\n")
		.map((l) => l.slice(3).trim())
		.filter(Boolean);
	const disallowed = dirty.filter((p) => !ALLOWED_DIRTY.has(p));
	if (disallowed.length) {
		const allowed = [...ALLOWED_DIRTY].join(", ");
		fail(
			`Working tree has uncommitted changes other than ${allowed}:\n    ${disallowed.join("\n    ")}\n  Commit or stash them first — only ${allowed} may be uncommitted.`,
		);
	}

	// 4. Pre-release gate
	step("Running pre-release checks (install, lint, test, build)");
	sh("pnpm install --frozen-lockfile");
	sh("pnpm lint");
	sh("pnpm test");
	sh("pnpm build");

	// Confirmation before any mutation
	if (!DRY && !YES) {
		const rl = createInterface({ input: process.stdin, output: process.stdout });
		const answer = (
			await rl.question(`\nRelease v${target} and publish ${publishable.length} packages? [y/N] `)
		)
			.trim()
			.toLowerCase();
		rl.close();
		if (answer !== "y" && answer !== "yes") fail("Aborted by user.");
	}

	// 5. Bump all publishable package versions
	step(`Bumping ${publishable.length} package(s) to ${target}`);
	for (const p of publishable) {
		p.json.version = target;
		if (!DRY) writeFileSync(p.path, `${JSON.stringify(p.json, null, "\t")}\n`);
		console.log(`  ${p.json.name} → ${target}`);
	}

	// 6. Commit + tag
	step("Committing and tagging");
	mutate("git add -A");
	mutate(`git commit -m "Release v${target}"`);
	mutate(`git tag v${target}`);

	// 7. License fan-out → publish → clean up copies → push.
	// npm only bundles a LICENSE* file that sits in the package's own directory, so
	// copy the root license into each publishable package for the publish, then
	// remove the copies (they are git-ignored and must never be committed).
	const licenseSrc = join(ROOT, "LICENSE.md");
	if (!existsSync(licenseSrc)) fail("Root LICENSE.md not found — cannot fan out license.");
	const licenseDests = publishable.map((p) => join(pkgsDir, p.dir, "LICENSE.md"));
	// Only the copies the fan-out itself creates — the ONLY paths the cleanup removes,
	// so a package that ever ships its own real LICENSE.md is never clobbered or deleted.
	const createdCopies = [];
	// Copy loop lives inside the try so the finally cleanup covers a mid-copy failure.
	try {
		step("Copying LICENSE.md into publishable packages");
		for (const dest of licenseDests) {
			if (DRY) {
				console.log(`  cp LICENSE.md → ${dest}   (dry-run: skipped)`);
				continue;
			}
			if (existsSync(dest)) {
				// A real, pre-existing per-package license — leave it alone.
				console.log(`  · ${dest} already exists — left untouched`);
				continue;
			}
			copyFileSync(licenseSrc, dest);
			createdCopies.push(dest);
			console.log(`  cp LICENSE.md → ${dest}`);
		}

		step("Publishing to npm");
		mutate("pnpm -r publish --access public --no-git-checks");
	} finally {
		step("Removing temporary LICENSE.md copies");
		if (DRY) {
			for (const dest of licenseDests) console.log(`  rm ${dest}   (dry-run: skipped)`);
		} else {
			for (const dest of createdCopies) {
				rmSync(dest, { force: true });
				console.log(`  rm ${dest}`);
			}
		}
	}

	step("Pushing commit and tag");
	mutate("git push --follow-tags");

	console.log(`\n✔ Released v${target}${DRY ? " (dry-run — nothing was changed)" : ""}`);
}

// Run the CLI flow only when executed directly (not when imported by tests).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	await main();
}
