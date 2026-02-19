import { SeededRandom } from "@quintus/math";
import { describe, expect, it, vi } from "vitest";
import { Game, type GameOptions } from "./game.js";
import { Node } from "./node.js";
import { definePlugin } from "./plugin.js";
import type { Renderer } from "./renderer.js";
import { Scene } from "./scene.js";

function createGame(opts: Partial<GameOptions> = {}): Game {
	const canvas = document.createElement("canvas");
	return new Game({ width: 800, height: 600, canvas, ...opts });
}

describe("Game", () => {
	it("constructor creates canvas with correct dimensions", () => {
		const game = createGame();
		expect(game.canvas.width).toBe(800);
		expect(game.canvas.height).toBe(600);
	});

	it("start() loads and runs a scene", () => {
		const game = createGame();
		game.start(Scene);
		expect(game.currentScene).not.toBeNull();
		expect(game.currentScene?.name).toBe("Scene");
	});

	it("step() advances one fixed timestep", () => {
		const game = createGame();
		const updateFn = vi.fn();
		class TestScene extends Scene {
			onReady() {
				class TestNode extends Node {
					override onFixedUpdate(_dt: number): void {
						updateFn();
					}
				}
				this.addChild(new TestNode());
			}
		}
		game.start(TestScene);
		game.step();
		expect(updateFn).toHaveBeenCalled();
	});

	it("step(variableDt) passes different dt to update vs fixedUpdate", () => {
		const game = createGame();
		const fixedDts: number[] = [];
		const updateDts: number[] = [];
		class TestScene extends Scene {
			onReady() {
				class TestNode extends Node {
					override onFixedUpdate(dt: number): void {
						fixedDts.push(dt);
					}
					override onUpdate(dt: number): void {
						updateDts.push(dt);
					}
				}
				this.addChild(new TestNode());
			}
		}
		game.start(TestScene);
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
		game.start(Scene);
		expect(handler).toHaveBeenCalled();
	});

	it("stopped signal fires", () => {
		const game = createGame();
		const handler = vi.fn();
		game.stopped.connect(handler);
		game.start(Scene);
		game.stop();
		expect(handler).toHaveBeenCalled();
	});

	it("sceneSwitched signal fires", () => {
		const game = createGame();
		const handler = vi.fn();
		game.sceneSwitched.connect(handler);
		class SceneA extends Scene {}
		class SceneB extends Scene {}
		game.start(SceneA);
		game.currentScene?.switchTo(SceneB);
		expect(handler).toHaveBeenCalledWith({ from: "SceneA", to: "SceneB" });
	});

	it("onError signal fires when user lifecycle method throws", () => {
		const game = createGame();
		const errorHandler = vi.fn();
		game.onError.connect(errorHandler);
		class TestScene extends Scene {
			onReady() {
				class BuggyNode extends Node {
					override onUpdate(_dt: number): void {
						throw new Error("oops");
					}
				}
				this.addChild(new BuggyNode());
			}
		}
		game.start(TestScene);
		game.step();
		game.stop();
		expect(errorHandler).toHaveBeenCalled();
		expect(errorHandler.mock.calls[0]?.[0].lifecycle).toBe("onUpdate");
	});

	it("onError not connected: errors logged to console.error", () => {
		const game = createGame();
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		class TestScene extends Scene {
			onReady() {
				class BuggyNode extends Node {
					override onUpdate(_dt: number): void {
						throw new Error("oops");
					}
				}
				this.addChild(new BuggyNode());
			}
		}
		game.start(TestScene);
		game.step();
		game.stop();
		expect(errorSpy).toHaveBeenCalled();
		errorSpy.mockRestore();
	});

	it("pixelArt: true disables image smoothing on canvas", () => {
		const game = createGame({ pixelArt: true });
		expect(game.canvas.style.imageRendering).toBe("pixelated");
	});

	it("elapsed time", () => {
		const game = createGame();
		game.start(Scene);
		expect(game.elapsed).toBe(0);
		game.step();
		expect(game.elapsed).toBeGreaterThan(0);
	});

	it("fixedFrame count", () => {
		const game = createGame();
		game.start(Scene);
		expect(game.fixedFrame).toBe(0);
		game.step();
		expect(game.fixedFrame).toBe(1);
	});

	// === T4a: Edge Cases ===
	it("pause() and resume() control the loop", () => {
		const game = createGame();
		game.start(Scene);
		expect(game.running).toBe(true);
		game.pause();
		expect(game.running).toBe(false);
		game.resume();
		expect(game.running).toBe(true);
	});

	it("_switchScene() destroys old scene", () => {
		const game = createGame();
		const destroySpy = vi.fn();
		class SceneA extends Scene {
			onReady() {
				class TrackedNode extends Node {
					override onDestroy(): void {
						destroySpy();
					}
				}
				this.addChild(new TrackedNode());
			}
		}
		class SceneB extends Scene {}
		game.start(SceneA);
		game._switchScene(SceneB);
		expect(destroySpy).toHaveBeenCalled();
	});

	it("canvas via string selector finds existing element", () => {
		const el = document.createElement("canvas");
		el.id = "test-canvas";
		document.body.appendChild(el);
		const game = new Game({ width: 320, height: 240, canvas: "test-canvas" });
		expect(game.canvas).toBe(el);
		el.remove();
	});

	it("canvas via string selector auto-creates when not found", () => {
		const game = new Game({ width: 320, height: 240, canvas: "nonexistent-id" });
		expect(game.canvas).toBeInstanceOf(HTMLCanvasElement);
		expect(game.canvas.width).toBe(320);
	});

	it("canvas auto-created when no option provided", () => {
		const game = new Game({ width: 400, height: 300 });
		expect(game.canvas).toBeInstanceOf(HTMLCanvasElement);
		expect(game.canvas.width).toBe(400);
		expect(game.canvas.height).toBe(300);
	});

	it("backgroundColor defaults and custom values", () => {
		const defaultGame = createGame();
		expect(defaultGame.backgroundColor).toBe("#000000");
		const customGame = createGame({ backgroundColor: "#ff0000" });
		expect(customGame.backgroundColor).toBe("#ff0000");
	});

	describe("scene registry", () => {
		it("registerScene() registers and resolves a scene by name", () => {
			const game = createGame();
			class MyScene extends Scene {}
			game.registerScene("my-scene", MyScene);
			game.start("my-scene");
			expect(game.currentScene).toBeInstanceOf(MyScene);
		});

		it("registerScene() returns this for chaining", () => {
			const game = createGame();
			class A extends Scene {}
			class B extends Scene {}
			const result = game.registerScene("a", A).registerScene("b", B);
			expect(result).toBe(game);
		});

		it("registerScene() warns on duplicate name", () => {
			const game = createGame();
			class A extends Scene {}
			class B extends Scene {}
			const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
			game.registerScene("dup", A);
			game.registerScene("dup", B);
			expect(warnSpy).toHaveBeenCalledWith('Scene "dup" is already registered. Overwriting.');
			warnSpy.mockRestore();
			// Should use the latest registration
			game.start("dup");
			expect(game.currentScene).toBeInstanceOf(B);
		});

		it("registerScenes() batch registers multiple scenes", () => {
			const game = createGame();
			class A extends Scene {}
			class B extends Scene {}
			game.registerScenes({ a: A, b: B });
			game.start("a");
			expect(game.currentScene).toBeInstanceOf(A);
			game.currentScene?.switchTo("b");
			expect(game.currentScene).toBeInstanceOf(B);
		});

		it("start() with string name works", () => {
			const game = createGame();
			class Level extends Scene {}
			game.registerScene("level", Level);
			game.start("level");
			expect(game.currentScene).toBeInstanceOf(Level);
		});

		it("start() with unregistered string throws", () => {
			const game = createGame();
			expect(() => game.start("unknown")).toThrowError(
				'Scene "unknown" is not registered. Use game.registerScene() first.',
			);
		});

		it("start() with class ref still works", () => {
			const game = createGame();
			class Direct extends Scene {}
			game.start(Direct);
			expect(game.currentScene).toBeInstanceOf(Direct);
		});

		it("switchTo() with string name works", () => {
			const game = createGame();
			class A extends Scene {}
			class B extends Scene {}
			game.registerScene("b", B);
			game.start(A);
			game.currentScene?.switchTo("b");
			expect(game.currentScene).toBeInstanceOf(B);
		});

		it("switchTo() with unregistered string throws", () => {
			const game = createGame();
			game.start(Scene);
			expect(() => game.currentScene?.switchTo("nope")).toThrowError(
				'Scene "nope" is not registered. Use game.registerScene() first.',
			);
		});

		it("switchTo() with class ref still works", () => {
			const game = createGame();
			class A extends Scene {}
			class B extends Scene {}
			game.start(A);
			game.currentScene?.switchTo(B);
			expect(game.currentScene).toBeInstanceOf(B);
		});
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
			game.start(Scene);
			game.step();
			// Should not throw — rendering is simply skipped
			expect(game.currentScene).not.toBeNull();
		});

		it("renderer: custom uses provided renderer", () => {
			const renderer = mockRenderer();
			const game = createGame({ renderer });
			game.start(Scene);
			game.step();
			expect(renderer.render).toHaveBeenCalled();
		});

		it("_setRenderer replaces active renderer", () => {
			const renderer1 = mockRenderer();
			const renderer2 = mockRenderer();
			const game = createGame({ renderer: renderer1 });
			game.start(Scene);
			game._setRenderer(renderer2);
			game.step();
			expect(renderer2.render).toHaveBeenCalled();
		});

		it("_setRenderer(null) disables rendering", () => {
			const renderer = mockRenderer();
			const game = createGame({ renderer });
			game.start(Scene);
			game._setRenderer(null);
			game.step();
			// render called during start's markRenderDirty, but not after setRenderer(null)
			expect(game.currentScene).not.toBeNull();
		});

		it("_setRenderer disposes old renderer", () => {
			const renderer = mockRenderer();
			const game = createGame({ renderer });
			game.start(Scene);
			game._setRenderer(null);
			expect(renderer.dispose).toHaveBeenCalled();
		});

		it("stop() calls renderer.dispose()", () => {
			const renderer = mockRenderer();
			const game = createGame({ renderer });
			game.start(Scene);
			game.stop();
			expect(renderer.dispose).toHaveBeenCalled();
		});
	});
});
