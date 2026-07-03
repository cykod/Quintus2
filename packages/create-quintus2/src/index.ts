#!/usr/bin/env node
/**
 * create-quintus2 — scaffold a runnable Quintus2 game project.
 *
 *   npm create quintus2@latest [dir] [options]
 *
 * Options:
 *   --template 2d|3d        Starter template (default: prompt / 2d)
 *   --name <pkg>            Project package name (default: target dir name)
 *   --pm npm|pnpm|yarn|bun  Package manager (default: detected from invocation)
 *   --no-install            Skip installing dependencies
 *   --no-git               Skip git init + initial commit
 *   --force                Scaffold into a non-empty directory
 *
 * Interactive when run in a TTY with flags omitted; non-interactive when flags are
 * set or `CI` is present (for scripted use and the Phase 7 E2E test).
 */
import { readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pc from "picocolors";
import prompts from "prompts";
import { parseArgs, type Template } from "./args.js";
import { helpText } from "./help.js";
import { detectPackageManager, gitInit, type PackageManager, runInstall } from "./pm.js";
import { isEmptyDir, scaffold } from "./scaffold.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = join(HERE, "..");
const TEMPLATES_DIR = join(PKG_ROOT, "templates");

function die(message: string): never {
	console.error(pc.red(`✗ ${message}`));
	process.exit(1);
}

/** This CLI's own version — the matching engine version (lockstep release, §D1). */
function readOwnVersion(): string {
	const pkg = JSON.parse(readFileSync(join(PKG_ROOT, "package.json"), "utf8")) as {
		version: string;
	};
	return pkg.version;
}

function printHelp(): void {
	console.log(helpText());
}

async function main(): Promise<void> {
	const args = parseArgs(process.argv.slice(2));
	if (args.help) {
		printHelp();
		return;
	}
	const interactive = !process.env.CI && Boolean(process.stdout.isTTY);
	const cancel = () => die("Aborted.");

	// Target directory
	let dir = args.dir;
	if (dir === undefined) {
		if (!interactive) die("A target directory is required (e.g. `create-quintus2 my-game`).");
		const res = await prompts(
			{
				type: "text",
				name: "dir",
				message: "Project directory",
				initial: "my-quintus-game",
			},
			{ onCancel: cancel },
		);
		dir = res.dir as string;
	}
	const targetDir = resolve(process.cwd(), dir);

	// Template
	let template = args.template;
	if (template === undefined) {
		if (interactive) {
			const res = await prompts(
				{
					type: "select",
					name: "template",
					message: "Template",
					choices: [
						{ title: "2D game", value: "2d" },
						{ title: "3D game", value: "3d" },
					],
					initial: 0,
				},
				{ onCancel: cancel },
			);
			template = res.template as Template;
		} else {
			template = "2d";
		}
	}

	// Install / git prompts (only when interactive and not overridden by a flag)
	let install = args.install;
	let git = args.git;
	if (interactive) {
		if (args.install) {
			const res = await prompts(
				{ type: "confirm", name: "install", message: "Install dependencies?", initial: true },
				{ onCancel: cancel },
			);
			install = res.install as boolean;
		}
		if (args.git) {
			const res = await prompts(
				{ type: "confirm", name: "git", message: "Initialize a git repository?", initial: true },
				{ onCancel: cancel },
			);
			git = res.git as boolean;
		}
	}

	// Refuse a non-empty target unless --force
	if (!isEmptyDir(targetDir) && !args.force) {
		die(`Target directory "${dir}" is not empty. Use --force to scaffold into it anyway.`);
	}

	const projectName = args.name ?? basename(targetDir);
	const engineVersion = readOwnVersion();
	const templateDir = join(TEMPLATES_DIR, template);

	console.log(pc.cyan(`\nScaffolding ${pc.bold(template)} project in ${pc.bold(targetDir)}\n`));
	scaffold({ templateDir, targetDir, projectName, engineVersion });

	// The scaffold is on disk now; a failing install/git leaves a usable project,
	// so tell the user it was written and how to finish manually before exiting.
	const pm = args.pm ?? detectPackageManager();
	if (install) {
		console.log(pc.cyan(`Installing dependencies with ${pm}...\n`));
		try {
			runInstall(pm, targetDir);
		} catch {
			die(
				`Project created at ${targetDir}, but "${pm} install" failed — cd in and run it manually.`,
			);
		}
	}
	if (git) {
		console.log(pc.cyan("\nInitializing git repository...\n"));
		try {
			gitInit(targetDir);
		} catch {
			die(
				`Project created at ${targetDir}, but git init failed — the files were written; initialize git manually.`,
			);
		}
	}

	printNextSteps(dir, pm, install);
}

function printNextSteps(dir: string, pm: PackageManager, installed: boolean): void {
	const run = pm === "npm" ? "npm run" : pm;
	// npm needs `--` to forward args to a script; pnpm/yarn/bun forward directly.
	const qdbgConnect = pm === "npm" ? "npm run qdbg -- connect" : `${run} qdbg connect`;
	const lines = ["", pc.green(pc.bold("✔ Done! Next steps:")), "", `  ${pc.bold(`cd ${dir}`)}`];
	if (!installed) lines.push(`  ${pc.bold(`${pm} install`)}`);
	lines.push(
		`  ${pc.bold(`${run} dev`)}          ${pc.dim("# start the dev server")}`,
		`  ${pc.bold(qdbgConnect)} ${pc.dim("# debug the running game")}`,
		"",
		pc.dim("  Open the project in Claude Code and read CLAUDE.md to build your game."),
		"",
	);
	console.log(lines.join("\n"));
}

main().catch((err) => die(err instanceof Error ? err.message : String(err)));
