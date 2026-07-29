import { describe, expectTypeOf, test } from "vitest";
import type { Input, InputConfig } from "./input.js";

declare const input: Input;

describe("InputConfig capture-scope options", () => {
	test("keyTarget accepts both an HTMLElement and the Document", () => {
		expectTypeOf<HTMLElement>().toMatchTypeOf<NonNullable<InputConfig["keyTarget"]>>();
		expectTypeOf<HTMLCanvasElement>().toMatchTypeOf<NonNullable<InputConfig["keyTarget"]>>();
		expectTypeOf<Document>().toMatchTypeOf<NonNullable<InputConfig["keyTarget"]>>();
	});

	test("keyTarget is optional (default: document)", () => {
		const config: InputConfig = { actions: {} };
		expectTypeOf(config.keyTarget).toEqualTypeOf<HTMLElement | Document | undefined>();
	});

	test("preventDefaultPolicy is a closed literal union", () => {
		expectTypeOf<InputConfig["preventDefaultPolicy"]>().toEqualTypeOf<
			"always" | "focused" | undefined
		>();
	});
});

describe("runtime enable switch", () => {
	test("enabled is a read-only boolean", () => {
		expectTypeOf(input.enabled).toEqualTypeOf<boolean>();
		// @ts-expect-error — `enabled` is getter-only; use setEnabled()
		input.enabled = false;
	});

	test("setEnabled takes a boolean and returns void", () => {
		expectTypeOf(input.setEnabled).toEqualTypeOf<(enabled: boolean) => void>();
	});
});
