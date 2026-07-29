import { definePlugin, type Game, type Node, type Plugin, type Scene } from "@quintus/core";
import { Input, type InputConfig } from "./input.js";
import { InputEvent } from "./input-event.js";
import { isInputReceiver } from "./input-receiver.js";

const inputMap = new WeakMap<Game, Input>();

/** Get the Input instance for a Game. Returns null if InputPlugin not installed. */
export function getInput(game: Game): Input | null {
	return inputMap.get(game) ?? null;
}

/**
 * A non-`document` key target only receives keyboard events while focused, so
 * give it a `tabIndex` if it has none. Called once per install; warns once if
 * the element is detached, since a detached target can never receive a key
 * event no matter what its tab order says.
 */
function ensureFocusable(keyTarget: HTMLElement | Document): void {
	if (!("tabIndex" in keyTarget)) return;

	if (!keyTarget.isConnected) {
		console.warn(
			"InputPlugin: keyTarget is not attached to the document, so it will receive no " +
				"keyboard events. Attach it before starting the game, or use the default " +
				"document keyTarget.",
		);
	}

	// Natively focusable elements (button, input, …) report tabIndex >= 0 —
	// leave their tab order alone.
	if (keyTarget.hasAttribute("tabindex") || keyTarget.tabIndex >= 0) return;
	keyTarget.tabIndex = -1;
}

/**
 * Whether a key event originated in a text field or contenteditable element.
 * Those keystrokes belong to the field, not the game: real key events bubble,
 * so without this check typing a Space into an `<input>` inside the `keyTarget`
 * (or anywhere in the page under the default `document` target) would both be
 * `preventDefault`ed and fire the bound game action.
 */
function isEditableTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	if (target.isContentEditable) return true;
	const tag = target.tagName;
	return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/** Create the input plugin. */
export function InputPlugin(config: InputConfig): Plugin {
	return definePlugin({
		name: "input",
		install(game: Game) {
			const input = new Input(config);
			input._game = game;
			inputMap.set(game, input);

			// --- Game Loop Hook (works in all environments, including headless) ---
			game.preFrame.connect(() => {
				input._beginFrame();
				input._pollGamepad();
				propagateTransitions(game, input);
			});

			// Consume edge flags after each fixedUpdate so isJustPressed is
			// true for exactly one physics step, and presses are never lost
			// on high-refresh-rate displays.
			game.postFixedUpdate.connect(() => {
				input._consumeEdgeFlags();
			});

			// --- DOM Listeners (browser only) ---
			if (typeof document !== "undefined") {
				// `Input` is the single source of truth for the resolved target —
				// `_shouldPreventDefault()` reads the same value. The `?? document`
				// only satisfies the type: `_keyTarget` is non-null inside this branch.
				const keyTarget = input._keyTarget ?? document;
				ensureFocusable(keyTarget);

				if (config.preventDefaultPolicy === "focused" && keyTarget === document) {
					console.warn(
						'InputPlugin: preventDefaultPolicy "focused" has no effect with the default ' +
							"document keyTarget, which always contains the active element. Pass a " +
							"keyTarget (e.g. the game canvas) to scope key capture.",
					);
				}

				const onKeyDown = (e: KeyboardEvent) => {
					if (!input.enabled) return;
					if (e.repeat) return;
					// A keystroke typed into a form field belongs to that field.
					// (Deliberately not applied to keyup, so a key held before focus
					// moved into the field still gets released and never sticks.)
					if (isEditableTarget(e.target)) return;
					if (input._isBoundKey(e.code) && input._shouldPreventDefault()) e.preventDefault();
					input._bufferKeyPress(e.code);
				};

				const onKeyUp = (e: KeyboardEvent) => {
					if (!input.enabled) return;
					input._bufferKeyRelease(e.code);
				};

				const onPointerDown = (e: PointerEvent) => {
					if (!input.enabled) return;
					if (game.canvas) {
						const rect = game.canvas.getBoundingClientRect();
						const scaleX = game.width / rect.width;
						const scaleY = game.height / rect.height;
						input._setMousePosition(
							(e.clientX - rect.left) * scaleX,
							(e.clientY - rect.top) * scaleY,
						);
					}
					input._bufferMousePress(e.button);
				};

				const onPointerUp = (e: PointerEvent) => {
					if (!input.enabled) return;
					input._bufferMouseRelease(e.button);
				};

				const onPointerMove = (e: PointerEvent) => {
					if (!input.enabled) return;
					if (!game.canvas) return;
					const rect = game.canvas.getBoundingClientRect();
					const scaleX = game.width / rect.width;
					const scaleY = game.height / rect.height;
					input._setMousePosition(
						(e.clientX - rect.left) * scaleX,
						(e.clientY - rect.top) * scaleY,
					);
				};

				const onBlur = () => {
					input._releaseAll();
				};

				keyTarget.addEventListener("keydown", onKeyDown as EventListener);
				keyTarget.addEventListener("keyup", onKeyUp as EventListener);
				if (game.canvas) {
					game.canvas.addEventListener("pointerdown", onPointerDown);
					game.canvas.addEventListener("pointermove", onPointerMove);
				}
				document.addEventListener("pointerup", onPointerUp);
				window.addEventListener("blur", onBlur);

				// --- Cleanup on stop ---
				game.stopped.connect(() => {
					keyTarget.removeEventListener("keydown", onKeyDown as EventListener);
					keyTarget.removeEventListener("keyup", onKeyUp as EventListener);
					if (game.canvas) {
						game.canvas.removeEventListener("pointerdown", onPointerDown);
						game.canvas.removeEventListener("pointermove", onPointerMove);
					}
					document.removeEventListener("pointerup", onPointerUp);
					window.removeEventListener("blur", onBlur);
					inputMap.delete(game);
				});
			}
		},
	});
}

/** Collect all nodes depth-first from the scene tree. */
function collectDepthFirst(scene: Scene): Node[] {
	const nodes: Node[] = [];
	function walk(node: Node): void {
		nodes.push(node);
		for (const child of node.children) {
			walk(child);
		}
	}
	for (const child of scene.children) {
		walk(child);
	}
	return nodes;
}

/** Propagate an InputEvent through the scene tree leaf-to-root. */
function propagateInputEvent(scene: Scene, event: InputEvent): void {
	const nodes = collectDepthFirst(scene);
	for (let i = nodes.length - 1; i >= 0; i--) {
		const node = nodes[i];
		if (!node) continue;
		if (!isInputReceiver(node)) continue;
		node.onInput(event);
		if (event.consumed) break;
	}
}

/** Fire InputEvents for actions that transitioned this frame. */
function propagateTransitions(game: Game, input: Input): void {
	const scene = game.currentScene;
	if (!scene) return;

	for (const actionName of input.newlyTransitioned) {
		const jp = input.isJustPressed(actionName);
		const jr = input.isJustReleased(actionName);
		if (!jp && !jr) continue;

		const event = new InputEvent(actionName, jp, jp ? 1 : 0);
		propagateInputEvent(scene, event);
	}
}
