export { isTouchDevice, onInputMethodChange } from "./detect.js";
export {
	exitFullscreen,
	isFullscreen,
	onFullscreenChange,
	requestFullscreen,
} from "./fullscreen.js";
export type {
	BreakoutLayoutConfig,
	DualStickLayoutConfig,
	PlatformerLayoutConfig,
	PointClickLayoutConfig,
	PuzzleLayoutConfig,
	TopDownLayoutConfig,
} from "./layouts/index.js";
export {
	breakoutLayout,
	dualStickLayout,
	platformerLayout,
	pointClickLayout,
	puzzleLayout,
	topDownLayout,
} from "./layouts/index.js";
export { lockScroll } from "./scroll-lock.js";
export type { TouchFollowZoneConfig } from "./touch-follow-zone.js";
export { TouchFollowZone } from "./touch-follow-zone.js";
export { TouchOverlay } from "./touch-overlay.js";
export type {
	TouchLayout,
	TouchLayoutFactory,
	TouchPluginConfig,
	TouchState,
} from "./touch-plugin.js";
export { getTouchState, TouchPlugin } from "./touch-plugin.js";
export type { VirtualAimStickConfig } from "./virtual-aim-stick.js";
export { VirtualAimStick } from "./virtual-aim-stick.js";
export type { VirtualButtonConfig } from "./virtual-button.js";
export { VirtualButton } from "./virtual-button.js";
export { VirtualControl } from "./virtual-control.js";
export type { VirtualDPadConfig } from "./virtual-dpad.js";
export { VirtualDPad } from "./virtual-dpad.js";
export type { VirtualJoystickConfig } from "./virtual-joystick.js";
export { VirtualJoystick } from "./virtual-joystick.js";
