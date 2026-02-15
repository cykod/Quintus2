import type { CameraSnapshot, Node2D } from "@quintus/core";
import { Node, type Signal, signal } from "@quintus/core";
import { clamp, Matrix2D, Rect, Vec2 } from "@quintus/math";

export class Camera extends Node {
	// === Position ===

	/**
	 * Camera position in world space (what the camera is centered on).
	 * Auto-updated when following a target. Can be set manually.
	 */
	readonly position: Vec2 = new Vec2(0, 0);

	// === Follow ===

	/** Node to follow. Set to null for manual camera control. */
	follow: Node2D | null = null;

	/** Offset from the follow target in world space. */
	readonly offset: Vec2 = new Vec2(0, 0);

	/**
	 * Smoothing factor. 0 = instant snap, 0.9 = very slow cinematic follow.
	 * Framerate-independent: `1 - smoothing^(dt * 60)`.
	 */
	smoothing = 0;

	// === Zoom ===

	/** Zoom level. 1 = 100%, 2 = 200% magnification. */
	zoom = 1;

	/** When true, zoom snaps to nearest integer. */
	pixelPerfectZoom = false;

	// === Bounds ===

	/** World-space bounds the camera view cannot exceed. null = no bounds. */
	bounds: Rect | null = null;

	// === Dead Zone ===

	/**
	 * Dead zone rect in screen-space pixels, centered on screen.
	 * Target within dead zone: camera doesn't move. null = no dead zone.
	 */
	deadZone: Rect | null = null;

	// === Shake ===

	private _shakeIntensity = 0;
	private _shakeDuration = 0;
	private _shakeElapsed = 0;
	private _shakeOffsetX = 0;
	private _shakeOffsetY = 0;

	/** Emitted when camera shake finishes. */
	readonly shakeFinished: Signal<void> = signal<void>();

	/** Trigger a camera shake effect. */
	shake(intensity: number, duration: number): void {
		this._shakeIntensity = intensity;
		this._shakeDuration = duration;
		this._shakeElapsed = 0;
		this._shakeOffsetX = 0;
		this._shakeOffsetY = 0;
	}

	/** Whether the camera is currently shaking. */
	get isShaking(): boolean {
		return this._shakeElapsed < this._shakeDuration && this._shakeDuration > 0;
	}

	// === View Transform (cached) ===

	private _viewTransformDirty = true;
	private _cachedViewTransform = Matrix2D.IDENTITY;
	private _cachedInverseViewTransform = Matrix2D.IDENTITY;
	private _lastPosX = 0;
	private _lastPosY = 0;
	private _lastZoom = 1;
	private _lastShakeX = 0;
	private _lastShakeY = 0;

	/**
	 * The view transform matrix that converts world -> screen coordinates.
	 * Composed as: translate(viewport/2) x scale(zoom) x translate(-cameraPos)
	 */
	get viewTransform(): Matrix2D {
		this._checkDirty();
		if (this._viewTransformDirty) {
			this._recomputeViewTransform();
		}
		return this._cachedViewTransform;
	}

	/** Cached inverse view transform (screen -> world). */
	get inverseViewTransform(): Matrix2D {
		this._checkDirty();
		if (this._viewTransformDirty) {
			this._recomputeViewTransform();
		}
		return this._cachedInverseViewTransform;
	}

	/** The visible world-space rectangle. */
	get visibleRect(): Rect {
		const game = this.game;
		if (!game) return new Rect(0, 0, 0, 0);

		const z = this._effectiveZoom();
		const halfW = game.width / (2 * z);
		const halfH = game.height / (2 * z);
		return new Rect(this.position.x - halfW, this.position.y - halfH, halfW * 2, halfH * 2);
	}

	// === Coordinate Conversion ===

	/** Convert screen-space position to world-space. */
	screenToWorld(screenPos: Vec2): Vec2 {
		return this.inverseViewTransform.transformPoint(screenPos);
	}

	/** Convert world-space position to screen-space. */
	worldToScreen(worldPos: Vec2): Vec2 {
		return this.viewTransform.transformPoint(worldPos);
	}

	// === Serialization ===

	override serialize(): CameraSnapshot {
		const b = this.bounds;
		const dz = this.deadZone;
		return {
			...super.serialize(),
			position: { x: this.position.x, y: this.position.y },
			zoom: this.zoom,
			smoothing: this.smoothing,
			followTarget: this.follow ? this.follow.name || this.follow.constructor.name : null,
			bounds: b ? { x: b.x, y: b.y, width: b.width, height: b.height } : null,
			isShaking: this.isShaking,
			deadZone: dz ? { x: dz.x, y: dz.y, width: dz.width, height: dz.height } : null,
			pixelPerfectZoom: this.pixelPerfectZoom,
		};
	}

	// === Lifecycle ===

	onUpdate(dt: number): void {
		// Check if follow target is destroyed
		if (this.follow?.isDestroyed) {
			this.follow = null;
		}

		// Follow target
		if (this.follow) {
			const targetX = this.follow.globalPosition.x + this.offset.x;
			const targetY = this.follow.globalPosition.y + this.offset.y;

			if (this.deadZone) {
				this._applyDeadZone(targetX, targetY);
			} else if (this.smoothing > 0) {
				const t = 1 - this.smoothing ** (dt * 60);
				this.position.x += (targetX - this.position.x) * t;
				this.position.y += (targetY - this.position.y) * t;
			} else {
				this.position.x = targetX;
				this.position.y = targetY;
			}
		}

		// Clamp to bounds
		this._clampToBounds();

		// Update shake
		this._updateShake(dt);

		// Set the scene's viewTransform
		const scene = this.scene;
		if (scene) {
			scene.viewTransform = this.viewTransform;
		}
	}

	// === Internal ===

	private _effectiveZoom(): number {
		return this.pixelPerfectZoom ? Math.round(this.zoom) : this.zoom;
	}

	private _checkDirty(): void {
		if (
			this.position.x !== this._lastPosX ||
			this.position.y !== this._lastPosY ||
			this.zoom !== this._lastZoom ||
			this._shakeOffsetX !== this._lastShakeX ||
			this._shakeOffsetY !== this._lastShakeY
		) {
			this._viewTransformDirty = true;
		}
	}

	private _recomputeViewTransform(): void {
		const game = this.game;
		if (!game) {
			this._cachedViewTransform = Matrix2D.IDENTITY;
			this._cachedInverseViewTransform = Matrix2D.IDENTITY;
			this._viewTransformDirty = false;
			return;
		}

		const px = this.position.x + this._shakeOffsetX;
		const py = this.position.y + this._shakeOffsetY;
		const hw = game.width / 2;
		const hh = game.height / 2;
		const z = this._effectiveZoom();

		// T(viewport/2) x S(zoom) x T(-camPos)
		this._cachedViewTransform = new Matrix2D(
			z, // a: scaleX
			0, // b
			0, // c
			z, // d: scaleY
			-px * z + hw, // e: translateX
			-py * z + hh, // f: translateY
		);
		this._cachedInverseViewTransform = this._cachedViewTransform.inverse();

		this._lastPosX = this.position.x;
		this._lastPosY = this.position.y;
		this._lastZoom = this.zoom;
		this._lastShakeX = this._shakeOffsetX;
		this._lastShakeY = this._shakeOffsetY;
		this._viewTransformDirty = false;
	}

	private _clampToBounds(): void {
		if (!this.bounds || !this.game) return;

		const z = this._effectiveZoom();
		const halfViewW = this.game.width / (2 * z);
		const halfViewH = this.game.height / (2 * z);

		const minX = this.bounds.x + halfViewW;
		const maxX = this.bounds.x + this.bounds.width - halfViewW;
		const minY = this.bounds.y + halfViewH;
		const maxY = this.bounds.y + this.bounds.height - halfViewH;

		// If the level is smaller than the viewport, center it
		if (minX > maxX) {
			this.position.x = this.bounds.x + this.bounds.width / 2;
		} else {
			this.position.x = clamp(this.position.x, minX, maxX);
		}

		if (minY > maxY) {
			this.position.y = this.bounds.y + this.bounds.height / 2;
		} else {
			this.position.y = clamp(this.position.y, minY, maxY);
		}
	}

	private _applyDeadZone(targetX: number, targetY: number): void {
		if (!this.deadZone || !this.game) return;

		const z = this._effectiveZoom();
		// Convert dead zone from screen pixels to world units
		const dzLeft = this.deadZone.x / z;
		const dzTop = this.deadZone.y / z;
		const dzRight = (this.deadZone.x + this.deadZone.width) / z;
		const dzBottom = (this.deadZone.y + this.deadZone.height) / z;

		// Distance from camera to target in world space
		const dx = targetX - this.position.x;
		const dy = targetY - this.position.y;

		// Only move camera if target is outside dead zone
		if (dx < dzLeft) {
			this.position.x += dx - dzLeft;
		} else if (dx > dzRight) {
			this.position.x += dx - dzRight;
		}

		if (dy < dzTop) {
			this.position.y += dy - dzTop;
		} else if (dy > dzBottom) {
			this.position.y += dy - dzBottom;
		}
	}

	private _updateShake(dt: number): void {
		if (this._shakeDuration <= 0) return;

		this._shakeElapsed += dt;

		if (this._shakeElapsed >= this._shakeDuration) {
			// Shake finished
			this._shakeOffsetX = 0;
			this._shakeOffsetY = 0;
			this._shakeDuration = 0;
			this._shakeElapsed = 0;
			this._shakeIntensity = 0;
			this.shakeFinished.emit();
			return;
		}

		// Linear decay
		const progress = this._shakeElapsed / this._shakeDuration;
		const currentIntensity = this._shakeIntensity * (1 - progress);

		// Deterministic shake using game.random
		const random = this.game?.random;
		if (random) {
			this._shakeOffsetX = (random.next() * 2 - 1) * currentIntensity;
			this._shakeOffsetY = (random.next() * 2 - 1) * currentIntensity;
		}
	}
}
