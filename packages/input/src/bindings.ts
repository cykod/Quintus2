const GAMEPAD_BUTTONS = [
	"a",
	"b",
	"x",
	"y",
	"lb",
	"rb",
	"lt",
	"rt",
	"select",
	"start",
	"left-stick",
	"right-stick",
	"dpad-up",
	"dpad-down",
	"dpad-left",
	"dpad-right",
];

/** Map a standard gamepad button index to a name. Unknown indices → `buttonN`. */
export function gamepadButtonName(index: number): string {
	return GAMEPAD_BUTTONS[index] ?? `button${index}`;
}

/** Mouse button names matching DOM MouseEvent.button indices. */
const MOUSE_BUTTONS = ["left", "middle", "right"];

/** Map a MouseEvent.button index to a name. Unknown indices → `buttonN`. */
export function buttonName(button: number): string {
	return MOUSE_BUTTONS[button] ?? `button${button}`;
}
