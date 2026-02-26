// === Game dimensions ===
export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 640;

// === Grid ===
export const CELL_SIZE = 64;

// === Movement ===
export const MOVE_DURATION = 0.1; // seconds for tween animation

// === Input bindings ===
export const INPUT_BINDINGS: Record<string, string[]> = {
	move_up: ["ArrowUp", "KeyW"],
	move_down: ["ArrowDown", "KeyS"],
	move_left: ["ArrowLeft", "KeyA"],
	move_right: ["ArrowRight", "KeyD"],
	undo: ["KeyZ", "KeyU"],
	reset: ["KeyR"],
};
