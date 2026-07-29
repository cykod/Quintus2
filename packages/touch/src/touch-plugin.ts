import { definePlugin, type Game, type Node2D, type Plugin, type Scene } from "@quintus/core";
import { onInputMethodChange } from "./detect.js";
import { lockScroll } from "./scroll-lock.js";
import { TouchOverlay } from "./touch-overlay.js";
import type { VirtualControl } from "./virtual-control.js";

/** Configuration for the TouchPlugin. */
export interface TouchPluginConfig {
	/** Control layout to use. Provide a factory function or a layout object. */
	layout: TouchLayout | TouchLayoutFactory;
	/** Prevent page scroll when touching the canvas. Default: true. */
	preventScroll?: boolean;
	/** Force controls visible (true), hidden (false), or auto-detect (undefined). */
	visible?: boolean;
	/** Opacity of virtual controls. Default: 0.4. */
	opacity?: number;
	/** Only show controls on these scene classes. If undefined, controls appear on all scenes. */
	scenes?: Array<new (...args: unknown[]) => Scene>;
}

/** Factory function that creates a TouchLayout given a Game instance. */
export type TouchLayoutFactory = (game: Game) => TouchLayout;

/** A layout that creates the virtual control nodes for a scene. */
export interface TouchLayout {
	/** Create the control nodes to add to the overlay. */
	createControls(game: Game): Node2D[];
}

/** Internal state stored per Game instance. */
export interface TouchState {
	readonly config: TouchPluginConfig;
	readonly layout: TouchLayout;
	/** Current input method detected. Null until first detection event. */
	inputMethod: "touch" | "mouse" | null;
	/** Whether controls should be visible. */
	controlsVisible: boolean;
	/** Active overlay, or null if no scene is loaded. */
	overlay: TouchOverlay | null;
}

const touchMap = new WeakMap<Game, TouchState>();

/** Get the TouchState for a Game. Returns null if TouchPlugin not installed. */
export function getTouchState(game: Game): TouchState | null {
	return touchMap.get(game) ?? null;
}

/** Create and attach the overlay to the current scene. */
function _createOverlay(game: Game, state: TouchState): void {
	const scene = game.currentScene;
	if (!scene) return;

	// Skip controls on scenes not in the filter list
	const sceneFilter = state.config.scenes;
	if (sceneFilter && !sceneFilter.some((cls) => scene instanceof cls)) {
		return;
	}

	const overlay = new TouchOverlay();
	overlay.alpha = state.config.opacity ?? 0.4;

	// Determine visibility
	if (state.config.visible !== undefined) {
		overlay.visible = state.config.visible;
	} else {
		overlay.visible = state.controlsVisible;
	}

	// Create controls from layout and add to overlay
	const controls = state.layout.createControls(game);
	for (const control of controls) {
		overlay.addControl(control as VirtualControl);
	}

	scene.add(overlay);
	state.overlay = overlay;
}

/** Destroy the current overlay if it exists. */
function _destroyOverlay(state: TouchState): void {
	if (state.overlay && !state.overlay.isDestroyed) {
		state.overlay.destroy();
	}
	state.overlay = null;
}

/** Create the touch plugin for mobile virtual controls. */
export function TouchPlugin(config: TouchPluginConfig): Plugin {
	return definePlugin({
		name: "touch",
		install(game: Game) {
			// Resolve layout factory
			const layout = typeof config.layout === "function" ? config.layout(game) : config.layout;

			const state: TouchState = {
				config,
				layout,
				inputMethod: null,
				controlsVisible: config.visible ?? false,
				overlay: null,
			};
			touchMap.set(game, state);

			const cleanups: Array<() => void> = [];

			// --- Scroll Prevention ---
			if (config.preventScroll !== false && typeof document !== "undefined") {
				cleanups.push(lockScroll(game.canvas));
			}

			// --- Input Method Detection (auto-show/hide) ---
			if (typeof document !== "undefined" && config.visible === undefined) {
				const removeDetection = onInputMethodChange((method) => {
					state.inputMethod = method;
					state.controlsVisible = method === "touch";
					if (state.overlay) {
						state.overlay.visible = state.controlsVisible;
					}
				});
				cleanups.push(removeDetection);
			}

			// --- Resize Hook ---
			// Layouts position controls in the game's *internal* coordinate space, so only a
			// change to that space warrants a rebuild. `scale: "fit-parent"` emits `resized` on
			// every parent resize without changing the internal size (and a drag-resize emits
			// once per frame), so rebuilding unconditionally would thrash the overlay.
			let builtWidth = game.width;
			let builtHeight = game.height;
			game.resized.connect(({ width, height }) => {
				if (width === builtWidth && height === builtHeight) return;
				builtWidth = width;
				builtHeight = height;
				_destroyOverlay(state);
				_createOverlay(game, state);
			});

			// --- Scene Switch Hook ---
			game.sceneSwitched.connect(() => {
				_destroyOverlay(state);
				_createOverlay(game, state);
			});

			// Create overlay immediately if a scene is already active
			if (game.currentScene) {
				_createOverlay(game, state);
			}

			// --- Cleanup on Stop ---
			game.stopped.connect(() => {
				_destroyOverlay(state);
				for (const cleanup of cleanups) cleanup();
				cleanups.length = 0;
				touchMap.delete(game);
			});
		},
	});
}
