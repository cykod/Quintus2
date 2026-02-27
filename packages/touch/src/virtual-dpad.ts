import type { DrawContext } from "@quintus/core";
import { Color, Vec2 } from "@quintus/math";
import { VirtualControl } from "./virtual-control.js";

export interface VirtualDPadConfig {
	position: Vec2;
	buttonSize?: number;
	actions: {
		left?: string;
		right?: string;
		up?: string;
		down?: string;
	};
}

type Direction = "left" | "right" | "up" | "down";

/**
 * 4-way directional pad with dominant-axis selection.
 * Delays release by 1 frame so isJustPressed fires for quick taps.
 */
export class VirtualDPad extends VirtualControl {
	readonly buttonSize: number;
	readonly actions: { left?: string; right?: string; up?: string; down?: string };

	private _activeDirection: Direction | null = null;
	private _pendingRelease: string | null = null;

	constructor(config: VirtualDPadConfig) {
		super();
		this.position = config.position;
		this.buttonSize = config.buttonSize ?? 30;
		this.actions = config.actions;
	}

	get activeDirection(): Direction | null {
		return this._activeDirection;
	}

	containsPoint(x: number, y: number): boolean {
		const dx = Math.abs(x - this.position.x);
		const dy = Math.abs(y - this.position.y);
		const generous = this.buttonSize * 1.5 * 1.3;
		return dx <= generous && dy <= generous;
	}

	private _directionFromPoint(x: number, y: number): Direction {
		const dx = x - this.position.x;
		const dy = y - this.position.y;
		if (Math.abs(dx) >= Math.abs(dy)) {
			return dx < 0 ? "left" : "right";
		}
		return dy < 0 ? "up" : "down";
	}

	_onTouchStart(x: number, y: number): void {
		const dir = this._directionFromPoint(x, y);
		this._activeDirection = dir;
		const action = this.actions[dir];
		if (action) {
			// Cancel any pending release for this action
			if (this._pendingRelease === action) {
				this._pendingRelease = null;
			}
			this.input.inject(action, true);
		}
	}

	_onTouchMove(x: number, y: number): void {
		const newDir = this._directionFromPoint(x, y);
		if (newDir === this._activeDirection) return;

		// Release old direction
		const oldAction = this._activeDirection ? this.actions[this._activeDirection] : undefined;
		if (oldAction) {
			this.input.inject(oldAction, false);
		}

		// Press new direction
		this._activeDirection = newDir;
		const newAction = this.actions[newDir];
		if (newAction) {
			if (this._pendingRelease === newAction) {
				this._pendingRelease = null;
			}
			this.input.inject(newAction, true);
		}
	}

	_onTouchEnd(): void {
		const action = this._activeDirection ? this.actions[this._activeDirection] : undefined;
		this._activeDirection = null;
		if (action) {
			// Delay release by 1 frame so isJustPressed fires for quick taps
			this._pendingRelease = action;
		}
	}

	override onFixedUpdate(_dt: number): void {
		if (this._pendingRelease) {
			this.input.inject(this._pendingRelease, false);
			this._pendingRelease = null;
		}
	}

	override onDraw(ctx: DrawContext): void {
		const color = Color.WHITE;
		const s = this.buttonSize;
		const hs = s / 2;

		const dirs: Array<{ dir: Direction; offset: Vec2; points: Vec2[] }> = [
			{
				dir: "up",
				offset: new Vec2(0, -s),
				points: [new Vec2(-hs, hs * 0.5), new Vec2(0, -hs * 0.5), new Vec2(hs, hs * 0.5)],
			},
			{
				dir: "down",
				offset: new Vec2(0, s),
				points: [new Vec2(-hs, -hs * 0.5), new Vec2(0, hs * 0.5), new Vec2(hs, -hs * 0.5)],
			},
			{
				dir: "left",
				offset: new Vec2(-s, 0),
				points: [new Vec2(hs * 0.5, -hs), new Vec2(-hs * 0.5, 0), new Vec2(hs * 0.5, hs)],
			},
			{
				dir: "right",
				offset: new Vec2(s, 0),
				points: [new Vec2(-hs * 0.5, -hs), new Vec2(hs * 0.5, 0), new Vec2(-hs * 0.5, hs)],
			},
		];

		for (const { dir, offset, points } of dirs) {
			const active = this._activeDirection === dir;
			const translated = points.map((p) => p.add(offset));
			ctx.polygon(translated, {
				fill: active ? color.withAlpha(0.6) : color.withAlpha(0.2),
				stroke: color.withAlpha(0.5),
				strokeWidth: 1,
			});
		}
	}
}
