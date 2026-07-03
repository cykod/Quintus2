import { describe, expect, it } from "vitest";
import { rewritePackageJson } from "./package-json.js";

describe("rewritePackageJson", () => {
	const template = JSON.stringify(
		{
			name: "quintus2-game",
			private: true,
			version: "0.0.0",
			dependencies: { quintus2: "0.0.0" },
			devDependencies: { vite: "^6.0.0" },
		},
		null,
		"\t",
	);

	it("injects the engine version as an exact pin (no caret) and sets the name", () => {
		const out = rewritePackageJson(template, { name: "my-game", engineVersion: "0.0.3" });
		const pkg = JSON.parse(out);
		expect(pkg.name).toBe("my-game");
		expect(pkg.dependencies.quintus2).toBe("0.0.3");
		// exact pin, not a caret range
		expect(pkg.dependencies.quintus2).not.toContain("^");
	});

	it("leaves other fields (devDependencies, private) untouched", () => {
		const out = rewritePackageJson(template, { name: "my-game", engineVersion: "1.2.3" });
		const pkg = JSON.parse(out);
		expect(pkg.devDependencies.vite).toBe("^6.0.0");
		expect(pkg.private).toBe(true);
	});

	it("emits tab-indented JSON with a trailing newline", () => {
		const out = rewritePackageJson(template, { name: "my-game", engineVersion: "0.0.3" });
		expect(out.endsWith("}\n")).toBe(true);
		expect(out).toContain('\n\t"name"');
	});

	it("throws when the template has no 'quintus2' dependency to pin", () => {
		const broken = JSON.stringify({ name: "quintus2-game", dependencies: { vite: "^6.0.0" } });
		expect(() => rewritePackageJson(broken, { name: "my-game", engineVersion: "0.0.3" })).toThrow(
			/quintus2/,
		);
	});

	it("pins the sentinel when it lives in devDependencies", () => {
		const dev = JSON.stringify({ name: "quintus2-game", devDependencies: { quintus2: "0.0.0" } });
		const out = rewritePackageJson(dev, { name: "my-game", engineVersion: "1.2.3" });
		const pkg = JSON.parse(out);
		expect(pkg.devDependencies.quintus2).toBe("1.2.3");
	});
});
