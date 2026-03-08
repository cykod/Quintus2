import { Node2D, Scene } from "@quintus/core";
import { describe, expect, it } from "vitest";
import { attachDebug } from "./headless-debug.js";

function createTestGame() {
	const canvas = document.createElement("canvas");
	const { Game } = require("@quintus/core") as typeof import("@quintus/core");
	return new Game({ width: 320, height: 240, canvas, renderer: null });
}

describe("attachDebug", () => {
	it("returns a command executor function", () => {
		const game = createTestGame();
		class TestScene extends Scene {
			onReady() {
				const n = new Node2D();
				n.name = "Player";
				n.position._set(100, 200);
				this.add(n);
			}
		}
		game.start(TestScene);
		const cmd = attachDebug(game);

		expect(typeof cmd).toBe("function");
	});

	it("tree command returns formatted tree", () => {
		const game = createTestGame();
		class TestScene extends Scene {
			onReady() {
				const n = new Node2D();
				n.name = "Hero";
				this.add(n);
			}
		}
		game.start(TestScene);
		const cmd = attachDebug(game);

		const result = cmd("tree");
		expect(result.ok).toBe(true);
		expect(result.output).toContain("Hero");
	});

	it("step advances frames", () => {
		const game = createTestGame();
		game.start(Scene);
		const cmd = attachDebug(game);

		const r1 = cmd("status");
		expect(r1.output).toContain("Frame: 0");

		cmd("step 5");
		const r2 = cmd("status");
		expect(r2.output).toContain("Frame: 5");
	});

	it("inspect returns node data", () => {
		const game = createTestGame();
		class TestScene extends Scene {
			onReady() {
				const n = new Node2D();
				n.name = "Target";
				n.position._set(42, 84);
				this.add(n);
			}
		}
		game.start(TestScene);
		const cmd = attachDebug(game);

		const result = cmd("inspect Target");
		expect(result.ok).toBe(true);
		const data = JSON.parse(result.output);
		expect(data.name).toBe("Target");
	});

	it("query finds nodes by name", () => {
		const game = createTestGame();
		class TestScene extends Scene {
			onReady() {
				for (let i = 0; i < 3; i++) {
					const n = new Node2D();
					n.tag("item");
					this.add(n);
				}
			}
		}
		game.start(TestScene);
		const cmd = attachDebug(game);

		const result = cmd("query item");
		expect(result.ok).toBe(true);
		expect(result.output).toContain("Node2D");
	});

	it("unknown command returns error", () => {
		const game = createTestGame();
		game.start(Scene);
		const cmd = attachDebug(game);

		const result = cmd("foobar");
		expect(result.ok).toBe(false);
	});
});
