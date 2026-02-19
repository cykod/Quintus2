import { Node } from "@quintus/core";
import { describe, expect, it } from "vitest";
import { isRef, ref } from "./ref.js";

describe("ref", () => {
	it("starts with current === null", () => {
		const r = ref<Node>();
		expect(r.current).toBeNull();
	});

	it("allows setting current to a Node", () => {
		const r = ref<Node>();
		const node = new Node();
		r.current = node;
		expect(r.current).toBe(node);
	});
});

describe("isRef", () => {
	it("returns true for ref objects", () => {
		expect(isRef(ref())).toBe(true);
	});

	it("returns false for null", () => {
		expect(isRef(null)).toBe(false);
	});

	it("returns false for undefined", () => {
		expect(isRef(undefined)).toBe(false);
	});

	it("returns false for plain objects", () => {
		expect(isRef({ current: null })).toBe(false);
	});

	it("returns false for primitives", () => {
		expect(isRef(42)).toBe(false);
		expect(isRef("hello")).toBe(false);
	});
});
