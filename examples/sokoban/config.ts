// === Game dimensions ===
export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 640;

// === Grid ===
export const CELL_SIZE = 64;

// === Movement ===
export const MOVE_DURATION = 0.1; // seconds for tween animation

// === Input bindings ===
export const INPUT_BINDINGS: Record<string, string[]> = {
	move_up: ["ArrowUp", "KeyW", "gamepad:dpad-up", "gamepad:left-stick-up"],
	move_down: ["ArrowDown", "KeyS", "gamepad:dpad-down", "gamepad:left-stick-down"],
	move_left: ["ArrowLeft", "KeyA", "gamepad:dpad-left", "gamepad:left-stick-left"],
	move_right: ["ArrowRight", "KeyD", "gamepad:dpad-right", "gamepad:left-stick-right"],
	undo: ["KeyZ", "KeyU", "gamepad:b"],
	reset: ["KeyR", "gamepad:y"],
	menu: ["Escape", "gamepad:start"],
};
