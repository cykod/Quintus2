import { VirtualControl } from "./virtual-control.js";

export interface TouchFollowZoneConfig {
	/** Fixed Y coordinate to use for the mouse position. If undefined, uses the touch Y. */
	followY?: number;
	/** Action to inject on tap (press on touch start, release on touch end). */
	tapAction?: string;
}

/**
 * Full-screen catch-all zone that sets the mouse position to the touch X.
 * Used for breakout-style paddle tracking where the paddle follows the finger.
 *
 * Must be added **last** in the overlay controls array so discrete buttons
 * get hit-test priority.
 */
export class TouchFollowZone extends VirtualControl {
	readonly followY: number | undefined;
	readonly tapAction: string | undefined;
	private _active = false;

	constructor(config?: TouchFollowZoneConfig) {
		super();
		this.followY = config?.followY;
		this.tapAction = config?.tapAction;
	}

	get active(): boolean {
		return this._active;
	}

	/** Always returns true — this is a full-screen catch-all. */
	containsPoint(_x: number, _y: number): boolean {
		return true;
	}

	_onTouchStart(x: number, y: number): void {
		this._active = true;
		this._updateMousePosition(x, y);
		if (this.tapAction) {
			this.input.inject(this.tapAction, true);
		}
	}

	_onTouchMove(x: number, y: number): void {
		if (!this._active) return;
		this._updateMousePosition(x, y);
	}

	_onTouchEnd(): void {
		this._active = false;
		if (this.tapAction) {
			this.input.inject(this.tapAction, false);
		}
	}

	private _updateMousePosition(x: number, y: number): void {
		const targetY = this.followY ?? y;
		this.input.setMousePosition(x, targetY);
	}
}
