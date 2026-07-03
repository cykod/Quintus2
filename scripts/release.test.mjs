import { describe, expect, it } from "vitest";
import { parseChangelogVersion, semverCmp } from "./release.mjs";

describe("parseChangelogVersion", () => {
	it("reads the version from the topmost `## [x.y.z]` heading", () => {
		const changelog = ["# Changelog", "", "## [0.0.2] - 2026-07-02", "", "- something"].join("\n");
		expect(parseChangelogVersion(changelog)).toBe("0.0.2");
	});

	it("skips an `## [Unreleased]` heading and reads the first versioned one", () => {
		const changelog = [
			"# Changelog",
			"",
			"## [Unreleased]",
			"",
			"_placeholder_",
			"",
			"## [0.1.0] - 2026-08-01",
			"",
			"## [0.0.1] - 2026-07-02",
		].join("\n");
		expect(parseChangelogVersion(changelog)).toBe("0.1.0");
	});

	it("parses a prerelease version", () => {
		expect(parseChangelogVersion("## [1.2.3-alpha.1] - 2026-01-01")).toBe("1.2.3-alpha.1");
	});

	it("returns null when there is no versioned heading", () => {
		expect(parseChangelogVersion("# Changelog\n\n## [Unreleased]\n")).toBeNull();
	});
});

describe("semverCmp", () => {
	it("orders by major, then minor, then patch", () => {
		expect(semverCmp("0.0.2", "0.0.1")).toBeGreaterThan(0);
		expect(semverCmp("0.0.1", "0.0.2")).toBeLessThan(0);
		expect(semverCmp("0.1.0", "0.0.9")).toBeGreaterThan(0);
		expect(semverCmp("1.0.0", "0.9.9")).toBeGreaterThan(0);
		expect(semverCmp("0.0.1", "0.0.1")).toBe(0);
	});

	it("ranks a prerelease below its release", () => {
		expect(semverCmp("1.0.0-alpha.1", "1.0.0")).toBeLessThan(0);
		expect(semverCmp("1.0.0", "1.0.0-alpha.1")).toBeGreaterThan(0);
	});

	it("sorts a version list with the release outranking its prereleases", () => {
		const sorted = ["1.0.0", "0.0.1", "1.0.0-alpha.1", "0.1.0"].sort(semverCmp);
		expect(sorted).toEqual(["0.0.1", "0.1.0", "1.0.0-alpha.1", "1.0.0"]);
	});
});
