import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { scaffold } from "./scaffold.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_2D = join(HERE, "..", "templates", "2d");

describe("scaffold", () => {
	let targetDir: string;

	beforeEach(() => {
		targetDir = mkdtempSync(join(tmpdir(), "cq2-scaffold-"));
	});

	afterEach(() => {
		rmSync(targetDir, { recursive: true, force: true });
	});

	it("scaffolds the 2d template into a temp dir", () => {
		scaffold({
			templateDir: TEMPLATE_2D,
			targetDir,
			projectName: "my-game",
			engineVersion: "0.0.3",
		});

		expect(existsSync(join(targetDir, "package.json"))).toBe(true);
		expect(existsSync(join(targetDir, "src", "main.ts"))).toBe(true);
	});

	it("renames _gitignore → .gitignore (and drops the underscore original)", () => {
		scaffold({
			templateDir: TEMPLATE_2D,
			targetDir,
			projectName: "my-game",
			engineVersion: "0.0.3",
		});

		expect(existsSync(join(targetDir, ".gitignore"))).toBe(true);
		expect(existsSync(join(targetDir, "_gitignore"))).toBe(false);
	});

	it("pins quintus2 as the only engine dep (no @quintus/*, no workspace:*)", () => {
		scaffold({
			templateDir: TEMPLATE_2D,
			targetDir,
			projectName: "my-game",
			engineVersion: "0.0.3",
		});

		const pkg = JSON.parse(readFileSync(join(targetDir, "package.json"), "utf8"));
		expect(pkg.name).toBe("my-game");
		expect(pkg.dependencies.quintus2).toBe("0.0.3");

		const deps = Object.keys(pkg.dependencies);
		expect(deps.filter((d) => d.startsWith("@quintus/"))).toHaveLength(0);

		const allValues = [
			...Object.values(pkg.dependencies ?? {}),
			...Object.values(pkg.devDependencies ?? {}),
		];
		expect(allValues.some((v) => String(v).includes("workspace:"))).toBe(false);
	});
});
