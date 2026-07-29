import { describe, expectTypeOf, test } from "vitest";
import { Node, type NodeConstructor, type NodeType } from "./node.js";
import type { Scene } from "./scene.js";

// A node class whose constructor takes a required argument. Valid as an
// `instanceof` type token (NodeType), but NOT constructible via add().
class RequiredArgNode extends Node {
	constructor(readonly label: string) {
		super();
	}
}

/** Zero-arg control — must satisfy both NodeConstructor and NodeType. */
class ZeroArgNode extends Node {
	readonly kind = "zero";
}

declare const scene: Scene;
declare const node: Node;

// ---- NodeType vs NodeConstructor ----

describe("NodeType accepts required-arg node classes", () => {
	test("as a bare type token", () => {
		expectTypeOf(RequiredArgNode).toMatchTypeOf<NodeType<RequiredArgNode>>();
		expectTypeOf(ZeroArgNode).toMatchTypeOf<NodeType<ZeroArgNode>>();
	});

	test("NodeConstructor still requires zero args", () => {
		expectTypeOf(ZeroArgNode).toMatchTypeOf<NodeConstructor<ZeroArgNode>>();
		expectTypeOf(RequiredArgNode).not.toMatchTypeOf<NodeConstructor<RequiredArgNode>>();
	});

	test("a NodeType is not assignable to a NodeConstructor", () => {
		const token: NodeType<Node> = RequiredArgNode;
		// @ts-expect-error — a type token carries no zero-arg construct signature.
		const ctor: NodeConstructor<Node> = token;
		void ctor;
	});
});

// ---- The 7 query methods take NodeType, and the generic flows through ----

describe("query methods accept a required-arg class with no cast", () => {
	test("findByType / findAllByType", () => {
		expectTypeOf(scene.findByType(RequiredArgNode)).toEqualTypeOf<RequiredArgNode | null>();
		expectTypeOf(scene.findAllByType(RequiredArgNode)).toEqualTypeOf<RequiredArgNode[]>();
	});

	test("getChild / getChildren", () => {
		expectTypeOf(scene.getChild(RequiredArgNode)).toEqualTypeOf<RequiredArgNode | null>();
		expectTypeOf(scene.getChildren(RequiredArgNode)).toEqualTypeOf<RequiredArgNode[]>();
	});

	test("findAll / findFirst typed overloads", () => {
		expectTypeOf(scene.findAll("target", RequiredArgNode)).toEqualTypeOf<RequiredArgNode[]>();
		expectTypeOf(
			scene.findFirst("target", RequiredArgNode),
		).toEqualTypeOf<RequiredArgNode | null>();
	});

	test("is() narrows to a required-arg class", () => {
		if (node.is(RequiredArgNode)) {
			expectTypeOf(node.label).toEqualTypeOf<string>();
		}
	});
});

// ---- Construction sites must stay narrow ----

describe("construction sites still require a zero-arg constructor", () => {
	test("add() rejects a required-arg class", () => {
		// @ts-expect-error — add() constructs the node, so it must reject required-arg classes.
		scene.add(RequiredArgNode);
		// Control: the zero-arg class is accepted and returns the narrow type.
		expectTypeOf(scene.add(ZeroArgNode)).toEqualTypeOf<ZeroArgNode>();
	});
});
