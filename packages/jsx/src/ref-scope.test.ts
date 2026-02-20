import { Node } from "@quintus/core";
import { describe, expect, it } from "vitest";
import { queueDollarRef, registerStringRef, resolveDollarRefs } from "./ref-scope.js";

describe("ref-scope", () => {
	it("resolves queued dollar refs against registered string refs", () => {
		const player = new Node();
		player.name = "player";
		registerStringRef("player", player);

		const camera: Record<string, unknown> = { follow: null };
		queueDollarRef(camera, "follow", "player");

		resolveDollarRefs();

		expect(camera.follow).toBe(player);
	});

	it("throws on unresolved dollar ref with available ref names", () => {
		const player = new Node();
		registerStringRef("player", player);
		const map = new Node();
		registerStringRef("map", map);

		const camera: Record<string, unknown> = { follow: null };
		queueDollarRef(camera, "follow", "plyer");

		expect(() => resolveDollarRefs()).toThrow(
			/Unresolved dollar ref "\$plyer" on "follow".*"player".*"map"/,
		);
	});

	it("clears maps after resolution", () => {
		const player = new Node();
		registerStringRef("player", player);

		const obj: Record<string, unknown> = { target: null };
		queueDollarRef(obj, "target", "player");

		resolveDollarRefs();
		expect(obj.target).toBe(player);

		// Second call: "player" is no longer registered, so a new dollar ref would fail
		const obj2: Record<string, unknown> = { target: null };
		queueDollarRef(obj2, "target", "player");

		expect(() => resolveDollarRefs()).toThrow(/Unresolved dollar ref "\$player"/);
	});

	it("resolves multiple dollar refs from a single build", () => {
		const player = new Node();
		const map = new Node();
		registerStringRef("player", player);
		registerStringRef("map", map);

		const camera: Record<string, unknown> = { follow: null, bounds: null };
		queueDollarRef(camera, "follow", "player");
		queueDollarRef(camera, "bounds", "map");

		resolveDollarRefs();

		expect(camera.follow).toBe(player);
		expect(camera.bounds).toBe(map);
	});
});
