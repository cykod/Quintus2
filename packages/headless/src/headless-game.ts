import { Game, type GameOptions } from "@quintus/core";

export interface HeadlessGameOptions extends Omit<GameOptions, "canvas" | "renderer"> {
	/** Seed for deterministic RNG (required for reproducibility). */
	seed: number;
}

/**
 * A Game instance pre-configured for headless execution.
 * No rendering, deterministic by default.
 *
 * @example
 * const game = new HeadlessGame({ width: 320, height: 240, seed: 42 });
 * game.start(MyScene);
 * game.runFor(10); // 10 seconds at 60fps
 */
export class HeadlessGame extends Game {
	constructor(options: HeadlessGameOptions) {
		const canvas = _createCanvasStub(options.width, options.height);
		super({
			...options,
			canvas,
			renderer: null,
		});
	}

	/**
	 * Run the game for a given number of seconds of game time.
	 * @param seconds - Duration in game-time seconds
	 * @returns The number of fixed frames stepped
	 */
	runFor(seconds: number): number {
		const frames = Math.round(seconds / this.fixedDeltaTime);
		for (let i = 0; i < frames; i++) {
			this.step();
		}
		return frames;
	}

	/**
	 * Run the game until a condition is met or a timeout is reached.
	 * @param condition - Checked after each frame. Return true to stop.
	 * @param maxSeconds - Maximum game-time before giving up. Default: 60.
	 * @returns true if condition was met, false if timed out.
	 */
	runUntil(condition: () => boolean, maxSeconds = 60): boolean {
		const maxFrames = Math.round(maxSeconds / this.fixedDeltaTime);
		for (let i = 0; i < maxFrames; i++) {
			this.step();
			if (condition()) return true;
		}
		return false;
	}
}

function _createCanvasStub(width: number, height: number): HTMLCanvasElement {
	if (typeof document !== "undefined") {
		const canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = height;
		return canvas;
	}
	return {
		width,
		height,
		style: {},
		getContext: () => null,
		toDataURL: () => "",
	} as unknown as HTMLCanvasElement;
}
