import { Rect } from "@quintus/math";

export interface AnimationConfig {
	/** Frame indices into the sprite sheet grid. */
	frames: number[];
	/** Playback speed in frames per second. Default: 10. */
	fps?: number;
	/** Whether the animation loops. Default: true. */
	loop?: boolean;
}

export interface SpriteSheetConfig {
	/** Texture asset name (must be loaded via game.assets). */
	texture: string;
	/** Width of each frame in pixels. */
	frameWidth: number;
	/** Height of each frame in pixels. */
	frameHeight: number;
	/** Number of columns in the grid. Required. */
	columns: number;
	/** Number of rows in the grid. Optional — defaults to ceil(maxFrame / columns). */
	rows?: number;
	/** Margin around the entire sheet in pixels. Default: 0. */
	margin?: number;
	/** Spacing between frames in pixels. Default: 0. */
	spacing?: number;
	/** Named animations. */
	animations?: Record<string, AnimationConfig>;
}

export interface Animation {
	readonly name: string;
	readonly frames: readonly number[];
	readonly fps: number;
	readonly loop: boolean;
}

export class SpriteSheet {
	readonly texture: string;
	readonly frameWidth: number;
	readonly frameHeight: number;
	readonly columns: number;
	readonly rows: number;
	readonly margin: number;
	readonly spacing: number;

	private readonly _frameRects: Rect[];
	private readonly _animations: Map<string, Animation>;

	constructor(config: SpriteSheetConfig) {
		this.texture = config.texture;
		this.frameWidth = config.frameWidth;
		this.frameHeight = config.frameHeight;
		this.columns = config.columns;
		this.margin = config.margin ?? 0;
		this.spacing = config.spacing ?? 0;

		const maxFrame = this._findMaxFrame(config.animations);
		this.rows = config.rows ?? Math.ceil((maxFrame + 1) / this.columns);

		// Pre-compute all frame rectangles (zero allocation in hot path)
		this._frameRects = [];
		const totalFrames = this.columns * this.rows;
		for (let i = 0; i < totalFrames; i++) {
			const col = i % this.columns;
			const row = Math.floor(i / this.columns);
			this._frameRects.push(
				new Rect(
					this.margin + col * (this.frameWidth + this.spacing),
					this.margin + row * (this.frameHeight + this.spacing),
					this.frameWidth,
					this.frameHeight,
				),
			);
		}

		// Build animation map
		this._animations = new Map();
		for (const [name, anim] of Object.entries(config.animations ?? {})) {
			this._animations.set(name, {
				name,
				frames: Object.freeze([...anim.frames]),
				fps: anim.fps ?? 10,
				loop: anim.loop ?? true,
			});
		}
	}

	/** Get the source rectangle for a frame index. Cached — zero allocation. */
	getFrameRect(index: number): Rect {
		return this._frameRects[index] ?? (this._frameRects[0] as Rect);
	}

	/** Get a named animation. Returns undefined if not found. */
	getAnimation(name: string): Animation | undefined {
		return this._animations.get(name);
	}

	/** Check if an animation exists. */
	hasAnimation(name: string): boolean {
		return this._animations.has(name);
	}

	/** Get all animation names. */
	get animationNames(): string[] {
		return [...this._animations.keys()];
	}

	/** Total number of frames in the grid. */
	get frameCount(): number {
		return this._frameRects.length;
	}

	/**
	 * Create a SpriteSheet from JSON config + image dimensions.
	 * Convenience for when columns isn't known ahead of time.
	 */
	static fromJSON(
		json: Omit<SpriteSheetConfig, "columns"> & { columns?: number },
		imageWidth?: number,
	): SpriteSheet {
		const columns = json.columns ?? (imageWidth ? Math.floor(imageWidth / json.frameWidth) : 1);
		return new SpriteSheet({ ...json, columns });
	}

	private _findMaxFrame(animations?: Record<string, AnimationConfig>): number {
		if (!animations) return 0;
		let max = 0;
		for (const anim of Object.values(animations)) {
			for (const f of anim.frames) {
				if (f > max) max = f;
			}
		}
		return max;
	}
}
