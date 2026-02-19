import { Fragment, jsx } from "./h.js";

export { jsx as jsxDEV, Fragment };

// ---- Module-scoped JSX namespace (dev mode) ----
// Must mirror jsx-runtime.ts — TypeScript resolves types from dev runtime separately.

import type { Node } from "@quintus/core";
import type { DeriveProps } from "./types.js";

export namespace JSX {
	export type Element = Node | Node[];
	export type ElementClass = Node;
	export type LibraryManagedAttributes<C, P> = DeriveProps<C, P>;
	// biome-ignore lint/complexity/noBannedTypes: required by JSX namespace to disallow lowercase tags
	export type IntrinsicElements = {};
}
