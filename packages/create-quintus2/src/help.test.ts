import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FLAGS, parseArgs } from "./args.js";
import { helpText } from "./help.js";

/**
 * Drift guard: the documented flags (help.ts) and the flags `parseArgs` actually
 * accepts (args.ts) must stay in lockstep. Guarded in BOTH directions:
 *   - forward: every flag in the canonical `FLAGS` list is documented in help.ts;
 *   - reverse: every `case "--flag"` the parseArgs switch handles appears in the
 *     help text — so adding a NEW flag to args.ts without documenting it fails here.
 */
describe("helpText (--help snapshot / drift guard)", () => {
	const text = helpText();

	it("documents every supported flag", () => {
		for (const flag of FLAGS) {
			expect(text).toContain(flag);
		}
	});

	it("documents every flag parseArgs actually accepts (reverse drift guard)", () => {
		// Read args.ts source and extract its `case "-x"` / `case "--x"` labels — the
		// literal set of flags the parser recognizes — then require each to be
		// documented. Catches a flag added to parseArgs but forgotten in help.ts.
		const argsSrc = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "args.ts"), "utf8");
		const cases = [...argsSrc.matchAll(/case\s+"(-{1,2}[a-z][a-z-]*)"/g)].map((m) => m[1]);
		expect(cases.length).toBeGreaterThan(0); // sanity: the regex still matches the switch
		for (const flag of cases) {
			expect(text, `parseArgs accepts ${flag} but help.ts does not document it`).toContain(flag);
			// Long flags must also be in the canonical FLAGS list (aliases like -h excepted).
			if (flag.startsWith("--")) {
				expect(FLAGS as readonly string[], `${flag} is missing from the FLAGS list`).toContain(
					flag,
				);
			}
		}
	});

	it("shows the correct invocation form and both templates", () => {
		expect(text).toContain("npm create quintus2");
		expect(text).toContain("2d|3d");
		expect(text).toContain("npm|pnpm|yarn|bun");
	});

	it("every documented flag is accepted by parseArgs", () => {
		expect(() => parseArgs(["--template", "2d"])).not.toThrow();
		expect(() => parseArgs(["--name", "x"])).not.toThrow();
		expect(() => parseArgs(["--pm", "npm"])).not.toThrow();
		expect(parseArgs(["--no-install"]).install).toBe(false);
		expect(parseArgs(["--no-git"]).git).toBe(false);
		expect(parseArgs(["--force"]).force).toBe(true);
		expect(parseArgs(["--help"]).help).toBe(true);
		expect(parseArgs(["-h"]).help).toBe(true);
	});
});
