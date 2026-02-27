export { isTouchDevice, onInputMethodChange } from "./detect.js";
export {
	requestFullscreen,
	exitFullscreen,
	isFullscreen,
	onFullscreenChange,
} from "./fullscreen.js";
export { lockScroll } from "./scroll-lock.js";
export type {
	TouchPluginConfig,
	TouchLayoutFactory,
	TouchLayout,
	TouchState,
} from "./touch-plugin.js";
export { TouchPlugin, getTouchState } from "./touch-plugin.js";
