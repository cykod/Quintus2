import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(resolve(root, p), "utf8");

/**
 * Doc-lint for the embedding contract (design Phase 5).
 *
 * These are the symbols an embedder demonstrably reaches for first, each of which
 * has runtime behavior the type signature does not convey. The rule is that every
 * one of them carries a TSDoc block — not that the block says anything in
 * particular; the prose is reviewed, not asserted.
 */
const CONTRACT_SYMBOLS = [
	["packages/core/src/game.ts", 'scale?: "fit" | "fixed" | "fill" | "fit-parent";'],
	["packages/core/src/game.ts", "canvas?: string | HTMLCanvasElement;"],
	["packages/core/src/game.ts", "renderer?: Renderer | null;"],
	["packages/core/src/game.ts", "step(variableDt?: number): void {"],
	["packages/core/src/game.ts", "stop(): void {"],
	["packages/core/src/node.ts", "destroy(): void {"],
	["packages/core/src/node.ts", "removeChild(node: Node): void {"],
	["packages/core/src/node.ts", "removeSelf(): void {"],
	["packages/core/src/node.ts", "is<T extends Node>(type: NodeType<T>): this is T {"],
	["packages/core/src/node.ts", "find(name: string): Node | null {"],
	["packages/core/src/node.ts", "findAll(tag: string): Node[];"],
	["packages/core/src/node.ts", "findFirst(tag: string): Node | null;"],
	["packages/core/src/node.ts", "getChild<T extends Node>(type: NodeType<T>): T | null {"],
	["packages/core/src/node.ts", "getChildren<T extends Node>(type: NodeType<T>): T[] {"],
	["packages/core/src/node.ts", "findByType<T extends Node>(type: NodeType<T>): T | null {"],
	["packages/core/src/node.ts", "findAllByType<T extends Node>(type: NodeType<T>): T[] {"],
	["packages/core/src/node.ts", "export interface NodeConstructor<T extends Node = Node> {"],
	["packages/core/src/node.ts", "export type NodeType<T extends Node = Node>"],
	["packages/core/src/reactive-state.ts", "export function reactiveState<"],
	["packages/input/src/input.ts", "export interface InputConfig {"],
	["packages/input/src/input.ts", "keyTarget?: HTMLElement | Document;"],
	["packages/input/src/input.ts", 'preventDefaultPolicy?: "always" | "focused";'],
	["packages/input/src/input.ts", "setEnabled(enabled: boolean): void {"],
	["packages/input/src/input.ts", "inject(action: string, pressed: boolean): void {"],
	["packages/input/src/input.ts", "injectAnalog(action: string, value: number): void {"],
];

/** Lines immediately above `declLine` that make up its TSDoc block, or null. */
function tsdocAbove(lines, declLine) {
	let i = declLine - 1;
	while (i >= 0 && lines[i].trim() === "") i--;
	if (i < 0) return null;
	// A single-line `/** … */` counts as a (too-short) doc, not as no doc at all.
	if (lines[i].trim().startsWith("/**") && lines[i].trim().endsWith("*/")) return lines[i];
	if (lines[i].trim() !== "*/") return null;
	const end = i;
	while (i >= 0 && !lines[i].trim().startsWith("/**")) {
		// A `*/` that closes something other than a TSDoc block.
		if (i < end && lines[i].trim().endsWith("*/")) return null;
		i--;
	}
	return i < 0 ? null : lines.slice(i, end + 1).join("\n");
}

describe("embedding contract is documented", () => {
	const cache = new Map();
	const linesOf = (file) => {
		if (!cache.has(file)) cache.set(file, read(file).split("\n"));
		return cache.get(file);
	};

	for (const [file, decl] of CONTRACT_SYMBOLS) {
		it(`${file} → ${decl}`, () => {
			const lines = linesOf(file);
			const idx = lines.findIndex((l) => l.trim().startsWith(decl));
			expect(idx, `declaration not found — did it get renamed?`).toBeGreaterThan(-1);

			const doc = tsdocAbove(lines, idx);
			expect(doc, "no TSDoc block directly above the declaration").not.toBeNull();
			// A bare one-liner restating the type is what this lint exists to catch.
			expect(doc.split("\n").length, "TSDoc is a one-liner, not a contract").toBeGreaterThan(2);
		});
	}
});

const GUIDE_PATH = "packages/quintus2/docs/embedding.md";

describe("embedding guide", () => {
	const guide = read(GUIDE_PATH);

	it("is registered with TypeDoc", () => {
		const typedoc = JSON.parse(read("typedoc.json"));
		expect(typedoc.projectDocuments).toContain(GUIDE_PATH);
	});

	// The guide lives inside packages/quintus2 so it ships in the npm tarball — an
	// installed consumer gets it at node_modules/quintus2/docs/embedding.md. If it moves
	// back out, the relative @see links below break silently.
	it("is published in the quintus2 tarball", () => {
		const pkg = JSON.parse(read("packages/quintus2/package.json"));
		expect(pkg.files).toContain("docs");
	});

	it("covers all four axes", () => {
		for (const heading of [
			"## 1. Scale",
			"## 2. Input scope",
			"## 3. Teardown",
			"## 4. Headless",
		]) {
			expect(guide).toContain(heading);
		}
	});

	// The relative form is what TypeDoc resolves to the in-site rendered document
	// (`{@link Embedding_quintus2}` does NOT work here — with entryPointStrategy
	// "packages" each package converts as its own project, so a root-level
	// projectDocuments entry is out of scope during per-package link resolution).
	// The same string also resolves on disk from the published tarball, because
	// packages/core/src/ and node_modules/quintus2/dist/ sit at the same depth.
	const RELATIVE_LINK = "../../quintus2/docs/embedding.md";

	it("is cross-linked from the TSDoc that needs it", () => {
		for (const file of [
			"packages/core/src/game.ts",
			"packages/core/src/node.ts",
			"packages/core/src/reactive-state.ts",
			"packages/input/src/input.ts",
		]) {
			expect(read(file), `${file} has no @see link to the embedding guide`).toContain(
				RELATIVE_LINK,
			);
		}
	});

	it("the relative link actually points at the guide from each linking file", () => {
		for (const file of [
			"packages/core/src/game.ts",
			"packages/core/src/node.ts",
			"packages/core/src/reactive-state.ts",
			"packages/input/src/input.ts",
		]) {
			const resolved = resolve(dirname(resolve(root, file)), RELATIVE_LINK);
			expect(resolved, `${RELATIVE_LINK} from ${file} does not reach the guide`).toBe(
				resolve(root, GUIDE_PATH),
			);
		}
	});
});
