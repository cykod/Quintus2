// Shell-level check for `bin/qdbg`'s connect URL resolution (Phase 6 / D5).
// `connect --print-url` is a pure dry run — it resolves and prints the URL without
// launching playwright, the dev server, or a browser — so it is safe to assert here.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

// Vitest runs with the repo root as cwd (root vitest.config.ts owns this suite).
const repoRoot = process.cwd();
const qdbg = join(repoRoot, "bin", "qdbg");

/** Run `qdbg connect --print-url` in `cwd` and return the resolved URL. */
function printUrl(cwd, env) {
	return execFileSync(qdbg, ["connect", "--print-url"], {
		cwd,
		encoding: "utf8",
		env: { ...process.env, ...env },
	}).trim();
}

/** Run the dry run expecting it to `die`; return the stderr message. */
function printUrlError(cwd, env) {
	try {
		execFileSync(qdbg, ["connect", "--print-url"], {
			cwd,
			encoding: "utf8",
			env: { ...process.env, ...env },
			stdio: ["ignore", "pipe", "pipe"],
		});
	} catch (err) {
		return String(err.stderr ?? "");
	}
	throw new Error("expected qdbg connect --print-url to exit non-zero");
}

describe("qdbg connect URL resolution", () => {
	const tmp = mkdtempSync(join(tmpdir(), "qdbg-url-"));
	afterAll(() => rmSync(tmp, { recursive: true, force: true }));

	it("uses ./.qdbg.json's url (root + ?debug) when present and no arg is given", () => {
		writeFileSync(join(tmp, ".qdbg.json"), JSON.stringify({ url: "http://localhost:3050" }));
		expect(printUrl(tmp)).toBe("http://localhost:3050/?debug");
	});

	it("falls back to the monorepo /<demo>/ url when no ./.qdbg.json is present", () => {
		// Run from the repo root (no ./.qdbg.json) → the multi-page platformer path.
		// The port floats to whatever dev server is live (3050 by default), so match the shape.
		expect(printUrl(repoRoot)).toMatch(/^http:\/\/localhost:\d+\/platformer\/\?debug$/);
	});

	it("dies on a ./.qdbg.json missing a url field, even under FORCE_COLOR=1", () => {
		// Regression: console.log(undefined) is ANSI-colored under FORCE_COLOR, which
		// defeated the old `= "undefined"` guard. The fix uses process.stdout.write.
		writeFileSync(join(tmp, ".qdbg.json"), JSON.stringify({ foo: 1 }));
		expect(printUrlError(tmp, { FORCE_COLOR: "1" })).toMatch(/missing a "url" field/);
	});

	it("rejects a non-http(s) scheme in ./.qdbg.json", () => {
		writeFileSync(join(tmp, ".qdbg.json"), JSON.stringify({ url: "file:///etc/passwd" }));
		expect(printUrlError(tmp)).toMatch(/non-http\(s\) URL/);
	});

	it("rejects a non-localhost host in ./.qdbg.json", () => {
		writeFileSync(join(tmp, ".qdbg.json"), JSON.stringify({ url: "http://evil.com" }));
		expect(printUrlError(tmp)).toMatch(/localhost or 127\.0\.0\.1/);
	});
});
