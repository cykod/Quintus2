import type { Node, NodeConstructor, Signal } from "@quintus/core";
import type { Color, Vec2 } from "@quintus/math";
import type { Ref } from "./ref.js";

// ---- Internal utility types ----

/**
 * Conditional type that resolves to A if X and Y are identical types, B otherwise.
 * Used to detect readonly properties by comparing `{ [K]: T }` vs `{ -readonly [K]: T }`.
 */
type IfEquals<X, Y, A = X, B = never> =
	(<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? A : B;

/**
 * Extract writable (non-readonly) keys from T, excluding:
 * - Methods (function-typed properties)
 * - Underscore-prefixed private properties
 * - Readonly properties (including getter-only)
 */
type WritableKeys<T> = {
	[K in keyof T]-?: K extends `_${string}`
		? never
		: // biome-ignore lint/suspicious/noExplicitAny: needed for function detection in conditional types
			T[K] extends (...args: any[]) => any
			? never
			: IfEquals<{ [Q in K]: T[K] }, { -readonly [Q in K]: T[K] }, K>;
}[keyof T];

/**
 * Coerce property types for JSX ergonomics.
 * - Node-typed props also accept "$refName" dollar refs
 * - Vec2 props also accept [number, number] tuples
 * - The `scale` prop additionally accepts a single number (uniform scale)
 * - Color props also accept hex strings
 */
type CoercedPropType<T, K extends string = string> =
	NonNullable<T> extends Node
		? T | `$${string}`
		: T extends Vec2
			? Vec2 | [number, number] | (K extends "scale" ? number : never)
			: T extends Color
				? Color | string
				: T;

/**
 * Extract Signal properties and map them to handler functions.
 * Handles both readonly and writable signals since they are connected, not assigned.
 */
type SignalProps<T> = {
	// biome-ignore lint/suspicious/noExplicitAny: needed for Signal type parameter extraction
	[K in keyof T as T[K] extends Signal<any> ? K : never]?: T[K] extends Signal<infer P>
		? // biome-ignore lint/suspicious/noConfusingVoidType: void is correct for Signal<void> detection
			[P] extends [void]
			? () => void
			: (payload: P) => void
		: never;
};

/**
 * JSX props for a Node class T.
 * Combines writable properties (with coercion), signal handler props, and JSX-specific props.
 */
export type NodeJSXProps<T extends Node> = {
	// Writable, non-signal properties with coercion applied
	// biome-ignore lint/suspicious/noExplicitAny: needed for Signal type detection in conditional type
	[K in WritableKeys<T> as T[K] extends Signal<any> ? never : K]?: CoercedPropType<
		T[K],
		K & string
	>;
} & SignalProps<T> & {
		ref?: string | ((node: T) => void) | Ref<T>;
		children?: Node | Node[];
		key?: string | number;
	};

// ---- JSX namespace types ----

/** Type used by LibraryManagedAttributes to derive props from Node constructors. */
export type DeriveProps<C, P> = C extends NodeConstructor<infer T> ? NodeJSXProps<T> : P;
