import type { InputStep } from "./input-script.js";

export interface InputLike {
	inject(action: string, pressed: boolean): void;
	injectAnalog(action: string, value: number): void;
}

export interface GameLike {
	step(): void;
}

/**
 * Plays an InputScript against a game instance.
 * Handles hold/press/release/wait/tap/analog steps via inject() and step().
 */
export class InputScriptPlayer {
	private _frame = 0;
	private _held = new Set<string>();

	/**
	 * Execute the full script against the game.
	 * @param game - Must have step() method
	 * @param input - Must have inject() and injectAnalog() methods
	 * @param steps - Compiled steps from InputScript
	 * @param onFrame - Optional callback after each frame (for snapshot recording)
	 */
	execute(
		game: GameLike,
		input: InputLike,
		steps: readonly InputStep[],
		onFrame?: (frame: number) => void,
	): void {
		for (const step of steps) {
			switch (step.type) {
				case "hold":
					input.inject(step.action, true);
					this._held.add(step.action);
					break;

				case "press":
					input.inject(step.action, true);
					this._held.add(step.action);
					for (let i = 0; i < step.frames; i++) {
						game.step();
						this._frame++;
						onFrame?.(this._frame);
					}
					input.inject(step.action, false);
					this._held.delete(step.action);
					break;

				case "tap":
					input.inject(step.action, true);
					game.step();
					this._frame++;
					onFrame?.(this._frame);
					input.inject(step.action, false);
					break;

				case "release":
					input.inject(step.action, false);
					this._held.delete(step.action);
					break;

				case "wait":
					for (let i = 0; i < step.frames; i++) {
						game.step();
						this._frame++;
						onFrame?.(this._frame);
					}
					break;

				case "analog":
					input.injectAnalog(step.action, step.value);
					for (let i = 0; i < step.frames; i++) {
						game.step();
						this._frame++;
						onFrame?.(this._frame);
					}
					input.injectAnalog(step.action, 0);
					break;
			}
		}
	}

	/** Current frame count. */
	get frame(): number {
		return this._frame;
	}

	/** Release all currently held actions. */
	releaseAll(input: InputLike): void {
		for (const action of this._held) {
			input.inject(action, false);
		}
		this._held.clear();
	}
}
