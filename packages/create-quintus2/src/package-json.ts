/**
 * Pure package.json transform for scaffolded projects.
 *
 * A template's `package.json` ships with a sentinel `"quintus2": "0.0.0"` engine
 * dependency and a placeholder name. When scaffolding, we rewrite the project name
 * and inject the concrete engine version as an EXACT pin (no caret) per design §D6:
 * every scaffold is frozen to the exact `quintus2` the CLI shipped with, and at the
 * `0.0.x` line a caret would be equivalent to an exact pin anyway.
 */

interface PackageJson {
	name?: string;
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	[key: string]: unknown;
}

export interface RewriteOptions {
	/** Project name written to the `name` field. */
	name: string;
	/** Engine version injected as an exact pin into the `quintus2` dependency. */
	engineVersion: string;
}

/**
 * Rewrite a template `package.json` source string: set the project `name` and pin
 * the `quintus2` dependency to `engineVersion` (exact, no caret). Returns pretty
 * tab-indented JSON with a trailing newline (matching the repo's formatting).
 */
export function rewritePackageJson(source: string, opts: RewriteOptions): string {
	const pkg = JSON.parse(source) as PackageJson;
	pkg.name = opts.name;
	// The engine pin is the one field this transform exists to inject. If the
	// template dropped/renamed the sentinel (a broken Phase 4/5 template), fail
	// loudly rather than silently ship an engine-less project.
	if (pkg.dependencies && "quintus2" in pkg.dependencies) {
		pkg.dependencies.quintus2 = opts.engineVersion;
	} else if (pkg.devDependencies && "quintus2" in pkg.devDependencies) {
		pkg.devDependencies.quintus2 = opts.engineVersion;
	} else {
		throw new Error(
			"template package.json is missing a 'quintus2' dependency to pin — the scaffold cannot inject the engine version",
		);
	}
	return `${JSON.stringify(pkg, null, "\t")}\n`;
}
