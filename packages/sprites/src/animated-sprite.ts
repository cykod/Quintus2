import { type DrawContext, Node2D, type Signal, signal } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import type { Animation, SpriteSheet } from "./sprite-sheet.js";

export class AnimatedSprite extends Node2D {
	/** The sprite sheet containing frame and animation data. */
	spriteSheet: SpriteSheet | null = null;

	/** Animation to auto-play on ready. Set via props pattern: add(AnimatedSprite, { animation: "idle" }). */
	animation: string | null = null;

	/** Whether the sprite is drawn centered at its origin. Default: true. */
	centered = true;

	/** Flip the sprite horizontally. */
	flipH = false;

	/** Flip the sprite vertically. */
	flipV = false;

	/** Opacity (0 = invisible, 1 = fully opaque). Default: 1. */
	alpha = 1;

	/** Playback speed multiplier (1 = normal, 2 = double speed). */
	speed = 1;

	// === Signals ===

	/** Fires when a non-looping animation reaches its last frame. Payload: animation name. */
	readonly animationFinished: Signal<string> = signal<string>();

	/** Fires when the animation changes. */
	readonly animationChanged: Signal<{ from: string; to: string }> = signal();

	/** Fires each time the frame advances. Payload: frame index within animation. */
	readonly frameChanged: Signal<number> = signal<number>();

	// === Read-only State ===

	/** Currently playing animation name. Empty string if none. */
	get currentAnimation(): string {
		return this._currentAnim;
	}

	/** Current frame index within the animation's frames array. */
	get frame(): number {
		return this._frame;
	}

	/** Set the current frame manually (clamps to valid range). */
	set frame(value: number) {
		const anim = this._getAnim();
		if (!anim) return;
		this._frame = Math.max(0, Math.min(value, anim.frames.length - 1));
		this.frameChanged.emit(this._frame);
	}

	/** Whether an animation is currently playing. */
	get playing(): boolean {
		return this._playing;
	}

	// === Playback Control ===

	/**
	 * Play a named animation.
	 * @param name - Animation name (must exist in spriteSheet).
	 * @param restart - If true, restart even if already playing this animation.
	 */
	play(name: string, restart = false): void {
		if (!this.spriteSheet) return;

		if (this._currentAnim === name && this._playing && !restart) return;

		const anim = this.spriteSheet.getAnimation(name);
		if (!anim) {
			throw new Error(
				`Animation "${name}" not found. Available: ${this.spriteSheet.animationNames.join(", ")}`,
			);
		}

		const prev = this._currentAnim;
		this._currentAnim = name;
		this._frame = 0;
		this._elapsed = 0;
		this._playing = true;

		if (prev !== name) {
			this.animationChanged.emit({ from: prev, to: name });
		}
	}

	/** Stop playback. Keeps current frame. */
	stop(): void {
		this._playing = false;
	}

	/** Pause playback. Alias for stop(). */
	pause(): void {
		this._playing = false;
	}

	// === Lifecycle ===

	onReady(): void {
		if (this.animation) {
			this.play(this.animation);
		}
	}

	onUpdate(dt: number): void {
		if (!this._playing || !this.spriteSheet) return;

		const anim = this._getAnim();
		if (!anim || anim.frames.length === 0) return;

		this._elapsed += dt * this.speed;
		const frameDuration = 1 / anim.fps;

		while (this._elapsed >= frameDuration) {
			this._elapsed -= frameDuration;
			this._frame++;

			if (this._frame >= anim.frames.length) {
				if (anim.loop) {
					this._frame = 0;
				} else {
					this._frame = anim.frames.length - 1;
					this._playing = false;
					this.animationFinished.emit(this._currentAnim);
					this._elapsed = 0;
					break;
				}
			}

			this.frameChanged.emit(this._frame);
		}
	}

	onDraw(ctx: DrawContext): void {
		if (!this.spriteSheet || !this._currentAnim) return;

		const anim = this._getAnim();
		if (!anim || anim.frames.length === 0) return;

		const sheetFrame = anim.frames[this._frame];
		if (sheetFrame === undefined) return;

		const rect = this.spriteSheet.getFrameRect(sheetFrame);
		const w = this.spriteSheet.frameWidth;
		const h = this.spriteSheet.frameHeight;

		if (this.alpha < 1) ctx.setAlpha(this.alpha);

		this._drawOffset._set(this.centered ? -w / 2 : 0, this.centered ? -h / 2 : 0);

		ctx.image(this.spriteSheet.texture, this._drawOffset, {
			sourceRect: rect,
			flipH: this.flipH,
			flipV: this.flipV,
		});
	}

	// === Internal ===
	private _currentAnim = "";
	private _frame = 0;
	private _playing = false;
	private _elapsed = 0;
	protected _drawOffset = new Vec2(0, 0);

	private _getAnim(): Animation | undefined {
		return this.spriteSheet?.getAnimation(this._currentAnim);
	}
}
