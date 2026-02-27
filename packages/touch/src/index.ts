export { isTouchDevice, onInputMethodChange } from "./detect.js";
export {
	exitFullscreen,
	isFullscreen,
	onFullscreenChange,
	requestFullscreen,
} from "./fullscreen.js";
export { lockScroll } from "./scroll-lock.js";
export type {
	TouchLayout,
	TouchLayoutFactory,
	TouchPluginConfig,
	TouchState,
} from "./touch-plugin.js";
export { getTouchState, TouchPlugin } from "./touch-plugin.js";
