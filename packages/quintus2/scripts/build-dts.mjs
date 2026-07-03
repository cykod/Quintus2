// Declaration bundler for `quintus2`.
//
// WHY THIS EXISTS: tsup's `dts: true` emits `export * from "@quintus/core"` etc. for every
// entry. Those `@quintus/*` packages are `"private": true` and are NEVER installed in a
// consumer's project, so a scaffolded app running `tsc --noEmit` (or an IDE) gets ~58
// unresolved-module errors even though the bundled JS runs fine. tsup's `dts.resolve` inlines
// the names but rollup-plugin-dts then DUPLICATES shared `@quintus/core` types (Game, Node,
// Plugin, ...) per inlined package, breaking class identity within an entry; `experimentalDts`
// fails the build outright.
//
// STRATEGY:
//   1. `index` is the SOURCE OF TRUTH — dts-bundle-generator produces ONE self-contained
//      `dist/index.d.ts` inlining every 2D engine package. No `@quintus/*`, no `three`.
//   2. Every OTHER entry (`testing`, `three`, jsx runtimes) is also bundled self-contained,
//      then TRANSFORMED: any declaration whose name matches an `index` public export is
//      DROPPED and instead IMPORTED from `./index.js`. That makes `Game`, `Node`, `Plugin`,
//      `Vec2`, the `JSX` element type, etc. the SAME declaration across every entry, so
//      cross-entry usage typechecks — `game.use(PhysicsPlugin())`, JSX components, and mixing
//      `quintus2` classes with `quintus2/testing`'s `HeadlessGame`/`TestRunner` all share one
//      identity (no duplicate-`private _parent` / duplicate-`Plugin` error).
//   3. `three` stays an external `import * as THREE from "three"` (optional peer; its types
//      come from the consumer's `@types/three`), and `@quintus/three`'s `game.three`
//      augmentation is re-pointed at the shared `./index.js` `Game`.
//
// dts-bundle-generator renames colliding symbols with a `$n` suffix (e.g. `Node$1 as Node`),
// so the transform matches on the BASE name (`Node`) and re-imports under the local alias
// (`import { Node as Node$1 } from "./index.js"`).
//
// Emits both `.d.ts` (ESM / `import` condition) and `.d.cts` (CJS / `require` condition) for
// every entry, matching the `exports` map in package.json.

import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generateDtsBundle } from "dts-bundle-generator";
import ts from "typescript";

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, "..");
const src = (p) => resolve(pkgRoot, "src", p);
const out = (p) => resolve(pkgRoot, "dist", p);

// Internal engine packages that `index` inlines. `three` is excluded so the external `three`
// types never leak into the 2D-only surface (its `game.three` augmentation is handled below).
const INDEX_INLINE = [
	"@quintus/audio",
	"@quintus/camera",
	"@quintus/core",
	"@quintus/input",
	"@quintus/math",
	"@quintus/physics",
	"@quintus/prefabs",
	"@quintus/sprites",
	"@quintus/tilemap",
	"@quintus/touch",
	"@quintus/tween",
	"@quintus/ui",
];

const commonOutput = { noBanner: true, sortNodes: false };
const preferredConfigPath = resolve(pkgRoot, "tsconfig.json");

/**
 * Generate ONE self-contained declaration bundle for an entry, inlining the given libraries.
 * `three` is always kept as an external import.
 */
function bundle(filePath, inlinedLibraries) {
	return generateDtsBundle(
		[
			{
				filePath,
				libraries: { inlinedLibraries, importedLibraries: ["three"] },
				output: commonOutput,
			},
		],
		{ preferredConfigPath },
	)[0];
}

const baseName = (n) => n.replace(/\$\d+$/, "");

/** Names declared by a top-level statement (for matching against the index export set). */
function declaredName(stmt) {
	if (
		ts.isClassDeclaration(stmt) ||
		ts.isInterfaceDeclaration(stmt) ||
		ts.isTypeAliasDeclaration(stmt) ||
		ts.isEnumDeclaration(stmt) ||
		ts.isFunctionDeclaration(stmt) ||
		ts.isModuleDeclaration(stmt)
	) {
		return stmt.name && ts.isIdentifier(stmt.name) ? stmt.name.text : null;
	}
	if (ts.isVariableStatement(stmt)) {
		const d = stmt.declarationList.declarations[0];
		return d && ts.isIdentifier(d.name) ? d.name.text : null;
	}
	return null;
}

const hasExport = (stmt) =>
	(ts.getCombinedModifierFlags(stmt) & ts.ModifierFlags.Export) !== 0 ||
	stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);

/**
 * Collect the set of PUBLIC export names from a self-contained bundle. Handles direct
 * `export`ed declarations and the trailing `export { Local$1 as Public }` block.
 */
function publicExports(text) {
	const sf = ts.createSourceFile("b.d.ts", text, ts.ScriptTarget.Latest, true);
	const names = new Set();
	for (const stmt of sf.statements) {
		if (ts.isExportDeclaration(stmt) && stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
			if (stmt.moduleSpecifier) continue; // re-export from elsewhere (none expected)
			for (const el of stmt.exportClause.elements) names.add(el.name.text);
			continue;
		}
		if (hasExport(stmt)) {
			const n = declaredName(stmt);
			if (n) names.add(n);
		}
	}
	return names;
}

/**
 * Rewrite a self-contained bundle so every declaration whose base name is in `indexNames`
 * is imported from the shared `./index.js` instead of inlined. Returns the transformed text.
 *
 * @param {string} text  self-contained bundle
 * @param {Set<string>} indexNames  public export names of the index entry
 * @param {boolean} keepThree  keep the external `three` import
 * @param {boolean} augmentGame  re-point the `interface Game { get three }` augmentation
 */
function externalize(text, indexNames, { keepThree, augmentGame }) {
	const sf = ts.createSourceFile("b.d.ts", text, ts.ScriptTarget.Latest, true);
	const kept = []; // preserved statement source text
	const importAliases = new Map(); // localName -> baseName (import { base as local } from ./index)
	const reexport = new Set(); // public names to re-export from ./index
	let gameAugment = null; // interface-body text for the game.three augmentation

	for (const stmt of sf.statements) {
		// Imports: keep only the external `three` import; drop everything else.
		if (ts.isImportDeclaration(stmt)) {
			const spec = stmt.moduleSpecifier.text;
			if (keepThree && (spec === "three" || spec.startsWith("three/"))) kept.push(stmt.getText(sf));
			continue;
		}

		// Trailing `export { Local as Public, ... }` (no module specifier).
		if (
			ts.isExportDeclaration(stmt) &&
			!stmt.moduleSpecifier &&
			stmt.exportClause &&
			ts.isNamedExports(stmt.exportClause)
		) {
			const keepEls = [];
			for (const el of stmt.exportClause.elements) {
				const local = (el.propertyName ?? el.name).text;
				if (indexNames.has(baseName(local))) {
					reexport.add(el.name.text); // public name is re-exported from ./index
				} else {
					keepEls.push(el.getText(sf));
				}
			}
			if (keepEls.length) kept.push(`export { ${keepEls.join(", ")} };`);
			continue;
		}
		if (ts.isExportDeclaration(stmt)) continue; // `export {}` / `export *`

		const name = declaredName(stmt);
		if (name && indexNames.has(baseName(name))) {
			const base = baseName(name);
			// The one real augmentation: `interface Game { get three(): ThreeContext }`.
			if (augmentGame && base === "Game" && ts.isInterfaceDeclaration(stmt)) {
				const body = stmt.getText(sf).replace(/^export\s+/, "");
				gameAugment = body;
				importAliases.set(name, base); // ensure Game is importable/referenced
				continue;
			}
			// Shared type inlined by dts-bundle-generator → import it from ./index instead.
			importAliases.set(name, base);
			if (hasExport(stmt)) reexport.add(base);
			continue;
		}

		kept.push(stmt.getFullText(sf));
	}

	const keptText = kept.join("\n");

	// Only import the shared locals actually referenced in the kept output (keeps it tidy).
	const neededImports = [];
	for (const [local, base] of importAliases) {
		const re = new RegExp(`\\b${local.replace(/\$/g, "\\$")}\\b`);
		if (re.test(keptText) || (gameAugment && re.test(gameAugment)) || reexport.has(base)) {
			neededImports.push(local === base ? base : `${base} as ${local}`);
		}
	}

	// NOTE: the external `three` import is preserved inside `keptText` (the import loop keeps
	// it), so we must NOT prepend another `import * as THREE` here — that would be a duplicate
	// identifier. `keptText` already carries it.
	const lines = [];
	if (neededImports.length) {
		lines.push(`import { ${[...new Set(neededImports)].join(", ")} } from "./index.js";`);
	}
	if (reexport.size) lines.push(`export { ${[...reexport].join(", ")} } from "./index.js";`);
	lines.push(keptText);
	if (gameAugment) lines.push(`declare module "./index.js" {\n\t${gameAugment}\n}`);
	return `${lines.join("\n")}\n`;
}

// ---------------------------------------------------------------------------------------------

console.log("[build-dts] generating declaration bundles...");

// 1. index — self-contained source of truth.
const indexDts = bundle(src("index.ts"), INDEX_INLINE);
const indexNames = publicExports(indexDts);
console.log(`[build-dts]   index: ${indexNames.size} public exports`);

// 2. other entries — bundle self-contained, then externalize shared types to ./index.
//    Each is generated in its OWN dts-bundle-generator pass so the three augmentation
//    (declared in @quintus/three) can't bleed into any non-three program.
const testingDts = externalize(
	bundle(src("testing.ts"), ["@quintus/headless", "@quintus/test", "@quintus/snapshot"]),
	indexNames,
	{ keepThree: false, augmentGame: false },
);
const jsxRuntimeDts = externalize(bundle(src("jsx-runtime.ts"), ["@quintus/jsx"]), indexNames, {
	keepThree: false,
	augmentGame: false,
});
const jsxDevRuntimeDts = externalize(
	bundle(src("jsx-dev-runtime.ts"), ["@quintus/jsx"]),
	indexNames,
	{ keepThree: false, augmentGame: false },
);
const threeDts = externalize(bundle(src("three.ts"), ["@quintus/three"]), indexNames, {
	keepThree: true,
	augmentGame: true,
});

// 3. write .d.ts (ESM) + .d.cts (CJS) for every entry. The CJS variant points the shared
//    import/augmentation at ./index.cjs so require-condition consumers resolve index.d.cts.
const toCjs = (text) => text.replace(/(["'])\.\/index\.js\1/g, '"./index.cjs"');

const outputs = {
	index: indexDts,
	testing: testingDts,
	three: threeDts,
	"jsx-runtime": jsxRuntimeDts,
	"jsx-dev-runtime": jsxDevRuntimeDts,
};

for (const [name, dts] of Object.entries(outputs)) {
	writeFileSync(out(`${name}.d.ts`), dts);
	writeFileSync(out(`${name}.d.cts`), toCjs(dts));
	console.log(`[build-dts]   wrote dist/${name}.d.ts + dist/${name}.d.cts`);
}

// 4. sanity: no emitted declaration may reference `@quintus/*`.
for (const [name, dts] of Object.entries(outputs)) {
	if (/(from|import|module)\s*["']@quintus\//.test(dts)) {
		throw new Error(`[build-dts] ${name}.d.ts still references @quintus/* — transform failed.`);
	}
}
console.log("[build-dts] done — no @quintus/* references in any declaration.");
