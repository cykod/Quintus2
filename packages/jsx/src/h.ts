import { IS_NODE_CLASS, Node, type NodeConstructor, Scene } from "@quintus/core";
import { applyProp } from "./coerce.js";
import type { Ref } from "./ref.js";
import { isRef } from "./ref.js";
import { registerStringRef } from "./ref-scope.js";

/** @internal Symbol for tracking the current build() owner across packages. */
const CURRENT_BUILD_OWNER = Symbol.for("quintus:currentBuildOwner");

export const Fragment = Symbol("Fragment");

type NodeElementChild = Node | NodeElementChild[] | null | undefined | false;

/** Recursively flatten children, filtering out null/false/undefined. */
function flattenChildren(children: NodeElementChild[]): Node[] {
	const result: Node[] = [];
	for (const child of children) {
		if (child == null || child === false) continue;
		if (Array.isArray(child)) {
			result.push(...flattenChildren(child));
		} else if (child instanceof Node) {
			result.push(child);
		}
	}
	return result;
}

/** Shared internal creation logic for jsx() and h(). */
function _createElement<T extends Node>(
	type: NodeConstructor<T> | typeof Fragment | ((props: Record<string, unknown>) => Node | Node[]),
	props: Record<string, unknown> | null,
	children: Node[],
	key?: string | number,
): T | Node[] {
	// Fragment: just return children
	if (type === Fragment) {
		return children;
	}

	// Functional component (plain function, not a Node class)
	if (typeof type === "function" && !(IS_NODE_CLASS in type)) {
		const fn = type as (props: Record<string, unknown>) => Node | Node[];
		const mergedProps = { ...props, children };
		return fn(mergedProps) as T | Node[];
	}

	// Scene runtime guard: Scene requires a Game arg, so it can't be used in JSX
	if (typeof type === "function" && type.prototype instanceof Scene) {
		throw new Error(
			`Cannot use Scene class "${type.name}" in JSX. Scenes are created via game.start().`,
		);
	}

	// Class component: create real Node instance
	const node = new (type as NodeConstructor<T>)();

	// Apply key as name (for debugging / lookups)
	if (key != null) node.name = String(key);

	if (props) {
		for (const [k, value] of Object.entries(props)) {
			if (k === "ref") {
				if (typeof value === "string") {
					// String ref: register for $ resolution + assign to build owner
					registerStringRef(value, node);
					const g = globalThis as Record<symbol, unknown>;
					const owner = g[CURRENT_BUILD_OWNER];

					if (!owner) throw new Error(`ref="${value}" can only be used inside build()`);

					if (!(value in (owner as object)))
						throw new Error(
							`ref="${value}": no property "${value}" on ${(owner as object).constructor.name}`,
						);

					(owner as Record<string, unknown>)[value] = node;
				} else if (typeof value === "function") {
					// Callback ref
					(value as (node: Node) => void)(node);
				} else if (isRef(value)) {
					// Legacy Ref<T>
					(value as Ref<T>).current = node;
				}
				continue;
			}
			if (k === "children" || k === "key") continue;
			applyProp(node, k, value);
		}
	}

	// Add children via public API
	for (const child of children) {
		node.add(child);
	}

	return node;
}

/**
 * JSX runtime entry point.
 * Called by TypeScript's react-jsx transform: jsx(type, { ...props, children }, key?)
 */
export function jsx<T extends Node>(
	type: NodeConstructor<T> | typeof Fragment | ((props: Record<string, unknown>) => Node | Node[]),
	props: Record<string, unknown> | null,
	key?: string | number,
): T | Node[] {
	const rawChildren = props?.children;
	const children = rawChildren
		? flattenChildren(Array.isArray(rawChildren) ? rawChildren : [rawChildren])
		: [];

	return _createElement(type, props, children, key);
}

/** Static children variant — identical behavior for one-shot rendering. */
export { jsx as jsxs };

/**
 * Manual hyperscript entry point.
 * Called by users directly: h(Type, { prop: value }, child1, child2)
 */
export function h<T extends Node>(
	type: NodeConstructor<T> | typeof Fragment | ((props: Record<string, unknown>) => Node | Node[]),
	props: Record<string, unknown> | null,
	...children: NodeElementChild[]
): T | Node[] {
	return _createElement(type, props, flattenChildren(children));
}
