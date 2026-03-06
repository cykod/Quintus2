import { Node2D } from "@quintus/core";
import type { VirtualControl } from "./virtual-control.js";

/**
 * Root container for virtual touch controls.
 * Manages multi-touch dispatch: each pointer is tracked to one control,
 * and events are forwarded to that control until the pointer lifts.
 *
 * Uses native touch events as the primary input path for real touch devices
 * (most reliable on iOS Safari). Falls back to pointer events for environments
 * without touch events (jsdom tests, Chrome DevTools touch emulation).
 */
export class TouchOverlay extends Node2D {
	readonly controls: VirtualControl[] = [];
	private _pointers = new Map<number, VirtualControl | null>();

	/** Set true on first touchstart; causes pointer handlers to skip touch. */
	private _hasTouchEvents = false;

	// Pointer event handlers (fallback for non-touch environments)
	private _onPointerDown: ((e: PointerEvent) => void) | null = null;
	private _onPointerMove: ((e: PointerEvent) => void) | null = null;
	private _onPointerUp: ((e: PointerEvent) => void) | null = null;
	private _onPointerCancel: ((e: PointerEvent) => void) | null = null;

	// Touch event handlers (primary for real touch devices)
	private _onTouchStartHandler: ((e: TouchEvent) => void) | null = null;
	private _onTouchMoveHandler: ((e: TouchEvent) => void) | null = null;
	private _onTouchEndHandler: ((e: TouchEvent) => void) | null = null;
	private _onTouchCancelHandler: ((e: TouchEvent) => void) | null = null;

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

		// --- Touch event handlers (primary path for real touch devices) ---

		this._onTouchStartHandler = (e: TouchEvent) => {
			this._hasTouchEvents = true;
			let hit = false;
			for (let i = 0; i < e.changedTouches.length; i++) {
				const touch = e.changedTouches[i];
				if (!touch) continue;
				const pos = this._toLocal(touch);
				if (this._handleStart(touch.identifier, pos.x, pos.y)) hit = true;
			}
			if (hit) e.preventDefault();
		};

		this._onTouchMoveHandler = (e: TouchEvent) => {
			let tracked = false;
			for (let i = 0; i < e.changedTouches.length; i++) {
				const touch = e.changedTouches[i];
				if (!touch) continue;
				if (!this._pointers.has(touch.identifier)) continue;
				tracked = true;
				const pos = this._toLocal(touch);
				this._handleMove(touch.identifier, pos.x, pos.y);
			}
			if (tracked) e.preventDefault();
		};

		this._onTouchEndHandler = (e: TouchEvent) => {
			for (let i = 0; i < e.changedTouches.length; i++) {
				const touch = e.changedTouches[i];
				if (!touch) continue;
				this._handleEnd(touch.identifier);
			}
		};

		this._onTouchCancelHandler = (e: TouchEvent) => {
			for (let i = 0; i < e.changedTouches.length; i++) {
				const touch = e.changedTouches[i];
				if (!touch) continue;
				this._handleEnd(touch.identifier);
			}
		};

		// --- Pointer event handlers (fallback: jsdom tests, DevTools emulation) ---

		this._onPointerDown = (e: PointerEvent) => {
			if (e.pointerType !== "touch") return;
			if (this._hasTouchEvents) return;
			const pos = this._toLocal(e);
			if (this._handleStart(e.pointerId, pos.x, pos.y)) {
				e.stopImmediatePropagation();
				e.preventDefault();
			}
		};

		this._onPointerMove = (e: PointerEvent) => {
			if (e.pointerType !== "touch") return;
			if (this._hasTouchEvents) return;
			if (!this._pointers.has(e.pointerId)) return;
			const pos = this._toLocal(e);
			this._handleMove(e.pointerId, pos.x, pos.y);
			e.stopImmediatePropagation();
			e.preventDefault();
		};

		this._onPointerUp = (e: PointerEvent) => {
			if (e.pointerType !== "touch") return;
			if (this._hasTouchEvents) return;
			if (!this._pointers.has(e.pointerId)) return;
			this._handleEnd(e.pointerId);
			e.stopImmediatePropagation();
			e.preventDefault();
		};

		this._onPointerCancel = (e: PointerEvent) => {
			if (e.pointerType !== "touch") return;
			if (this._hasTouchEvents) return;
			if (!this._pointers.has(e.pointerId)) return;
			this._handleEnd(e.pointerId);
			e.stopImmediatePropagation();
			e.preventDefault();
		};

		// Touch events: bubble phase, non-passive (need preventDefault for scroll)
		canvas.addEventListener("touchstart", this._onTouchStartHandler, { passive: false });
		canvas.addEventListener("touchmove", this._onTouchMoveHandler, { passive: false });
		canvas.addEventListener("touchend", this._onTouchEndHandler);
		canvas.addEventListener("touchcancel", this._onTouchCancelHandler);

		// Pointer events: capture phase (existing behavior for fallback path)
		canvas.addEventListener("pointerdown", this._onPointerDown, true);
		canvas.addEventListener("pointermove", this._onPointerMove, true);
		canvas.addEventListener("pointerup", this._onPointerUp, true);
		canvas.addEventListener("pointercancel", this._onPointerCancel, true);
	}

	override onExitTree(): void {
		const canvas = this.gameOrNull?.canvas;
		if (!canvas) return;

		if (this._onTouchStartHandler)
			canvas.removeEventListener("touchstart", this._onTouchStartHandler);
		if (this._onTouchMoveHandler) canvas.removeEventListener("touchmove", this._onTouchMoveHandler);
		if (this._onTouchEndHandler) canvas.removeEventListener("touchend", this._onTouchEndHandler);
		if (this._onTouchCancelHandler)
			canvas.removeEventListener("touchcancel", this._onTouchCancelHandler);

		if (this._onPointerDown) canvas.removeEventListener("pointerdown", this._onPointerDown, true);
		if (this._onPointerMove) canvas.removeEventListener("pointermove", this._onPointerMove, true);
		if (this._onPointerUp) canvas.removeEventListener("pointerup", this._onPointerUp, true);
		if (this._onPointerCancel)
			canvas.removeEventListener("pointercancel", this._onPointerCancel, true);

		this._onTouchStartHandler = null;
		this._onTouchMoveHandler = null;
		this._onTouchEndHandler = null;
		this._onTouchCancelHandler = null;
		this._onPointerDown = null;
		this._onPointerMove = null;
		this._onPointerUp = null;
		this._onPointerCancel = null;
		this._pointers.clear();
		this._hasTouchEvents = false;
	}

	// --- Shared logic used by both touch and pointer paths ---

	/** Find the nearest control whose hit zone contains the point. */
	private _findNearest(x: number, y: number): VirtualControl | null {
		let nearest: VirtualControl | null = null;
		let nearestDist = Infinity;
		for (const control of this.controls) {
			if (control.containsPoint(x, y)) {
				const dx = x - control.position.x;
				const dy = y - control.position.y;
				const dist = dx * dx + dy * dy;
				if (dist < nearestDist) {
					nearest = control;
					nearestDist = dist;
				}
			}
		}
		return nearest;
	}

	/** Handle a new touch/pointer starting. Returns true if a control was hit. */
	private _handleStart(id: number, x: number, y: number): boolean {
		const nearest = this._findNearest(x, y);
		if (nearest !== null) {
			this._pointers.set(id, nearest);
			nearest._onTouchStart(x, y);
			return true;
		}
		return false;
	}

	/** Handle a tracked touch/pointer moving. Switches controls via nearest-match. */
	private _handleMove(id: number, x: number, y: number): void {
		const current = this._pointers.get(id) ?? null;
		const nearest = this._findNearest(x, y);

		if (nearest === current) {
			// Same control (or both null) — forward move if active
			if (current !== null) current._onTouchMove(x, y);
			return;
		}

		// Control changed — release old, activate new
		if (current !== null) current._onTouchEnd();
		if (nearest !== null) {
			this._pointers.set(id, nearest);
			nearest._onTouchStart(x, y);
		} else {
			this._pointers.set(id, null);
		}
	}

	/** Handle a tracked touch/pointer ending. */
	private _handleEnd(id: number): void {
		if (!this._pointers.has(id)) return;
		const control = this._pointers.get(id) ?? null;
		if (control !== null) control._onTouchEnd();
		this._pointers.delete(id);
	}

	/** Convert client coordinates to game coordinates. Works with PointerEvent or Touch. */
	private _toLocal(e: { clientX: number; clientY: number }): { x: number; y: number } {
		const canvas = this.game.canvas;
		const rect = canvas.getBoundingClientRect();
		return {
			x: (e.clientX - rect.left) * (this.game.width / rect.width),
			y: (e.clientY - rect.top) * (this.game.height / rect.height),
		};
	}
}
