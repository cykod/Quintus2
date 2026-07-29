import { SeededRandom } from "@quintus/math";
import { AssetLoader } from "./asset-loader.js";
import { Canvas2DRenderer } from "./canvas2d-renderer.js";
import { ConstantsRegistry } from "./constants.js";
import { installDebugBridge } from "./debug-bridge.js";
import { DebugLog } from "./debug-log.js";
import { GameLoop } from "./game-loop.js";
import { Node } from "./node.js";

/** @internal Symbol for tracking the current build() owner across packages. */
const CURRENT_BUILD_OWNER = Symbol.for("quintus:currentBuildOwner");

/** @internal Symbol for the dollar-ref resolver registered by @quintus/jsx. */
const RESOLVE_BUILD_REFS = Symbol.for("quintus:resolveBuildRefs");

import type { Plugin } from "./plugin.js";
import type { Renderer } from "./renderer.js";
import type { Scene, SceneConstructor, SceneTarget } from "./scene.js";
import { type Signal, signal } from "./signal.js";

export interface GameOptions {
	/** Canvas width in pixels. */
	width: number;
	/** Canvas height in pixels. */
	height: number;
	/**
	 * How to fit the canvas to the page. Default: "fixed".
	 *   - "fixed"      — leave CSS alone; the canvas is sized by the page
	 *   - "fit"        — letterbox into the **viewport** (`position: absolute`, escapes its container)
	 *   - "fill"       — mobile fills the viewport (changes internal resolution); desktop falls back to "fit"
	 *   - "fit-parent" — letterbox into the canvas's **parent element**, staying in normal flow
	 *                    (embedding-safe; re-fits via `ResizeObserver` when the parent resizes)
	 *
	 * `"fit-parent"` centers the canvas against its own normal-flow origin, so give the game its
	 * own container element. If the canvas has in-flow siblings (a toolbar, a caption), it is
	 * displaced by their height and can overflow the parent's bottom edge.
	 */
	scale?: "fit" | "fixed" | "fill" | "fit-parent";
	/**
	 * Which axis stays fixed in fill mode. Default: "height".
	 *   - "height" — keeps design height, adjusts width (landscape games)
	 *   - "width"  — keeps design width, adjusts height (portrait games like breakout)
	 */
	fillAxis?: "height" | "width";
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
	private _width: number;
	private _height: number;
	get width(): number {
		return this._width;
	}
	get height(): number {
		return this._height;
	}
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

	/** Whether a renderer is currently installed. Used by ThreePlugin for mode auto-detection. */
	get hasRenderer(): boolean {
		return this.renderer !== null;
	}

	// === Signals ===
	readonly started: Signal<void> = signal<void>();
	readonly stopped: Signal<void> = signal<void>();
	readonly sceneSwitched: Signal<{ from: string | null; to: string }> = signal();
	readonly onError: Signal<{ node: Node; lifecycle: string; error: unknown }> = signal();
	readonly preFrame: Signal<void> = signal<void>();
	readonly postFixedUpdate: Signal<number> = signal<number>();
	readonly postUpdate: Signal<number> = signal<number>();

	/**
	 * Fires after the canvas has been re-fitted to its container.
	 *
	 * The payload is always the **internal** resolution (`game.width`/`game.height`), i.e. the
	 * backing-store size the scene renders into:
	 *   - `"fill"` changes it on every viewport resize, so the payload changes with it.
	 *   - `"fit-parent"` never changes it — the signal is a "the CSS box was re-fitted"
	 *     notification and the payload is constant. Read `canvas.clientWidth / game.width` for
	 *     the design→CSS-px factor.
	 *
	 * Handlers that only care about the internal resolution should compare against the previous
	 * payload and bail when it is unchanged.
	 */
	readonly resized: Signal<{ width: number; height: number }> = signal();

	/** Recommended camera zoom for fill mode. 1 if not in fill mode. */
	get fillZoom(): number {
		return this._fillZoom;
	}
	private _fillZoom = 1;
	private _designHeight: number;
	private _designWidth: number;
	private _fillAxis: "height" | "width";

	constructor(options: GameOptions) {
		this._width = options.width;
		this._height = options.height;
		this._designHeight = options.height;
		this._designWidth = options.width;
		this._fillAxis = options.fillAxis ?? "height";
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

		// Canvas scaling
		if (typeof window !== "undefined") {
			this._setupScaling(options.scale ?? "fixed");
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

		// Process build() for the scene root with owner tracking
		const g = globalThis as Record<symbol, unknown>;
		const prevOwner = g[CURRENT_BUILD_OWNER];
		g[CURRENT_BUILD_OWNER] = scene;

		const built = scene.build();

		// Resolve $ refs if @quintus/jsx is loaded
		const resolve = g[RESOLVE_BUILD_REFS];
		if (typeof resolve === "function") (resolve as () => void)();

		g[CURRENT_BUILD_OWNER] = prevOwner;

		if (built !== null) {
			const nodes = Array.isArray(built) ? (built.flat(Infinity) as unknown[]) : [built];
			for (const child of nodes) {
				if (child instanceof Node) {
					scene.add(child);
				}
			}
		}

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

	/** Set up CSS-based canvas scaling. */
	private _setupScaling(mode: "fit" | "fixed" | "fill" | "fit-parent"): void {
		if (mode === "fixed") return;

		const canvas = this.canvas;
		canvas.style.touchAction = "none";

		if (mode === "fit-parent") {
			this._setupFitParentScaling();
			return;
		}

		if (mode === "fill") {
			const isMobile =
				typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;

			if (!isMobile) {
				// Desktop: letterboxed fit, no dimension changes
				this._setupFitScaling();
				return;
			}

			const fillAxis = this._fillAxis;
			const designHeight = this._designHeight;
			const designWidth = this._designWidth;
			const resize = () => {
				const vw = window.innerWidth;
				const vh = window.innerHeight;

				let newWidth: number;
				let newHeight: number;
				if (fillAxis === "width") {
					// Portrait: keep design width, adjust height
					newWidth = designWidth;
					newHeight = Math.round(designWidth * (vh / vw));
					this._fillZoom = vw / designWidth;
				} else {
					// Landscape (default): keep design height, adjust width
					newWidth = Math.round(designHeight * (vw / vh));
					newHeight = designHeight;
					this._fillZoom = vh / designHeight;
				}

				this._width = newWidth;
				this._height = newHeight;
				canvas.width = newWidth;
				canvas.height = newHeight;

				// CSS fills entire viewport
				canvas.style.width = `${vw}px`;
				canvas.style.height = `${vh}px`;
				canvas.style.position = "fixed";
				canvas.style.left = "0";
				canvas.style.top = "0";

				// Re-apply pixel-art smoothing (canvas resize resets context state)
				if (this.pixelArt) {
					const ctx = canvas.getContext("2d");
					if (ctx) ctx.imageSmoothingEnabled = false;
				}

				// Update renderer's cached dimensions
				this.renderer?.resize?.(newWidth, newHeight);

				// Notify listeners
				this.resized.emit({ width: newWidth, height: newHeight });
			};

			// Named so `stopped` can remove it — an inline arrow would be unremovable.
			const onOrientationChange = () => setTimeout(resize, 100);

			resize();
			window.addEventListener("resize", resize);
			window.addEventListener("orientationchange", onOrientationChange);
			this.stopped.connect(() => {
				window.removeEventListener("resize", resize);
				window.removeEventListener("orientationchange", onOrientationChange);
			});
			return;
		}

		// mode === "fit"
		this._setupFitScaling();
	}

	/** CSS letterbox scaling — preserves internal resolution, centers on screen. */
	private _setupFitScaling(): void {
		const canvas = this.canvas;
		const aspect = this._width / this._height;

		const resize = () => {
			const vw = window.innerWidth;
			const vh = window.innerHeight;
			const { width: cssWidth, height: cssHeight } = _letterbox(vw, vh, aspect);

			canvas.style.width = `${cssWidth}px`;
			canvas.style.height = `${cssHeight}px`;
			canvas.style.position = "absolute";
			canvas.style.left = `${(vw - cssWidth) / 2}px`;
			canvas.style.top = `${(vh - cssHeight) / 2}px`;
		};

		// Named so `stopped` can remove it — an inline arrow would be unremovable.
		const onOrientationChange = () => setTimeout(resize, 100);

		resize();
		window.addEventListener("resize", resize);
		window.addEventListener("orientationchange", onOrientationChange);

		this.stopped.connect(() => {
			window.removeEventListener("resize", resize);
			window.removeEventListener("orientationchange", onOrientationChange);
		});
	}

	/**
	 * CSS letterbox scaling into the canvas's parent element — preserves internal
	 * resolution, stays in normal flow, re-fits via ResizeObserver on parent resize.
	 */
	private _setupFitParentScaling(): void {
		const canvas = this.canvas;
		const parent = canvas.parentElement;

		if (!parent) {
			console.warn(
				'Game: scale: "fit-parent" requires the canvas to have a parent element. Falling back to "fit".',
			);
			this._setupFitScaling();
			return;
		}
		if (typeof ResizeObserver === "undefined") {
			console.warn(
				'Game: scale: "fit-parent" requires ResizeObserver, which is unavailable here. Falling back to "fit".',
			);
			this._setupFitScaling();
			return;
		}

		if (typeof document !== "undefined" && parent === document.body) {
			console.warn(
				'Game: scale: "fit-parent" is fitting the canvas into <body>, which is usually sized ' +
					"by its content — the fit degenerates to width-fill and never letterboxes " +
					'vertically. Put the canvas in an explicitly-sized container, or use scale: "fit".',
			);
		}

		const aspect = this._width / this._height;
		// Last measured parent content box; used to skip redundant re-fits (a content-sized
		// parent re-triggers the observer with the box the previous fit produced).
		let lastPw = -1;
		let lastPh = -1;

		const fit = (entries?: ResizeObserverEntry[]) => {
			// `contentRect` is the parent's CONTENT box. `clientWidth`/`clientHeight` are the
			// PADDING box, so they over-measure any padded container and the canvas overflows.
			// The `??` fallback keeps `fit()` usable outside an observer callback.
			const box = entries?.[0]?.contentRect;
			const pw = box?.width ?? parent.clientWidth;
			const ph = box?.height ?? parent.clientHeight;
			// Parent not laid out yet (detached, display:none, framework hasn't flushed).
			// Defer rather than writing a 0-sized canvas — the observer fires again once sized.
			if (pw === 0 || ph === 0) return;
			if (pw === lastPw && ph === lastPh) return;
			lastPw = pw;
			lastPh = ph;

			const { width: cssWidth, height: cssHeight } = _letterbox(pw, ph, aspect);

			canvas.style.width = `${cssWidth}px`;
			canvas.style.height = `${cssHeight}px`;
			// Normal flow — the canvas must not escape its container.
			canvas.style.display = "block";
			canvas.style.position = "relative";
			canvas.style.left = `${(pw - cssWidth) / 2}px`;
			canvas.style.top = `${(ph - cssHeight) / 2}px`;

			this.resized.emit({ width: this._width, height: this._height });
		};

		// The observer's initial callback drives the first fit: reading clientWidth here
		// (in the Game constructor) can be 0 before layout.
		const observer = new ResizeObserver((entries) => fit(entries));
		observer.observe(parent);

		this.stopped.connect(() => observer.disconnect());
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

/**
 * Largest box of the given `aspect` (width/height) that fits inside `boxW`×`boxH`.
 * Pure — the caller owns positioning, listeners, and any signal emission.
 */
function _letterbox(boxW: number, boxH: number, aspect: number): { width: number; height: number } {
	return boxW / boxH > aspect
		? { width: boxH * aspect, height: boxH } // box is wider than the game — fit to height
		: { width: boxW, height: boxW / aspect }; // box is taller than the game — fit to width
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
