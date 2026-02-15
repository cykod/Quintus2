export class InputEvent {
	/** The action name. */
	readonly action: string;
	/** Whether the action was pressed (true) or released (false). */
	readonly pressed: boolean;
	/** Analog value (0–1). 1 for keyboard, variable for gamepad sticks. */
	readonly value: number;

	private _consumed = false;

	constructor(action: string, pressed: boolean, value: number) {
		this.action = action;
		this.pressed = pressed;
		this.value = value;
	}

	/** Mark this event as consumed. Stops propagation to parent nodes. */
	consume(): void {
		this._consumed = true;
	}

	/** Whether this event has been consumed by a handler. */
	get consumed(): boolean {
		return this._consumed;
	}
}
