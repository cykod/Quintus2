import { Game, Scene } from "@quintus/core";
import { describe, expect, it } from "vitest";
import type { Input } from "./input.js";
import { getInput, InputPlugin } from "./input-plugin.js";

function createGame(debug: boolean): Game {
	const canvas = document.createElement("canvas");
	return new Game({ width: 320, height: 240, canvas, renderer: null, debug });
}

describe("Input debug instrumentation", () => {
	it("logs action press in debug mode", () => {
		const game = createGame(true);
		game.use(InputPlugin({ actions: { jump: ["Space"] } }));
		class S extends Scene {}
		game.start(S);

		const input = getInput(game) as Input;
		input.inject("jump", true);
		game.step();

		const events = game.debugLog.peek({ category: "input" });
		const pressEvent = events.find(
			(e) => e.message.includes("jump") && e.message.includes("injected"),
		);
		expect(pressEvent).toBeDefined();
		expect(pressEvent?.category).toBe("input");

		game.stop();
	});

	it("logs action release in debug mode", () => {
		const game = createGame(true);
		game.use(InputPlugin({ actions: { jump: ["Space"] } }));
		class S extends Scene {}
		game.start(S);

		const input = getInput(game) as Input;
		input.inject("jump", true);
		game.step();

		input.inject("jump", false);
		game.step();

		const events = game.debugLog.peek({ category: "input" });
		const releaseEvent = events.find(
			(e) => e.message.includes("jump") && e.message.includes("released"),
		);
		expect(releaseEvent).toBeDefined();
		expect(releaseEvent?.category).toBe("input");

		game.stop();
	});

	it("logs keyboard press/release with 'pressed'/'released' messages", () => {
		const game = createGame(true);
		game.use(InputPlugin({ actions: { jump: ["Space"] } }));
		class S extends Scene {}
		game.start(S);

		const input = getInput(game) as Input;
		// Simulate keyboard press via buffer (not injection)
		input._bufferKeyPress("Space");
		game.step();

		const events = game.debugLog.peek({ category: "input" });
		const pressEvent = events.find((e) => e.message === "jump pressed");
		expect(pressEvent).toBeDefined();

		// Now release
		input._bufferKeyRelease("Space");
		game.step();

		const allEvents = game.debugLog.peek({ category: "input" });
		const releaseEvent = allEvents.find((e) => e.message === "jump released");
		expect(releaseEvent).toBeDefined();

		game.stop();
	});

	it("does not log when debug is off", () => {
		const game = createGame(false);
		game.use(InputPlugin({ actions: { jump: ["Space"] } }));
		class S extends Scene {}
		game.start(S);

		const input = getInput(game) as Input;
		input.inject("jump", true);
		game.step();

		const events = game.debugLog.peek({ category: "input" });
		expect(events.length).toBe(0);

		game.stop();
	});
});
