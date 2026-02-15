// Side-effect: install game.input accessor
import "./augment.js";

export type { InputConfig } from "./input.js";
export { Input } from "./input.js";
export { InputEvent } from "./input-event.js";
export { getInput, InputPlugin } from "./input-plugin.js";
export type { InputReceiver } from "./input-receiver.js";
export { isInputReceiver } from "./input-receiver.js";
