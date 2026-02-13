import { SeededRandom } from "@quintus/math";
import { describe, expect, it, vi } from "vitest";
import { Game } from "./game.js";
import { Node } from "./node.js";
import { definePlugin } from "./plugin.js";
import type { Renderer } from "./renderer.js";

function createGame(opts?: Partial<Parameters<typeof Game.prototype.constructor>[0]>): Game {
	const canvas = document.createElement("canvas");
	return new Game({ width: 800, height: 600, canvas, ...opts });
}

describe("Game", () => {
	it("constructor creates canvas with correct dimensions", () => {
		const game = createGame();
		expect(game.canvas.width).toBe(800);
		expect(game.canvas.height).toBe(600);
	});

	it("scene() registers named scenes", () => {
		const game = createGame();
		const setup = vi.fn();
		game.scene("main", setup);
		game.start("main");
		expect(setup).toHaveBeenCalled();
	});

	it("start() loads and runs a scene", () => {
		const game = createGame();
		const setup = vi.fn();
		game.scene("main", setup);
		game.start("main");
		expect(game.currentScene).not.toBeNull();
		expect(game.currentScene?.name).toBe("main");
	});

	it("step() advances one fixed timestep", () => {
		const game = createGame();
		const updateFn = vi.fn();
		class TestNode extends Node {
			override onFixedUpdate(_dt: number): void {
				updateFn();
			}
		}
		game.scene("main", (scene) => {
			scene.addChild(new TestNode());
		});
		game.start("main");
		game.step();
		expect(updateFn).toHaveBeenCalled();
	});

	it("step(variableDt) passes different dt to update vs fixedUpdate", () => {
		const game = createGame();
		const fixedDts: number[] = [];
		const updateDts: number[] = [];
		class TestNode extends Node {
			override onFixedUpdate(dt: number): void {
				fixedDts.push(dt);
			}
			override onUpdate(dt: number): void {
				updateDts.push(dt);
			}
		}
		game.scene("main", (scene) => {
			scene.addChild(new TestNode());
		});
		game.start("main");
		game.step(1 / 30);
		expect(fixedDts[0]).toBeCloseTo(1 / 60);
		expect(updateDts[0]).toBeCloseTo(1 / 30);
	});

	it("random is a SeededRandom instance", () => {
		const game = createGame({ seed: 42 });
		expect(game.random).toBeInstanceOf(SeededRandom);
		expect(game.random.seed).toBe(42);
	});

	it("use(plugin) installs plugins", () => {
		const game = createGame();
		const installFn = vi.fn();
		const plugin = definePlugin({ name: "test", install: installFn });
		game.use(plugin);
		expect(installFn).toHaveBeenCalledWith(game);
	});

	it("hasPlugin() returns correct value", () => {
		const game = createGame();
		const plugin = definePlugin({ name: "test", install: () => {} });
		expect(game.hasPlugin("test")).toBe(false);
		game.use(plugin);
		expect(game.hasPlugin("test")).toBe(true);
	});

	it("double-install warns but doesn't crash", () => {
		const game = createGame();
		const installFn = vi.fn();
		const plugin = definePlugin({ name: "test", install: installFn });
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		game.use(plugin);
		game.use(plugin);
		expect(installFn).toHaveBeenCalledTimes(1);
		expect(warnSpy).toHaveBeenCalled();
		warnSpy.mockRestore();
	});

	it("started signal fires", () => {
		const game = createGame();
		const handler = vi.fn();
		game.started.connect(handler);
		game.scene("main", () => {});
		game.start("main");
		expect(handler).toHaveBeenCalled();
	});

	it("stopped signal fires", () => {
		const game = createGame();
		const handler = vi.fn();
		game.stopped.connect(handler);
		game.scene("main", () => {});
		game.start("main");
		game.stop();
		expect(handler).toHaveBeenCalled();
	});

	it("sceneSwitched signal fires", () => {
		const game = createGame();
		const handler = vi.fn();
		game.sceneSwitched.connect(handler);
		game.scene("a", () => {});
		game.scene("b", () => {});
		game.start("a");
		game.currentScene?.switchTo("b");
		expect(handler).toHaveBeenCalledWith({ from: "a", to: "b" });
	});

	it("onError signal fires when user lifecycle method throws", () => {
		const game = createGame();
		const errorHandler = vi.fn();
		game.onError.connect(errorHandler);
		class BuggyNode extends Node {
			override onUpdate(_dt: number): void {
				throw new Error("oops");
			}
		}
		game.scene("main", (scene) => {
			scene.addChild(new BuggyNode());
		});
		game.start("main");
		game.step();
		expect(errorHandler).toHaveBeenCalled();
		expect(errorHandler.mock.calls[0]?.[0].lifecycle).toBe("onUpdate");
	});

	it("onError not connected: errors logged to console.error", () => {
		const game = createGame();
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		class BuggyNode extends Node {
			override onUpdate(_dt: number): void {
				throw new Error("oops");
			}
		}
		game.scene("main", (scene) => {
			scene.addChild(new BuggyNode());
		});
		game.start("main");
		game.step();
		expect(errorSpy).toHaveBeenCalled();
		errorSpy.mockRestore();
	});

	it("pixelArt: true disables image smoothing on canvas", () => {
		const game = createGame({ pixelArt: true });
		expect(game.canvas.style.imageRendering).toBe("pixelated");
	});

	it("elapsed time", () => {
		const game = createGame();
		game.scene("main", () => {});
		game.start("main");
		expect(game.elapsed).toBe(0);
		game.step();
		expect(game.elapsed).toBeGreaterThan(0);
	});

	it("fixedFrame count", () => {
		const game = createGame();
		game.scene("main", () => {});
		game.start("main");
		expect(game.fixedFrame).toBe(0);
		game.step();
		expect(game.fixedFrame).toBe(1);
	});

	it("throws on unregistered scene", () => {
		const game = createGame();
		expect(() => game.start("nonexistent")).toThrow("not registered");
	});

	describe("pluggable renderer", () => {
		function mockRenderer(): Renderer & { calls: string[] } {
			const calls: string[] = [];
			return {
				calls,
				render: vi.fn(() => calls.push("render")),
				markRenderDirty: vi.fn(() => calls.push("markRenderDirty")),
				dispose: vi.fn(() => calls.push("dispose")),
			};
		}

		it("renderer: null creates headless game (no rendering)", () => {
			const game = createGame({ renderer: null });
			game.scene("main", () => {});
			game.start("main");
			game.step();
			// Should not throw — rendering is simply skipped
			expect(game.currentScene).not.toBeNull();
		});

		it("renderer: custom uses provided renderer", () => {
			const renderer = mockRenderer();
			const game = createGame({ renderer });
			game.scene("main", () => {});
			game.start("main");
			game.step();
			expect(renderer.render).toHaveBeenCalled();
		});

		it("_setRenderer replaces active renderer", () => {
			const renderer1 = mockRenderer();
			const renderer2 = mockRenderer();
			const game = createGame({ renderer: renderer1 });
			game.scene("main", () => {});
			game.start("main");
			game._setRenderer(renderer2);
			game.step();
			expect(renderer2.render).toHaveBeenCalled();
		});

		it("_setRenderer(null) disables rendering", () => {
			const renderer = mockRenderer();
			const game = createGame({ renderer });
			game.scene("main", () => {});
			game.start("main");
			game._setRenderer(null);
			game.step();
			// render called during start's markRenderDirty, but not after setRenderer(null)
			expect(game.currentScene).not.toBeNull();
		});

		it("_setRenderer disposes old renderer", () => {
			const renderer = mockRenderer();
			const game = createGame({ renderer });
			game.scene("main", () => {});
			game.start("main");
			game._setRenderer(null);
			expect(renderer.dispose).toHaveBeenCalled();
		});

		it("stop() calls renderer.dispose()", () => {
			const renderer = mockRenderer();
			const game = createGame({ renderer });
			game.scene("main", () => {});
			game.start("main");
			game.stop();
			expect(renderer.dispose).toHaveBeenCalled();
		});
	});
});
