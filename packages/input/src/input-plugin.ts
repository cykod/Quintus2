import { definePlugin, type Game, type Node, type Plugin, type Scene } from "@quintus/core";
import { Input, type InputConfig } from "./input.js";
import { InputEvent } from "./input-event.js";
import { isInputReceiver } from "./input-receiver.js";

const inputMap = new WeakMap<Game, Input>();

/** Get the Input instance for a Game. Returns null if InputPlugin not installed. */
export function getInput(game: Game): Input | null {
	return inputMap.get(game) ?? null;
}

/** Create the input plugin. */
export function InputPlugin(config: InputConfig): Plugin {
	return definePlugin({
		name: "input",
		install(game: Game) {
			const input = new Input(config);
			inputMap.set(game, input);

			// --- Game Loop Hook (works in all environments, including headless) ---
			game.preFrame.connect(() => {
				input._beginFrame();
				input._pollGamepad();
				propagateTransitions(game, input);
			});

			// --- DOM Listeners (browser only) ---
			if (typeof document !== "undefined") {
				const onKeyDown = (e: KeyboardEvent) => {
					if (e.repeat) return;
					input._bufferKeyPress(e.code);
				};

				const onKeyUp = (e: KeyboardEvent) => {
					input._bufferKeyRelease(e.code);
				};

				const onMouseDown = (e: MouseEvent) => {
					input._bufferMousePress(e.button);
				};

				const onMouseUp = (e: MouseEvent) => {
					input._bufferMouseRelease(e.button);
				};

				const onMouseMove = (e: MouseEvent) => {
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

				document.addEventListener("keydown", onKeyDown);
				document.addEventListener("keyup", onKeyUp);
				if (game.canvas) {
					game.canvas.addEventListener("mousedown", onMouseDown);
					game.canvas.addEventListener("mousemove", onMouseMove);
				}
				document.addEventListener("mouseup", onMouseUp);
				window.addEventListener("blur", onBlur);

				// --- Cleanup on stop ---
				game.stopped.connect(() => {
					document.removeEventListener("keydown", onKeyDown);
					document.removeEventListener("keyup", onKeyUp);
					if (game.canvas) {
						game.canvas.removeEventListener("mousedown", onMouseDown);
						game.canvas.removeEventListener("mousemove", onMouseMove);
					}
					document.removeEventListener("mouseup", onMouseUp);
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

	for (const actionName of input.actionNames) {
		const jp = input.isJustPressed(actionName);
		const jr = input.isJustReleased(actionName);
		if (!jp && !jr) continue;

		const event = new InputEvent(actionName, jp, jp ? 1 : 0);
		propagateInputEvent(scene, event);
	}
}
