/**
 * Pure/testable copy+transform engine: copy a template tree into a target dir,
 * applying the create-* dotfile renames, rewriting package.json, and marking
 * shipped scripts executable. No prompts, no package-manager, no git — those live
 * in index.ts so this module can be unit-tested into a temp dir.
 */
import {
	chmodSync,
	copyFileSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { rewritePackageJson } from "./package-json.js";

/**
 * Template files renamed on copy. npm strips ONLY `.gitignore`/`.npmrc` from a
 * published tarball, so templates ship them prefixed with `_` and we restore the
 * real dotfile name here. Other dotfiles (`.claude/`, `.qdbg.json`) ship as-is.
 */
const RENAMES: Record<string, string> = {
	_gitignore: ".gitignore",
	_npmrc: ".npmrc",
};

export interface ScaffoldOptions {
	/** Absolute path to the chosen template dir (e.g. `.../templates/2d`). */
	templateDir: string;
	/** Absolute path of the project dir to create/populate. */
	targetDir: string;
	/** Project name written into package.json. */
	projectName: string;
	/** Engine version to pin into the `quintus2` dependency. */
	engineVersion: string;
}

/** Recursively copy `src` → `dest`, applying the dotfile renames per basename. */
function copyDir(src: string, dest: string): void {
	mkdirSync(dest, { recursive: true });
	for (const entry of readdirSync(src, { withFileTypes: true })) {
		// Never follow symlinks: templates are author-controlled and ship no
		// symlinks, so a stray one could only leak host content out-of-tree.
		if (entry.isSymbolicLink()) continue;
		const name = RENAMES[entry.name] ?? entry.name;
		const from = join(src, entry.name);
		const to = join(dest, name);
		if (entry.isDirectory()) {
			copyDir(from, to);
		} else {
			copyFileSync(from, to);
		}
	}
}

/**
 * npm normalizes file modes to 0644 on publish, so any shipped script (e.g.
 * `bin/qdbg`) extracts non-executable. Re-mark everything under `bin/` as 0755.
 */
function markBinExecutable(targetDir: string): void {
	const binDir = join(targetDir, "bin");
	if (!existsSync(binDir)) return;
	for (const entry of readdirSync(binDir)) {
		const path = join(binDir, entry);
		if (statSync(path).isFile()) chmodSync(path, 0o755);
	}
}

/** Scaffold a template into `targetDir`: copy, rename dotfiles, rewrite package.json, chmod scripts. */
export function scaffold(opts: ScaffoldOptions): void {
	copyDir(opts.templateDir, opts.targetDir);

	const pkgPath = join(opts.targetDir, "package.json");
	const rewritten = rewritePackageJson(readFileSync(pkgPath, "utf8"), {
		name: opts.projectName,
		engineVersion: opts.engineVersion,
	});
	writeFileSync(pkgPath, rewritten);

	markBinExecutable(opts.targetDir);
}

/**
 * Entries that don't count as "occupying" a target dir — scaffolding into a
 * freshly `git init`-ed dir (or one with a stray OS/editor file) shouldn't force
 * the user to reach for `--force`.
 */
const IGNORE = new Set([".git", ".gitignore", ".DS_Store", ".idea", "LICENSE"]);

/** True if `dir` does not exist or contains only ignorable entries. */
export function isEmptyDir(dir: string): boolean {
	if (!existsSync(dir)) return true;
	return readdirSync(dir).every((entry) => IGNORE.has(entry));
}
