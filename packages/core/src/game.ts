import { SeededRandom } from "@quintus/math";
import { AssetLoader } from "./asset-loader.js";
import { Canvas2DRenderer } from "./canvas2d-renderer.js";
import { GameLoop } from "./game-loop.js";
import type { Node } from "./node.js";
import type { Plugin } from "./plugin.js";
import type { Renderer } from "./renderer.js";
import type { Scene, SceneConstructor } from "./scene.js";
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
	/** Custom renderer. Pass `null` for headless (no rendering). Default: Canvas2DRenderer. */
	renderer?: Renderer | null;
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
	private _plugins = new Map<string, Plugin>();

	/** Deterministic random number generator. */
	readonly random: SeededRandom;

	/** Asset loader. */
	readonly assets: AssetLoader;

	/** Fixed delta time (1/60 by default). */
	readonly fixedDeltaTime: number;

	// === Internal ===
	private readonly loop: GameLoop;
	private renderer: Renderer | null = null;

	// === Signals ===
	readonly started: Signal<void> = signal<void>();
	readonly stopped: Signal<void> = signal<void>();
	readonly sceneSwitched: Signal<{ from: string | null; to: string }> = signal();
	readonly onError: Signal<{ node: Node; lifecycle: string; error: unknown }> = signal();
	readonly preFrame: Signal<void> = signal<void>();
	readonly postFixedUpdate: Signal<number> = signal<number>();

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
		if (options.renderer === null) {
			this.renderer = null;
		} else if (options.renderer) {
			this.renderer = options.renderer;
		} else {
			this.renderer = new Canvas2DRenderer(
				this.canvas,
				this.width,
				this.height,
				this.backgroundColor,
				this.assets,
			);
		}

		// Game loop
		this.loop = new GameLoop(
			{
				fixedDeltaTime: this.fixedDeltaTime,
				maxAccumulator: 0.25,
			},
			{
				beginFrame: () => this.preFrame.emit(),
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

	/** Start the game loop with the given scene class. */
	start(SceneClass: SceneConstructor): void {
		this._loadScene(SceneClass);
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
		this.renderer?.dispose?.();
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

	/** @internal Used by renderer plugins (e.g. ThreePlugin) to replace the active renderer. */
	_setRenderer(renderer: Renderer | null): void {
		this.renderer?.dispose?.();
		this.renderer = renderer;
	}

	// === Internal: Scene Loading ===
	/** @internal */
	_switchScene(SceneClass: SceneConstructor): void {
		const fromName = this._currentScene?.name ?? null;

		// Destroy old scene
		if (this._currentScene) {
			this._currentScene._destroyAll();
		}

		this._loadScene(SceneClass);
		this.sceneSwitched.emit({ from: fromName, to: this._currentScene?.name ?? "" });

		// Mark render list dirty for new scene
		this.renderer?.markRenderDirty();
	}

	private _loadScene(SceneClass: SceneConstructor): void {
		const scene = new SceneClass(this);
		this._currentScene = scene;
		scene.onReady();
		scene._markReady();
		scene.sceneReady.emit();

		// Mark render list dirty
		this.renderer?.markRenderDirty();
	}

	// === Internal: Frame Callbacks ===
	private _fixedUpdate(dt: number): void {
		this._currentScene?._walkFixedUpdate(dt);
		this.postFixedUpdate.emit(dt);
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
		if (this._currentScene?._processDestroyQueue()) {
			this.renderer?.markRenderDirty();
		}
	}
}
