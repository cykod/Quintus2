import { Node2D } from "@quintus/core";
import { getInput, type Input } from "@quintus/input";

/**
 * Abstract base class for all virtual touch controls.
 * Renders in fixed screen-space and dispatches touch events
 * into the engine's Input system via injection.
 */
export abstract class VirtualControl extends Node2D {
	constructor() {
		super();
		this.renderFixed = true;
	}

	/** Convenience accessor for the game's Input instance. */
	protected get input(): Input {
		const input = getInput(this.game);
		if (!input) throw new Error("InputPlugin must be installed before using virtual controls");
		return input;
	}

	/** Whether the given screen-space point hits this control. */
	abstract containsPoint(x: number, y: number): boolean;

	/** Called by TouchOverlay when a touch begins on this control. */
	abstract _onTouchStart(x: number, y: number): void;

	/** Called by TouchOverlay when a tracked touch moves. */
	abstract _onTouchMove(x: number, y: number): void;

	/** Called by TouchOverlay when a tracked touch ends or is cancelled. */
	abstract _onTouchEnd(): void;
}
