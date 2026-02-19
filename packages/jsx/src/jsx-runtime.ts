export { Fragment, jsx, jsxs } from "./h.js";

// ---- Module-scoped JSX namespace ----
// TypeScript 5.1+ resolves JSX types from the jsxImportSource module.
// No global namespace pollution — only active when tsconfig has:
//   "jsx": "react-jsx", "jsxImportSource": "@quintus/jsx"

import type { Node } from "@quintus/core";
import type { DeriveProps } from "./types.js";

export namespace JSX {
	/** A JSX expression evaluates to a Node (or Node[] for fragments). */
	export type Element = Node | Node[];

	/** Class components must extend Node. */
	export type ElementClass = Node;

	/** Auto-derive prop types from Node constructors. Zero boilerplate. */
	export type LibraryManagedAttributes<C, P> = DeriveProps<C, P>;

	/** No intrinsic elements (no lowercase tags like <div>). */
	// biome-ignore lint/complexity/noBannedTypes: empty IntrinsicElements is required by JSX namespace to disallow lowercase tags
	export type IntrinsicElements = {};
}
