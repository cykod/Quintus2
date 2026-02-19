import { SeededRandom } from "@quintus/math";
import { AssetLoader } from "./asset-loader.js";
import { Canvas2DRenderer } from "./canvas2d-renderer.js";
import { ConstantsRegistry } from "./constants.js";
import { installDebugBridge } from "./debug-bridge.js";
import { DebugLog } from "./debug-log.js";
import { GameLoop } from "./game-loop.js";
import type { Node } from "./node.js";
import type { Plugin } from "./plugin.js";
import type { Renderer } from "./renderer.js";
import type { Scene, SceneConstructor, SceneTarget } from "./scene.js";
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
	/** Start in debug mode (paused, bridge exposed). Default: auto-detect from ?debug URL param. */
	debug?: boolean;
}

export class Game {
	// === Config ===
	readonly width: number;
	readonly height: number;
	readonly canvas: HTMLCanvasElement;
	readonly pixelArt: boolean;
	readonly backgroundColor: string;

	// === Debug ===
	readonly debug: boolean;
	readonly debugLog: DebugLog;

	// === State ===
	private _currentScene: Scene | null = null;
	private _plugins = new Map<string, Plugin>();
	private _sceneRegistry = new Map<string, SceneConstructor>();

	/** Deterministic random number generator. */
	readonly random: SeededRandom;

	/** Asset loader. */
	readonly assets: AssetLoader;

	/** Named constants registry for tweakable game values. */
	readonly consts = new ConstantsRegistry();

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
	readonly postUpdate: Signal<number> = signal<number>();

	constructor(options: GameOptions) {
		this.width = options.width;
		this.height = options.height;
		this.pixelArt = options.pixelArt ?? false;
		this.backgroundColor = options.backgroundColor ?? "#000000";
		this.fixedDeltaTime = options.fixedDeltaTime ?? 1 / 60;

		// Debug mode
		this.debug = options.debug ?? _detectDebugMode();
		this.debugLog = new DebugLog();

		// Seed override from URL in debug mode
		let seed = options.seed ?? Date.now();
		if (this.debug) {
			const urlSeed = _getURLParam("seed");
			if (urlSeed !== null) {
				seed = Number(urlSeed);
			}
		}

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
		this.random = new SeededRandom(seed);

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
				this.pixelArt,
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

	// === Scene Registry ===

	/** Register a scene class under a string name for string-based transitions. */
	registerScene(name: string, SceneClass: SceneConstructor): this {
		if (this._sceneRegistry.has(name)) {
			console.warn(`Scene "${name}" is already registered. Overwriting.`);
		}
		this._sceneRegistry.set(name, SceneClass);
		return this;
	}

	/** Register multiple scenes at once. */
	registerScenes(scenes: Record<string, SceneConstructor>): this {
		for (const [name, SceneClass] of Object.entries(scenes)) {
			this.registerScene(name, SceneClass);
		}
		return this;
	}

	/** @internal Resolve a SceneTarget to a SceneConstructor. */
	_resolveScene(target: SceneTarget): SceneConstructor {
		if (typeof target === "string") {
			const SceneClass = this._sceneRegistry.get(target);
			if (!SceneClass) {
				throw new Error(`Scene "${target}" is not registered. Use game.registerScene() first.`);
			}
			return SceneClass;
		}
		return target;
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

	/** Start the game loop with the given scene class or registered scene name. */
	start(target: SceneTarget): void {
		this._loadScene(this._resolveScene(target));

		if (this.debug) {
			// Render one frame so the initial state is visible, but don't start the loop
			this._render();
			installDebugBridge(this);

			// Auto-step if ?step=N is present
			const stepParam = _getURLParam("step");
			if (stepParam !== null) {
				const n = Number(stepParam);
				if (n > 0) {
					for (let i = 0; i < n; i++) this.step();
				}
			}

			this._renderDebugOverlay();
		} else {
			this.loop.start();
		}

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

	// === Debug ===

	/** Capture the current canvas as a PNG data URL. */
	screenshot(): string {
		return this.canvas.toDataURL("image/png");
	}

	/** Log a custom debug event. No-op when debug mode is off. */
	log(message: string, data?: Record<string, unknown>): void {
		if (!this.debug) return;
		this.debugLog.write({ category: "game", message, data }, this.fixedFrame, this.elapsed);
	}

	/**
	 * Watch a signal and log emissions to the debug log.
	 * No-op when debug mode is off.
	 * @returns Disconnect function, or no-op function if debug is off.
	 */
	watchSignal<T>(sig: Signal<T>, label: string): () => void {
		if (!this.debug) return () => {};
		const handler = (data: T) => {
			this.debugLog.write(
				{
					category: "signal",
					message: `${label} emitted`,
					data: data != null ? { payload: data } : undefined,
				},
				this.fixedFrame,
				this.elapsed,
			);
		};
		sig.connect(handler);
		return () => sig.disconnect(handler);
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

	/** @internal Mark the render list as dirty (called by Node on tree changes). */
	_markRenderDirty(): void {
		this.renderer?.markRenderDirty();
	}

	/** @internal Used by renderer plugins (e.g. ThreePlugin) to replace the active renderer. */
	_setRenderer(renderer: Renderer | null): void {
		this.renderer?.dispose?.();
		this.renderer = renderer;
	}

	// === Internal: Scene Loading ===
	/** @internal */
	_switchScene(target: SceneTarget): void {
		const SceneClass = this._resolveScene(target);
		const fromName = this._currentScene?.name ?? null;

		// Destroy old scene
		if (this._currentScene) {
			this._currentScene._destroyAll();
		}

		this._loadScene(SceneClass);

		if (this.debug) {
			this.debugLog.write(
				{
					category: "scene",
					message: `scene switch ${fromName ?? "null"} → ${this._currentScene?.name ?? ""}`,
				},
				this.fixedFrame,
				this.elapsed,
			);
		}

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
		this.postUpdate.emit(dt);
	}

	private _render(): void {
		if (this._currentScene && this.renderer) {
			this.renderer.render(this._currentScene);
		}
		if (this.debug && !this.running) {
			this._renderDebugOverlay();
		}
	}

	private _cleanup(): void {
		if (this._currentScene?._processDestroyQueue()) {
			this.renderer?.markRenderDirty();
		}
	}

	/** Draw "PAUSED [frame N]" overlay on canvas when paused in debug mode. */
	private _renderDebugOverlay(): void {
		const ctx = this.canvas.getContext("2d");
		if (!ctx) return;
		const text = `PAUSED [frame ${this.fixedFrame}]`;
		ctx.save();
		ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
		ctx.fillRect(0, 0, this.width, 24);
		ctx.fillStyle = "#0f0";
		ctx.font = "12px monospace";
		ctx.textBaseline = "middle";
		ctx.fillText(text, 8, 12);
		ctx.restore();
	}
}

/** Detect debug mode from URL query parameter. */
function _detectDebugMode(): boolean {
	try {
		return new URL(window.location.href).searchParams.has("debug");
	} catch {
		return false;
	}
}

/** Read a URL query parameter. Returns null if not present or not in browser. */
function _getURLParam(name: string): string | null {
	try {
		return new URL(window.location.href).searchParams.get(name);
	} catch {
		return null;
	}
}
