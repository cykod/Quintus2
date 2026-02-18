import { describe, expect, it } from "vitest";
import { Game } from "./game.js";
import { Scene } from "./scene.js";
import { signal } from "./signal.js";

function createGame(debug: boolean): Game {
	const canvas = document.createElement("canvas");
	return new Game({ width: 320, height: 240, canvas, renderer: null, debug });
}

describe("Game.watchSignal", () => {
	it("logs signal emissions in debug mode", () => {
		const game = createGame(true);
		class S extends Scene {}
		game.start(S);

		const testSignal = signal<void>();
		game.watchSignal(testSignal, "Player.died");

		testSignal.emit();

		const events = game.debugLog.peek({ category: "signal" });
		expect(events.length).toBe(1);
		expect(events[0]?.message).toBe("Player.died emitted");
		expect(events[0]?.data).toBeUndefined();

		game.stop();
	});

	it("includes payload in data", () => {
		const game = createGame(true);
		class S extends Scene {}
		game.start(S);

		const healthChanged = signal<{ current: number; max: number }>();
		game.watchSignal(healthChanged, "Player.healthChanged");

		healthChanged.emit({ current: 3, max: 5 });

		const events = game.debugLog.peek({ category: "signal" });
		expect(events.length).toBe(1);
		expect(events[0]?.data).toEqual({ payload: { current: 3, max: 5 } });

		game.stop();
	});

	it("disconnect stops logging", () => {
		const game = createGame(true);
		class S extends Scene {}
		game.start(S);

		const testSignal = signal<void>();
		const disconnect = game.watchSignal(testSignal, "test");

		testSignal.emit();
		expect(game.debugLog.peek({ category: "signal" }).length).toBe(1);

		disconnect();

		testSignal.emit();
		// Still only 1 event — the second emit was not logged
		expect(game.debugLog.peek({ category: "signal" }).length).toBe(1);

		game.stop();
	});

	it("returns no-op when debug is off", () => {
		const game = createGame(false);
		class S extends Scene {}
		game.start(S);

		const testSignal = signal<void>();
		const disconnect = game.watchSignal(testSignal, "test");

		testSignal.emit();

		const events = game.debugLog.peek({ category: "signal" });
		expect(events.length).toBe(0);

		// disconnect is a no-op function, should not throw
		disconnect();

		game.stop();
	});
});
