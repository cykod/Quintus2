import { Node2D } from "@quintus/core";
import type { VirtualControl } from "./virtual-control.js";

/**
 * Root container for virtual touch controls.
 * Manages multi-touch dispatch: each pointer is tracked to one control,
 * and events are forwarded to that control until the pointer lifts.
 * Touch events that hit a control are stopped; misses pass through.
 */
export class TouchOverlay extends Node2D {
	readonly controls: VirtualControl[] = [];
	private _pointers = new Map<number, VirtualControl>();

	private _onPointerDown: ((e: PointerEvent) => void) | null = null;
	private _onPointerMove: ((e: PointerEvent) => void) | null = null;
	private _onPointerUp: ((e: PointerEvent) => void) | null = null;
	private _onPointerCancel: ((e: PointerEvent) => void) | null = null;

	constructor() {
		super();
		this.renderFixed = true;
		this.zIndex = 9999;
	}

	addControl(control: VirtualControl): void {
		this.controls.push(control);
		this.add(control);
	}

	override onEnterTree(): void {
		const canvas = this.game.canvas;
		if (!canvas) return;

		this._onPointerDown = (e: PointerEvent) => {
			if (e.pointerType !== "touch") return;
			const pos = this._toLocal(e);
			for (const control of this.controls) {
				if (control.containsPoint(pos.x, pos.y)) {
					this._pointers.set(e.pointerId, control);
					control._onTouchStart(pos.x, pos.y);
					e.stopImmediatePropagation();
					e.preventDefault();
					return;
				}
			}
			// Miss — pass through to game
		};

		this._onPointerMove = (e: PointerEvent) => {
			if (e.pointerType !== "touch") return;
			const current = this._pointers.get(e.pointerId);
			if (!current) return;
			const pos = this._toLocal(e);

			// If pointer is still inside the current control, forward the move
			if (current.containsPoint(pos.x, pos.y)) {
				current._onTouchMove(pos.x, pos.y);
				e.stopImmediatePropagation();
				e.preventDefault();
				return;
			}

			// Pointer slid outside current control — release it
			current._onTouchEnd();

			// Check if pointer entered a different control
			for (const control of this.controls) {
				if (control !== current && control.containsPoint(pos.x, pos.y)) {
					this._pointers.set(e.pointerId, control);
					control._onTouchStart(pos.x, pos.y);
					e.stopImmediatePropagation();
					e.preventDefault();
					return;
				}
			}

			// Pointer is in dead zone — untrack it
			this._pointers.delete(e.pointerId);
			e.stopImmediatePropagation();
			e.preventDefault();
		};

		this._onPointerUp = (e: PointerEvent) => {
			if (e.pointerType !== "touch") return;
			const control = this._pointers.get(e.pointerId);
			if (!control) return;
			control._onTouchEnd();
			this._pointers.delete(e.pointerId);
			e.stopImmediatePropagation();
			e.preventDefault();
		};

		this._onPointerCancel = (e: PointerEvent) => {
			if (e.pointerType !== "touch") return;
			const control = this._pointers.get(e.pointerId);
			if (!control) return;
			control._onTouchEnd();
			this._pointers.delete(e.pointerId);
			e.stopImmediatePropagation();
			e.preventDefault();
		};

		canvas.addEventListener("pointerdown", this._onPointerDown, true);
		canvas.addEventListener("pointermove", this._onPointerMove, true);
		canvas.addEventListener("pointerup", this._onPointerUp, true);
		canvas.addEventListener("pointercancel", this._onPointerCancel, true);
	}

	override onExitTree(): void {
		const canvas = this.gameOrNull?.canvas;
		if (!canvas) return;

		if (this._onPointerDown) canvas.removeEventListener("pointerdown", this._onPointerDown, true);
		if (this._onPointerMove) canvas.removeEventListener("pointermove", this._onPointerMove, true);
		if (this._onPointerUp) canvas.removeEventListener("pointerup", this._onPointerUp, true);
		if (this._onPointerCancel)
			canvas.removeEventListener("pointercancel", this._onPointerCancel, true);

		this._onPointerDown = null;
		this._onPointerMove = null;
		this._onPointerUp = null;
		this._onPointerCancel = null;
		this._pointers.clear();
	}

	private _toLocal(e: PointerEvent): { x: number; y: number } {
		const canvas = this.game.canvas;
		const rect = canvas.getBoundingClientRect();
		return {
			x: (e.clientX - rect.left) * (this.game.width / rect.width),
			y: (e.clientY - rect.top) * (this.game.height / rect.height),
		};
	}
}
