import { describe, expect, it } from "vitest";
import { parseArgs } from "./args.js";

describe("parseArgs", () => {
	it("parses the space form: --template 2d", () => {
		const args = parseArgs(["my-game", "--template", "2d"]);
		expect(args.dir).toBe("my-game");
		expect(args.template).toBe("2d");
	});

	it("parses the equals form: --template=2d", () => {
		const args = parseArgs(["my-game", "--template=2d"]);
		expect(args.dir).toBe("my-game");
		expect(args.template).toBe("2d");
	});

	it("parses --name in both forms", () => {
		expect(parseArgs(["--name", "cool"]).name).toBe("cool");
		expect(parseArgs(["--name=cool"]).name).toBe("cool");
	});

	it("splits only on the first '=' so values may contain '='", () => {
		expect(parseArgs(["--name=a=b"]).name).toBe("a=b");
	});

	it("honors --no-install and --no-git (install/git default true)", () => {
		const dflt = parseArgs(["my-game"]);
		expect(dflt.install).toBe(true);
		expect(dflt.git).toBe(true);

		const off = parseArgs(["my-game", "--no-install", "--no-git"]);
		expect(off.install).toBe(false);
		expect(off.git).toBe(false);
	});

	it("parses --pm and --force", () => {
		const args = parseArgs(["--pm", "pnpm", "--force"]);
		expect(args.pm).toBe("pnpm");
		expect(args.force).toBe(true);
	});

	it("sets help for --help / -h without exiting", () => {
		expect(parseArgs(["--help"]).help).toBe(true);
		expect(parseArgs(["-h"]).help).toBe(true);
	});

	it("throws on an unknown flag", () => {
		expect(() => parseArgs(["--nope"])).toThrow(/Unknown option: --nope/);
	});

	it("throws on an invalid --template value", () => {
		expect(() => parseArgs(["--template", "5d"])).toThrow(/Invalid --template/);
		expect(() => parseArgs(["--template=5d"])).toThrow(/Invalid --template/);
	});

	it("throws on an invalid --pm value", () => {
		expect(() => parseArgs(["--pm=deno"])).toThrow(/Invalid --pm/);
	});

	it("throws on a missing value for a value-taking flag", () => {
		expect(() => parseArgs(["--name"])).toThrow(/Missing value for --name/);
	});

	it("throws on a second positional argument", () => {
		expect(() => parseArgs(["a", "b"])).toThrow(/Unexpected argument: b/);
	});
});
