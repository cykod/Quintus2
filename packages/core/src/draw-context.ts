import type { Color, Rect, Vec2 } from "@quintus/math";

export interface LineStyle {
	width?: number;
	color?: Color;
}

export interface ShapeStyle {
	fill?: Color;
	stroke?: Color;
	strokeWidth?: number;
}

export interface TextStyle {
	font?: string;
	size?: number;
	color?: Color;
	align?: "left" | "center" | "right";
	baseline?: "top" | "middle" | "bottom";
}

export interface SpriteDrawOptions {
	/** Source rectangle within the texture (for sprite sheets). */
	sourceRect?: Rect;
	/** Destination width. Default: source width. */
	width?: number;
	/** Destination height. Default: source height. */
	height?: number;
	/** Flip horizontally. */
	flipH?: boolean;
	/** Flip vertically. */
	flipV?: boolean;
}

/**
 * Abstract drawing interface. All coordinates are in local space —
 * the renderer applies the node's globalTransform before calling these.
 */
export interface DrawContext {
	// === Primitives ===
	line(from: Vec2, to: Vec2, style?: LineStyle): void;
	rect(pos: Vec2, size: Vec2, style?: ShapeStyle): void;
	circle(center: Vec2, radius: number, style?: ShapeStyle): void;
	polygon(points: Vec2[], style?: ShapeStyle): void;

	// === Text ===
	text(text: string, pos: Vec2, style?: TextStyle): void;
	measureText(text: string, style?: TextStyle): Vec2;

	// === Images ===
	image(name: string, pos: Vec2, options?: SpriteDrawOptions): void;

	// === State ===
	save(): void;
	restore(): void;
	setAlpha(alpha: number): void;
}
