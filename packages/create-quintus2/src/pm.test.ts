import { describe, expect, it } from "vitest";
import { detectPackageManager } from "./pm.js";

describe("detectPackageManager", () => {
	it("detects pnpm from the user agent", () => {
		expect(detectPackageManager("pnpm/10.28.1 npm/? node/v20.0.0")).toBe("pnpm");
	});

	it("detects yarn from the user agent", () => {
		expect(detectPackageManager("yarn/4.1.0 npm/? node/v20.0.0")).toBe("yarn");
	});

	it("detects bun from the user agent", () => {
		expect(detectPackageManager("bun/1.1.0 npm/? node/v20.0.0")).toBe("bun");
	});

	it("detects npm from the user agent", () => {
		expect(detectPackageManager("npm/10.2.0 node/v20.0.0")).toBe("npm");
	});

	it("falls back to npm when the user agent is empty (falsy)", () => {
		// Passing `undefined` would trigger the `process.env` default, so the empty
		// string is the deterministic way to exercise the falsy-agent fallback.
		expect(detectPackageManager("")).toBe("npm");
	});

	it("falls back to npm for an unknown/garbage agent", () => {
		expect(detectPackageManager("evil; rm -rf ~/1.0 node/v20")).toBe("npm");
		expect(detectPackageManager("deno/2.0.0")).toBe("npm");
	});
});
