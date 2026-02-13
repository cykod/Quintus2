import { Color, Vec2 } from "@quintus/math";
import type { AssetLoader } from "./asset-loader.js";
import type {
	DrawContext,
	LineStyle,
	ShapeStyle,
	SpriteDrawOptions,
	TextStyle,
} from "./draw-context.js";
import type { Node } from "./node.js";
import { Node2D } from "./node2d.js";
import type { Renderer } from "./renderer.js";
import type { Scene } from "./scene.js";

class Canvas2DDrawContext implements DrawContext {
	constructor(
		private readonly ctx: CanvasRenderingContext2D,
		readonly assets: AssetLoader,
	) {}

	line(from: Vec2, to: Vec2, style?: LineStyle): void {
		const ctx = this.ctx;
		ctx.beginPath();
		ctx.moveTo(from.x, from.y);
		ctx.lineTo(to.x, to.y);
		ctx.strokeStyle = (style?.color ?? Color.WHITE).toCSS();
		ctx.lineWidth = style?.width ?? 1;
		ctx.stroke();
	}

	rect(pos: Vec2, size: Vec2, style?: ShapeStyle): void {
		const ctx = this.ctx;
		if (style?.fill) {
			ctx.fillStyle = style.fill.toCSS();
			ctx.fillRect(pos.x, pos.y, size.x, size.y);
		}
		if (style?.stroke) {
			ctx.strokeStyle = style.stroke.toCSS();
			ctx.lineWidth = style?.strokeWidth ?? 1;
			ctx.strokeRect(pos.x, pos.y, size.x, size.y);
		}
	}

	circle(center: Vec2, radius: number, style?: ShapeStyle): void {
		const ctx = this.ctx;
		ctx.beginPath();
		ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
		if (style?.fill) {
			ctx.fillStyle = style.fill.toCSS();
			ctx.fill();
		}
		if (style?.stroke) {
			ctx.strokeStyle = style.stroke.toCSS();
			ctx.lineWidth = style?.strokeWidth ?? 1;
			ctx.stroke();
		}
	}

	polygon(points: Vec2[], style?: ShapeStyle): void {
		if (points.length < 2) return;
		const ctx = this.ctx;
		ctx.beginPath();
		const first = points[0] as Vec2;
		ctx.moveTo(first.x, first.y);
		for (let i = 1; i < points.length; i++) {
			const pt = points[i] as Vec2;
			ctx.lineTo(pt.x, pt.y);
		}
		ctx.closePath();
		if (style?.fill) {
			ctx.fillStyle = style.fill.toCSS();
			ctx.fill();
		}
		if (style?.stroke) {
			ctx.strokeStyle = style.stroke.toCSS();
			ctx.lineWidth = style?.strokeWidth ?? 1;
			ctx.stroke();
		}
	}

	text(text: string, pos: Vec2, style?: TextStyle): void {
		const ctx = this.ctx;
		const size = style?.size ?? 16;
		const font = style?.font ?? "sans-serif";
		ctx.font = `${size}px ${font}`;
		ctx.fillStyle = (style?.color ?? Color.WHITE).toCSS();
		ctx.textAlign = style?.align ?? "left";
		ctx.textBaseline = style?.baseline ?? "top";
		ctx.fillText(text, pos.x, pos.y);
	}

	measureText(text: string, style?: TextStyle): Vec2 {
		const ctx = this.ctx;
		const size = style?.size ?? 16;
		const font = style?.font ?? "sans-serif";
		ctx.font = `${size}px ${font}`;
		const metrics = ctx.measureText(text);
		return new Vec2(metrics.width, size);
	}

	image(name: string, pos: Vec2, options?: SpriteDrawOptions): void {
		const img = this.assets.getImage(name);
		if (!img) return;

		const ctx = this.ctx;
		const src = options?.sourceRect;
		const flipH = options?.flipH ?? false;
		const flipV = options?.flipV ?? false;
		const dw = options?.width ?? (src ? src.width : img.width);
		const dh = options?.height ?? (src ? src.height : img.height);

		ctx.save();
		let drawX = pos.x;
		let drawY = pos.y;
		if (flipH || flipV) {
			ctx.translate(flipH ? pos.x + dw : pos.x, flipV ? pos.y + dh : pos.y);
			ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
			drawX = flipH ? 0 : pos.x;
			drawY = flipV ? 0 : pos.y;
			if (flipH && flipV) {
				drawX = 0;
				drawY = 0;
			}
		}

		if (src) {
			ctx.drawImage(img, src.x, src.y, src.width, src.height, drawX, drawY, dw, dh);
		} else {
			ctx.drawImage(img, drawX, drawY, dw, dh);
		}
		ctx.restore();
	}

	save(): void {
		this.ctx.save();
	}
	restore(): void {
		this.ctx.restore();
	}
	setAlpha(alpha: number): void {
		this.ctx.globalAlpha = alpha;
	}
}

/** The base Node2D.onDraw — used to detect overrides via prototype comparison. */
const baseOnDraw = Node2D.prototype.onDraw;

/**
 * Canvas2D implementation of the rendering pipeline.
 * Handles: transform cascade, z-sorting, visibility culling, draw dispatch.
 */
export class Canvas2DRenderer implements Renderer {
	private readonly ctx: CanvasRenderingContext2D;
	private readonly drawContext: Canvas2DDrawContext;
	private readonly gameWidth: number;
	private readonly gameHeight: number;
	private readonly backgroundColor: string;

	// Pre-allocated render list — reused between frames
	private renderList: Node2D[] = [];
	private _renderListDirty = true;

	constructor(
		canvas: HTMLCanvasElement,
		width: number,
		height: number,
		backgroundColor: string,
		assets: AssetLoader,
	) {
		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("Failed to get 2D rendering context");
		this.ctx = ctx;
		this.drawContext = new Canvas2DDrawContext(ctx, assets);
		this.gameWidth = width;
		this.gameHeight = height;
		this.backgroundColor = backgroundColor;
	}

	/** Mark render list as needing rebuild. */
	markRenderDirty(): void {
		this._renderListDirty = true;
	}

	get renderListDirty(): boolean {
		return this._renderListDirty;
	}

	/** Clear the canvas and render the entire scene tree. */
	render(scene: Scene): void {
		const ctx = this.ctx;

		// 1. Clear
		ctx.clearRect(0, 0, this.gameWidth, this.gameHeight);
		if (this.backgroundColor) {
			ctx.fillStyle = this.backgroundColor;
			ctx.fillRect(0, 0, this.gameWidth, this.gameHeight);
		}

		// 2. Rebuild render list only when dirty
		if (this._renderListDirty) {
			this.renderList.length = 0;
			this.collectVisible(scene, this.renderList);
			this.renderList.sort((a, b) => a.zIndex - b.zIndex);
			this._renderListDirty = false;
		}

		// 3. Draw each node
		for (const node of this.renderList) {
			ctx.save();

			const t = node.globalTransform;
			ctx.setTransform(t.a, t.b, t.c, t.d, t.e, t.f);

			try {
				node.onDraw(this.drawContext);
			} catch (_err) {
				// Lifecycle error handling is done by scene
			}

			ctx.restore();
		}
	}

	private collectVisible(node: Node, list: Node2D[]): void {
		if (node instanceof Node2D) {
			if (!node.visible) return;
			// Prototype check: only collect nodes that override onDraw beyond Node2D's no-op
			if (node.onDraw !== baseOnDraw) {
				list.push(node);
			}
		}
		for (const child of node.children) {
			this.collectVisible(child, list);
		}
	}
}
