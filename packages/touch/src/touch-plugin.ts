import { definePlugin, type Game, type Node2D, type Plugin } from "@quintus/core";
import { lockScroll } from "./scroll-lock.js";
import { requestFullscreen } from "./fullscreen.js";
import { onInputMethodChange } from "./detect.js";

/** Configuration for the TouchPlugin. */
export interface TouchPluginConfig {
	/** Control layout to use. Provide a factory function or a layout object. */
	layout: TouchLayout | TouchLayoutFactory;
	/** Auto-request fullscreen on first touch. Default: false. */
	fullscreen?: boolean;
	/** Prevent page scroll when touching the canvas. Default: true. */
	preventScroll?: boolean;
	/** Force controls visible (true), hidden (false), or auto-detect (undefined). */
	visible?: boolean;
	/** Opacity of virtual controls. Default: 0.4. */
	opacity?: number;
	/** Preferred orientation when fullscreen. Default: "landscape". Set "any" to skip locking. */
	orientation?: "landscape" | "portrait" | "any";
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
}

const touchMap = new WeakMap<Game, TouchState>();

/** Get the TouchState for a Game. Returns null if TouchPlugin not installed. */
export function getTouchState(game: Game): TouchState | null {
	return touchMap.get(game) ?? null;
}

/** Create the touch plugin for mobile virtual controls. */
export function TouchPlugin(config: TouchPluginConfig): Plugin {
	return definePlugin({
		name: "touch",
		install(game: Game) {
			// Resolve layout factory
			const layout =
				typeof config.layout === "function"
					? config.layout(game)
					: config.layout;

			const state: TouchState = {
				config,
				layout,
				inputMethod: null,
				controlsVisible: config.visible ?? false,
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
					// Phase 2 will use this to show/hide the overlay
				});
				cleanups.push(removeDetection);
			}

			// --- Fullscreen on First Touch ---
			if (config.fullscreen && typeof document !== "undefined") {
				let requested = false;
				const onTouch = () => {
					if (requested) return;
					requested = true;
					requestFullscreen(game.canvas).then(() => {
						// Try to lock orientation (not in all TS type defs)
						const orientation = config.orientation ?? "landscape";
						if (orientation !== "any") {
							const so = screen.orientation as ScreenOrientation & {
								lock?: (o: string) => Promise<void>;
							};
							so.lock?.(orientation)?.catch(() => {
								// Silently ignore — not all browsers support this
							});
						}
					}).catch(() => {
						// Fullscreen may be blocked by browser
					});
				};
				game.canvas.addEventListener("touchstart", onTouch, { once: true });
				cleanups.push(() => {
					game.canvas.removeEventListener("touchstart", onTouch);
				});
			}

			// --- Scene Switch Hook (Phase 2 will re-attach overlay here) ---
			game.sceneSwitched.connect(() => {
				// Phase 2: destroy old overlay, create new one from layout
			});

			// --- Cleanup on Stop ---
			game.stopped.connect(() => {
				for (const cleanup of cleanups) cleanup();
				cleanups.length = 0;
				touchMap.delete(game);
			});
		},
	});
}
