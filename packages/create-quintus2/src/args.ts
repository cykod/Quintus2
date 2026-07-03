/**
 * Pure, testable CLI argument parser. Kept out of index.ts (which is excluded
 * from coverage) so the parsing logic — the trickiest branching in the package —
 * can be unit-tested. On invalid input it throws a plain Error whose message the
 * caller prints via `die`; it never touches `process`.
 */
import { KNOWN, type PackageManager } from "./pm.js";

export const TEMPLATES = ["2d", "3d"] as const;
export type Template = (typeof TEMPLATES)[number];

/**
 * The canonical set of long-form option flags the CLI recognizes. This is the
 * single source of truth the `--help` drift guard (`help.test.ts`) checks in BOTH
 * directions: every flag here must be documented in `help.ts`, and every flag the
 * `parseArgs` switch below accepts must appear here. Add a flag to `parseArgs`?
 * Add it here and to `help.ts`, or the drift test fails.
 */
export const FLAGS = [
	"--template",
	"--name",
	"--pm",
	"--no-install",
	"--no-git",
	"--force",
	"--help",
] as const;

export interface CliArgs {
	dir?: string;
	template?: Template;
	name?: string;
	pm?: PackageManager;
	install: boolean;
	git: boolean;
	force: boolean;
	help: boolean;
}

/**
 * Parse `argv` (without the leading `node`/script entries). Supports BOTH the
 * space form (`--template 2d`) and the equals form (`--template=2d`); the latter
 * is idiomatic for `npm create` invocations. Negation flags (`--no-install`,
 * `--no-git`) and `--force`/`--help` are preserved. Throws on unknown options,
 * missing values, or invalid enum values.
 */
export function parseArgs(argv: string[]): CliArgs {
	const args: CliArgs = { install: true, git: true, force: false, help: false };

	// Normalize `--flag=value` into separate `--flag` and `value` tokens so both
	// the equals form and the space form flow through the same switch below.
	const tokens: string[] = [];
	for (const raw of argv) {
		if (raw.startsWith("--") && raw.includes("=")) {
			const eq = raw.indexOf("=");
			tokens.push(raw.slice(0, eq), raw.slice(eq + 1));
		} else {
			tokens.push(raw);
		}
	}

	for (let i = 0; i < tokens.length; i++) {
		const arg = tokens[i];
		switch (arg) {
			case "--template":
				args.template = expectTemplate(tokens[++i]);
				break;
			case "--name":
				args.name = expectValue(arg, tokens[++i]);
				break;
			case "--pm":
				args.pm = expectPm(tokens[++i]);
				break;
			case "--no-install":
				args.install = false;
				break;
			case "--no-git":
				args.git = false;
				break;
			case "--force":
				args.force = true;
				break;
			case "--help":
			case "-h":
				args.help = true;
				break;
			default:
				if (arg?.startsWith("-")) throw new Error(`Unknown option: ${arg}`);
				if (args.dir === undefined) args.dir = arg;
				else throw new Error(`Unexpected argument: ${arg}`);
		}
	}
	return args;
}

function expectValue(flag: string, value: string | undefined): string {
	if (value === undefined) throw new Error(`Missing value for ${flag}`);
	return value;
}

function expectTemplate(value: string | undefined): Template {
	const v = expectValue("--template", value);
	if (!(TEMPLATES as readonly string[]).includes(v)) {
		throw new Error(`Invalid --template "${v}" (expected: ${TEMPLATES.join(" | ")})`);
	}
	return v as Template;
}

function expectPm(value: string | undefined): PackageManager {
	const v = expectValue("--pm", value);
	if (!(KNOWN as readonly string[]).includes(v)) {
		throw new Error(`Invalid --pm "${v}" (expected: ${KNOWN.join(" | ")})`);
	}
	return v as PackageManager;
}
