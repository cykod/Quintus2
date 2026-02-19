import { IS_NODE_CLASS, Node, Node2D, Scene, type Signal, signal } from "@quintus/core";
import { Color, Vec2 } from "@quintus/math";
import { describe, expect, it, vi } from "vitest";
import { applyProp } from "./coerce.js";
import { Fragment, h, jsx } from "./h.js";
import { ref } from "./ref.js";

// === Test helpers ===

class TestNode extends Node {
	speed = 0;
	label = "";
}

class TestNode2D extends Node2D {
	color: Color = Color.WHITE;
	fillColor: Color = Color.WHITE;
}

class NodeWithSignal extends Node {
	readonly onHit: Signal<number> = signal<number>();
	readonly ready: Signal<void> = signal<void>();
}

// === h() tests ===

describe("h()", () => {
	it("creates a Node instance from a class", () => {
		const node = h(Node, null);
		expect(node).toBeInstanceOf(Node);
	});

	it("creates a typed subclass instance", () => {
		const node = h(TestNode, { speed: 42 });
		expect(node).toBeInstanceOf(TestNode);
		expect((node as TestNode).speed).toBe(42);
	});

	it("applies props to the node", () => {
		const node = h(TestNode, { speed: 100, label: "hero" }) as TestNode;
		expect(node.speed).toBe(100);
		expect(node.label).toBe("hero");
	});

	it("adds children to the node", () => {
		const child1 = new Node();
		const child2 = new Node();
		const parent = h(Node, null, child1, child2);
		expect((parent as Node).children).toHaveLength(2);
		expect((parent as Node).children[0]).toBe(child1);
		expect((parent as Node).children[1]).toBe(child2);
	});

	it("skips null and false children", () => {
		const child = new Node();
		const parent = h(Node, null, null, child, false, undefined);
		expect((parent as Node).children).toHaveLength(1);
		expect((parent as Node).children[0]).toBe(child);
	});

	it("flattens nested arrays of children", () => {
		const c1 = new Node();
		const c2 = new Node();
		const c3 = new Node();
		const parent = h(Node, null, [c1, [c2, c3]]);
		expect((parent as Node).children).toHaveLength(3);
	});

	it("fills ref.current with the created node", () => {
		const r = ref<TestNode>();
		h(TestNode, { ref: r, speed: 5 });
		expect(r.current).toBeInstanceOf(TestNode);
		expect(r.current?.speed).toBe(5);
	});

	it("maps key to node name", () => {
		// h() doesn't use a separate key param — key would be in props
		// but _createElement takes key as 4th arg, which is only used by jsx()
		// For h(), key isn't part of the API. Test via jsx() instead.
		const node = h(Node, { name: "myNode" });
		expect((node as Node).name).toBe("myNode");
	});
});

// === jsx() tests ===

describe("jsx()", () => {
	it("creates a Node instance from a class", () => {
		const node = jsx(Node, {});
		expect(node).toBeInstanceOf(Node);
	});

	it("extracts children from props.children", () => {
		const child = new Node();
		const parent = jsx(Node, { children: child }) as Node;
		expect(parent.children).toHaveLength(1);
		expect(parent.children[0]).toBe(child);
	});

	it("handles array children in props", () => {
		const c1 = new Node();
		const c2 = new Node();
		const parent = jsx(Node, { children: [c1, c2] }) as Node;
		expect(parent.children).toHaveLength(2);
	});

	it("maps key parameter to node name", () => {
		const node = jsx(Node, {}, "player") as Node;
		expect(node.name).toBe("player");
	});

	it("maps numeric key to node name", () => {
		const node = jsx(Node, {}, 42) as Node;
		expect(node.name).toBe("42");
	});

	it("applies props to the node", () => {
		const node = jsx(TestNode, { speed: 99 }) as TestNode;
		expect(node.speed).toBe(99);
	});

	it("fills ref.current", () => {
		const r = ref<TestNode>();
		jsx(TestNode, { ref: r });
		expect(r.current).toBeInstanceOf(TestNode);
	});

	it("skips children and key props during prop application", () => {
		const child = new Node();
		const node = jsx(TestNode, { children: child, key: "test", speed: 10 }) as TestNode;
		expect(node.speed).toBe(10);
		// children and key should not be set as properties on the node
		expect((node as Record<string, unknown>).key).toBeUndefined();
	});
});

// === Fragment tests ===

describe("Fragment", () => {
	it("returns children as a flat Node array via h()", () => {
		const c1 = new Node();
		const c2 = new Node();
		const result = h(Fragment, null, c1, c2);
		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(2);
		expect(result).toContain(c1);
		expect(result).toContain(c2);
	});

	it("returns children as a flat Node array via jsx()", () => {
		const c1 = new Node();
		const c2 = new Node();
		const result = jsx(Fragment, { children: [c1, c2] });
		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(2);
	});

	it("returns empty array when no children", () => {
		const result = h(Fragment, null);
		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
	});
});

// === Functional component tests ===

describe("functional components", () => {
	it("calls function and returns result", () => {
		const child = new Node();
		function MyComponent() {
			return child;
		}
		const result = h(MyComponent, null);
		expect(result).toBe(child);
	});

	it("passes merged props including children", () => {
		const spy = vi.fn(() => new Node());
		const child = new Node();
		h(spy, { foo: "bar" }, child);
		expect(spy).toHaveBeenCalledWith({ foo: "bar", children: [child] });
	});

	it("returns array from Fragment-like functional component", () => {
		function Multi() {
			return [new Node(), new Node()];
		}
		const result = h(Multi, null);
		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(2);
	});

	it("is detected via absence of IS_NODE_CLASS", () => {
		// Regular function — no IS_NODE_CLASS
		function PlainFn() {
			return new Node();
		}
		expect(IS_NODE_CLASS in PlainFn).toBe(false);

		// Node subclass — has IS_NODE_CLASS
		expect(IS_NODE_CLASS in TestNode).toBe(true);
	});
});

// === Coercion tests ===

describe("applyProp coercion", () => {
	it("coerces [x, y] tuple to Vec2", () => {
		const node = new Node2D();
		applyProp(node, "position", [100, 200]);
		expect(node.position).toBeInstanceOf(Vec2);
		expect(node.position.x).toBe(100);
		expect(node.position.y).toBe(200);
	});

	it("coerces hex string to Color for color-named props", () => {
		const node = new TestNode2D();
		applyProp(node, "color", "#ff0000");
		expect(node.color).toBeInstanceOf(Color);
		expect(node.color.r).toBeCloseTo(1);
		expect(node.color.g).toBeCloseTo(0);
		expect(node.color.b).toBeCloseTo(0);
	});

	it("coerces fillColor hex string to Color", () => {
		const node = new TestNode2D();
		applyProp(node, "fillColor", "#00ff00");
		expect(node.fillColor).toBeInstanceOf(Color);
		expect(node.fillColor.g).toBeCloseTo(1);
	});

	it("does not coerce strings for non-color props", () => {
		const node = new TestNode();
		applyProp(node, "label", "#ff0000");
		expect(node.label).toBe("#ff0000");
	});

	it("coerces number to Vec2 for scale", () => {
		const node = new Node2D();
		applyProp(node, "scale", 2);
		expect(node.scale).toBeInstanceOf(Vec2);
		expect(node.scale.x).toBe(2);
		expect(node.scale.y).toBe(2);
	});

	it("does not coerce number for non-scale props", () => {
		const node = new TestNode();
		applyProp(node, "speed", 42);
		expect(node.speed).toBe(42);
	});

	it("connects function to Signal property", () => {
		const node = new NodeWithSignal();
		const handler = vi.fn();
		applyProp(node, "onHit", handler);
		node.onHit.emit(10);
		expect(handler).toHaveBeenCalledWith(10);
	});

	it("connects function to void Signal property", () => {
		const node = new NodeWithSignal();
		const handler = vi.fn();
		applyProp(node, "ready", handler);
		node.ready.emit();
		expect(handler).toHaveBeenCalledOnce();
	});

	it("unwraps Ref to ref.current", () => {
		const target = new Node();
		const r = ref<Node>();
		r.current = target;

		const obj: Record<string, unknown> = { follow: null };
		applyProp(obj, "follow", r);
		expect(obj.follow).toBe(target);
	});

	it("assigns directly for unrecognized values", () => {
		const node = new TestNode();
		applyProp(node, "label", "hello");
		expect(node.label).toBe("hello");
	});
});

// === Scene exclusion ===

describe("Scene exclusion", () => {
	it("throws when Scene class is used in jsx()", () => {
		// Scene constructor requires a Game arg, so it can't be used as NodeConstructor
		// but the runtime guard should catch it regardless
		class TestScene extends Scene {}
		expect(() => {
			// Force the type to bypass compile-time checks
			jsx(TestScene as unknown as typeof Node, {});
		}).toThrow(/Cannot use Scene class/);
	});
});

// === Nested tree structure ===

describe("nested tree structure", () => {
	it("builds correct parent-child relationships", () => {
		const grandchild = h(Node, { name: "gc" }) as Node;
		const child = h(Node, { name: "child" }, grandchild) as Node;
		const root = h(Node, { name: "root" }, child) as Node;

		expect(root.children).toHaveLength(1);
		expect(root.children[0]).toBe(child);
		expect(child.children).toHaveLength(1);
		expect(child.children[0]).toBe(grandchild);
	});

	it("populates multiple refs in same tree", () => {
		const r1 = ref<Node>();
		const r2 = ref<Node>();
		const root = h(Node, null, h(Node, { ref: r1 }), h(Node, { ref: r2 })) as Node;

		expect(root.children).toHaveLength(2);
		expect(r1.current).toBe(root.children[0]);
		expect(r2.current).toBe(root.children[1]);
	});
});

// === Coercion integration via h()/jsx() ===

describe("coercion via h()/jsx()", () => {
	it("coerces position tuple in h()", () => {
		const node = h(Node2D, { position: [50, 100] }) as Node2D;
		expect(node.position.x).toBe(50);
		expect(node.position.y).toBe(100);
	});

	it("coerces scale number in jsx()", () => {
		const node = jsx(Node2D, { scale: 3 }) as Node2D;
		expect(node.scale.x).toBe(3);
		expect(node.scale.y).toBe(3);
	});

	it("auto-connects signal handler via h()", () => {
		const handler = vi.fn();
		const node = h(NodeWithSignal, { onHit: handler }) as NodeWithSignal;
		node.onHit.emit(5);
		expect(handler).toHaveBeenCalledWith(5);
	});
});
