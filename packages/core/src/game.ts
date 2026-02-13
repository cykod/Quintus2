import { SeededRandom } from "@quintus/math";
import { AssetLoader } from "./asset-loader.js";
import { Canvas2DRenderer } from "./canvas2d-renderer.js";
import { GameLoop } from "./game-loop.js";
import type { Node } from "./node.js";
import type { Plugin } from "./plugin.js";
import type { SceneDefinition, SceneSetupFn } from "./scene.js";
import { Scene } from "./scene.js";
import { type Signal, signal } from "./signal.js";

export interface GameOptions {
	/** Canvas width in pixels. */
	width: number;
	/** Canvas height in pixels. */
	height: number;
	/** How to fit the canvas to the page. Default: "fit". */
	scale?: "fit" | "fixed";
	/** Enable pixel-art rendering (disables image smoothing). Default: false. */
	pixelArt?: boolean;
	/** Canvas background color. Default: "#000000". */
	backgroundColor?: string;
	/** Target canvas element ID or HTMLCanvasElement. Default: auto-create. */
	canvas?: string | HTMLCanvasElement;
	/** RNG seed for deterministic simulation. Default: Date.now(). */
	seed?: number;
	/** Fixed timestep in seconds. Default: 1/60. */
	fixedDeltaTime?: number;
}

export class Game {
	// === Config ===
	readonly width: number;
	readonly height: number;
	readonly canvas: HTMLCanvasElement;
	readonly pixelArt: boolean;
	readonly backgroundColor: string;

	// === State ===
	private _currentScene: Scene | null = null;
	private _scenes = new Map<string, SceneSetupFn>();
	private _plugins = new Map<string, Plugin>();

	/** Deterministic random number generator. */
	readonly random: SeededRandom;

	/** Asset loader. */
	readonly assets: AssetLoader;

	/** Fixed delta time (1/60 by default). */
	readonly fixedDeltaTime: number;

	// === Internal ===
	private readonly loop: GameLoop;
	private renderer: Canvas2DRenderer | null = null;

	// === Signals ===
	readonly started: Signal<void> = signal<void>();
	readonly stopped: Signal<void> = signal<void>();
	readonly sceneSwitched: Signal<{ from: string | null; to: string }> = signal();
	readonly onError: Signal<{ node: Node; lifecycle: string; error: unknown }> = signal();

	constructor(options: GameOptions) {
		this.width = options.width;
		this.height = options.height;
		this.pixelArt = options.pixelArt ?? false;
		this.backgroundColor = options.backgroundColor ?? "#000000";
		this.fixedDeltaTime = options.fixedDeltaTime ?? 1 / 60;

		// Resolve or create canvas
		if (typeof options.canvas === "string") {
			const el = document.getElementById(options.canvas);
			if (!el || !(el instanceof HTMLCanvasElement)) {
				this.canvas = document.createElement("canvas");
				document.body.appendChild(this.canvas);
			} else {
				this.canvas = el;
			}
		} else if (options.canvas instanceof HTMLCanvasElement) {
			this.canvas = options.canvas;
		} else {
			this.canvas = document.createElement("canvas");
			document.body.appendChild(this.canvas);
		}
		this.canvas.width = this.width;
		this.canvas.height = this.height;

		if (this.pixelArt) {
			this.canvas.style.imageRendering = "pixelated";
		}

		// RNG
		this.random = new SeededRandom(options.seed ?? Date.now());

		// Asset loader
		this.assets = new AssetLoader();

		// Renderer
		this.renderer = new Canvas2DRenderer(
			this.canvas,
			this.width,
			this.height,
			this.backgroundColor,
			this.assets,
		);

		// Game loop
		this.loop = new GameLoop(
			{
				fixedDeltaTime: this.fixedDeltaTime,
				maxAccumulator: 0.25,
			},
			{
				fixedUpdate: (dt) => this._fixedUpdate(dt),
				update: (dt) => this._update(dt),
				render: () => this._render(),
				cleanup: () => this._cleanup(),
			},
		);
	}

	// === Scene Management ===
	get currentScene(): Scene | null {
		return this._currentScene;
	}

	get running(): boolean {
		return this.loop.running;
	}

	get elapsed(): number {
		return this.loop.elapsed;
	}

	get fixedFrame(): number {
		return this.loop.fixedFrame;
	}

	/** Register a named scene setup function. */
	scene(name: string, setup: SceneSetupFn): this {
		this._scenes.set(name, setup);
		return this;
	}

	/** Start the game loop with the given scene. */
	start(sceneNameOrDef: string | SceneDefinition): void {
		if (typeof sceneNameOrDef === "string") {
			this._loadScene(sceneNameOrDef);
		} else {
			this._scenes.set(sceneNameOrDef.name, sceneNameOrDef.setup);
			this._loadScene(sceneNameOrDef.name);
		}
		this.loop.start();
		this.started.emit();
	}

	// === Game Loop Control ===
	pause(): void {
		this.loop.stop();
	}

	resume(): void {
		this.loop.start();
	}

	/**
	 * Advance the game by one fixed timestep. For headless/testing use.
	 * @param variableDt - Optional delta time for update(). Defaults to fixedDeltaTime.
	 */
	step(variableDt?: number): void {
		this.loop.step(variableDt);
	}

	stop(): void {
		this.loop.stop();
		this.stopped.emit();
	}

	// === Plugins ===
	use(plugin: Plugin): this {
		if (this._plugins.has(plugin.name)) {
			console.warn(`Plugin "${plugin.name}" is already installed.`);
			return this;
		}
		this._plugins.set(plugin.name, plugin);
		plugin.install(this);
		return this;
	}

	hasPlugin(name: string): boolean {
		return this._plugins.has(name);
	}

	// === Internal: Scene Loading ===
	/** @internal */
	_switchScene(name: string, setup?: SceneSetupFn): void {
		if (setup) {
			this._scenes.set(name, setup);
		}
		const fromName = this._currentScene?.name ?? null;

		// Destroy old scene
		if (this._currentScene) {
			this._currentScene._destroyAll();
		}

		this._loadScene(name);
		this.sceneSwitched.emit({ from: fromName, to: name });

		// Mark render list dirty for new scene
		this.renderer?.markRenderDirty();
	}

	private _loadScene(name: string): void {
		const setup = this._scenes.get(name);
		if (!setup) {
			throw new Error(`Scene "${name}" is not registered. Call game.scene("${name}", fn) first.`);
		}

		const scene = new Scene(name, this);
		this._currentScene = scene;
		setup(scene);

		// Mark render list dirty
		this.renderer?.markRenderDirty();
	}

	// === Internal: Frame Callbacks ===
	private _fixedUpdate(dt: number): void {
		this._currentScene?._walkFixedUpdate(dt);
	}

	private _update(dt: number): void {
		this._currentScene?._walkUpdate(dt);
	}

	private _render(): void {
		if (this._currentScene && this.renderer) {
			this.renderer.render(this._currentScene);
		}
	}

	private _cleanup(): void {
		this._currentScene?._processDestroyQueue();
	}
}
