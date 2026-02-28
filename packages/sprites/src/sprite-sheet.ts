import { Rect } from "@quintus/math";
import type { TextureAtlas } from "./texture-atlas.js";

export interface AnimationConfig {
	/** Frame indices into the sprite sheet grid. */
	frames: number[];
	/** Playback speed in frames per second. Default: 10. */
	fps?: number;
	/** Whether the animation loops. Default: true. */
	loop?: boolean;
}

/** Animation config using TextureAtlas frame names instead of grid indices. */
export interface AtlasAnimationConfig {
	/** Frame names from the TextureAtlas. */
	frames: string[];
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

	private _frameRects: Rect[];
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
	 * Create a SpriteSheet from a TextureAtlas with string-named animation frames.
	 *
	 * Instead of specifying grid layout (columns, spacing) and mapping frame names
	 * to grid indices manually, this factory takes frame names directly and looks
	 * up their source rectangles from the atlas.
	 *
	 * All referenced frames must have the same dimensions (width and height).
	 *
	 * @example
	 * ```ts
	 * const atlas = TextureAtlas.fromXml(xml, "characters");
	 * const sheet = SpriteSheet.fromAtlas(atlas, {
	 *   idle: { frames: ["character_green_idle"], fps: 1 },
	 *   walk: { frames: ["character_green_walk_a", "character_green_walk_b"], fps: 6 },
	 *   jump: { frames: ["character_green_jump"], fps: 1, loop: false },
	 * });
	 * ```
	 */
	static fromAtlas(
		atlas: TextureAtlas,
		animations: Record<string, AtlasAnimationConfig>,
	): SpriteSheet {
		// Collect all unique frame names and assign sequential indices
		const uniqueFrames: string[] = [];
		const nameToIndex = new Map<string, number>();

		for (const anim of Object.values(animations)) {
			for (const name of anim.frames) {
				if (!nameToIndex.has(name)) {
					nameToIndex.set(name, uniqueFrames.length);
					uniqueFrames.push(name);
				}
			}
		}

		if (uniqueFrames.length === 0) {
			throw new Error("SpriteSheet.fromAtlas: no frames specified in animations.");
		}

		// Look up all rects and validate uniform dimensions
		const atlasRects: Rect[] = [];
		const firstName = uniqueFrames[0] as string;
		const firstRect = atlas.getFrameOrThrow(firstName);
		atlasRects.push(firstRect);

		for (let i = 1; i < uniqueFrames.length; i++) {
			const frameName = uniqueFrames[i] as string;
			const rect = atlas.getFrameOrThrow(frameName);
			if (rect.width !== firstRect.width || rect.height !== firstRect.height) {
				throw new Error(
					`SpriteSheet.fromAtlas: frame "${frameName}" is ${rect.width}x${rect.height}, ` +
						`but expected ${firstRect.width}x${firstRect.height} (all frames must be the same size).`,
				);
			}
			atlasRects.push(rect);
		}

		// Convert string-based animations to index-based
		const indexedAnimations: Record<string, AnimationConfig> = {};
		for (const [animName, anim] of Object.entries(animations)) {
			indexedAnimations[animName] = {
				frames: anim.frames.map((name) => nameToIndex.get(name) as number),
				fps: anim.fps,
				loop: anim.loop,
			};
		}

		// Create a SpriteSheet with a virtual single-row layout, then replace frame rects
		const sheet = new SpriteSheet({
			texture: atlas.texture,
			frameWidth: firstRect.width,
			frameHeight: firstRect.height,
			columns: uniqueFrames.length,
			rows: 1,
			animations: indexedAnimations,
		});

		// Replace the grid-computed rects with actual atlas rects
		sheet._frameRects = atlasRects;

		return sheet;
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
