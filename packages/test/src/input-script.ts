/** A single step in an input script timeline. */
export type InputStep =
	| { type: "press"; action: string; frames: number }
	| { type: "tap"; action: string }
	| { type: "release"; action: string }
	| { type: "wait"; frames: number }
	| { type: "analog"; action: string; value: number; frames: number };

/**
 * Builder for deterministic input sequences.
 *
 * All timing is in frames (not seconds) for deterministic replay.
 * Use `InputScript.secondsToFrames()` to convert if needed.
 *
 * @example
 * const script = InputScript.create()
 *   .wait(30)                    // Wait 0.5s (30 frames at 60fps)
 *   .press("right", 120)        // Hold right for 2s
 *   .tap("jump")                // Single-frame tap
 *   .press("right", 60);        // Hold right for 1s
 */
export class InputScript {
	private _steps: InputStep[] = [];

	private constructor() {}

	static create(): InputScript {
		return new InputScript();
	}

	/** Convert seconds to frames. */
	static secondsToFrames(seconds: number, fps = 60): number {
		return Math.round(seconds * fps);
	}

	/** Wait (no input) for N frames. */
	wait(frames: number): this {
		this._steps.push({ type: "wait", frames });
		return this;
	}

	/** Wait for N seconds (converted to frames at 60fps). */
	waitSeconds(seconds: number): this {
		return this.wait(InputScript.secondsToFrames(seconds));
	}

	/** Hold an action for N frames. */
	press(action: string, frames: number): this {
		this._steps.push({ type: "press", action, frames });
		return this;
	}

	/** Hold an action for N seconds (converted to frames). */
	pressSeconds(action: string, seconds: number): this {
		return this.press(action, InputScript.secondsToFrames(seconds));
	}

	/** Press an action for exactly 1 frame (tap). */
	tap(action: string): this {
		this._steps.push({ type: "tap", action });
		return this;
	}

	/** Explicitly release an action. */
	release(action: string): this {
		this._steps.push({ type: "release", action });
		return this;
	}

	/** Set an analog value for N frames. */
	analog(action: string, value: number, frames: number): this {
		this._steps.push({ type: "analog", action, value, frames });
		return this;
	}

	/** Get the compiled step list (immutable copy). */
	get steps(): readonly InputStep[] {
		return [...this._steps];
	}

	/** Total frames this script will take to execute. */
	get totalFrames(): number {
		let total = 0;
		for (const step of this._steps) {
			switch (step.type) {
				case "press":
				case "analog":
					total += step.frames;
					break;
				case "tap":
					total += 1;
					break;
				case "wait":
					total += step.frames;
					break;
				case "release":
					break;
			}
		}
		return total;
	}
}
