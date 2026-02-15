import type { InputEvent } from "./input-event.js";

/** Nodes that want input events implement this interface. */
export interface InputReceiver {
	onInput(event: InputEvent): void;
}

/** Type guard — checks if a node implements InputReceiver. */
export function isInputReceiver(node: unknown): node is InputReceiver {
	return (
		typeof node === "object" &&
		node !== null &&
		"onInput" in node &&
		typeof (node as InputReceiver).onInput === "function"
	);
}
