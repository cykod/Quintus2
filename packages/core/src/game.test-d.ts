import { describe, expectTypeOf, test } from "vitest";
import type { GameOptions } from "./game.js";

describe("GameOptions.scale", () => {
	test("is a closed union of the four supported modes", () => {
		expectTypeOf<GameOptions["scale"]>().toEqualTypeOf<
			"fit" | "fixed" | "fill" | "fit-parent" | undefined
		>();
	});

	test("accepts 'fit-parent'", () => {
		const opts: GameOptions = { width: 800, height: 500, scale: "fit-parent" };
		void opts;
	});

	test("rejects an unknown mode", () => {
		// @ts-expect-error — "parent" is not a scale mode; the union stays closed.
		const opts: GameOptions = { width: 800, height: 500, scale: "parent" };
		void opts;
	});
});
