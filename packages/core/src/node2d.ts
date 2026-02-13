import { Color, Matrix2D, Vec2 } from "@quintus/math";
import type { DrawContext } from "./draw-context.js";
import type { NodeProps } from "./node.js";
import { applyNodeProps, Node } from "./node.js";

export interface Node2DProps extends NodeProps {
	position?: Vec2;
	rotation?: number;
	scale?: Vec2;
	zIndex?: number;
	visible?: boolean;
	tint?: Color;
	selfTint?: Color;
}

export class Node2D extends Node {
	// === Transform state ===
	private _position = new Vec2(0, 0);
	private _positionProxy: Vec2;
	private _rotation = 0;
	private _scale = new Vec2(1, 1);
	private _scaleProxy: Vec2;
	private _localTransformDirty = true;
	private _globalTransformDirty = true;
	private _cachedLocalTransform = Matrix2D.IDENTITY;
	private _cachedGlobalTransform = Matrix2D.IDENTITY;

	// === Tint state ===
	private _tint = Color.WHITE;
	private _selfTint = Color.WHITE;
	private _tintDirty = true;
	private _cachedEffectiveTint = Color.WHITE;

	// === Rendering ===
	zIndex = 0;
	visible = true;
	protected hasVisualContent = false;

	constructor() {
		super();
		this._positionProxy = createVec2Proxy(this._position, () => this._markTransformDirty());
		this._scaleProxy = createVec2Proxy(this._scale, () => this._markTransformDirty());
	}

	// === Local Transform ===
	get position(): Vec2 {
		return this._positionProxy;
	}

	set position(v: Vec2) {
		this._position.x = v.x;
		this._position.y = v.y;
		this._markTransformDirty();
	}

	get rotation(): number {
		return this._rotation;
	}

	set rotation(r: number) {
		if (this._rotation === r) return;
		this._rotation = r;
		this._markTransformDirty();
	}

	get scale(): Vec2 {
		return this._scaleProxy;
	}

	set scale(v: Vec2) {
		this._scale.x = v.x;
		this._scale.y = v.y;
		this._markTransformDirty();
	}

	// === Global Transform ===
	get globalPosition(): Vec2 {
		return this.globalTransform.getTranslation();
	}

	set globalPosition(v: Vec2) {
		const parent = this.parent;
		if (parent instanceof Node2D) {
			const local = parent.globalTransform.inverseTransformPoint(v);
			this._position.x = local.x;
			this._position.y = local.y;
		} else {
			this._position.x = v.x;
			this._position.y = v.y;
		}
		this._markTransformDirty();
	}

	get globalRotation(): number {
		return this.globalTransform.getRotation();
	}

	get globalScale(): Vec2 {
		return this.globalTransform.getScale();
	}

	get globalTransform(): Matrix2D {
		if (this._globalTransformDirty) {
			const parent = this.parent;
			const parentTransform = parent instanceof Node2D ? parent.globalTransform : Matrix2D.IDENTITY;
			this._cachedGlobalTransform = parentTransform.multiply(this.localTransform);
			this._globalTransformDirty = false;
		}
		return this._cachedGlobalTransform;
	}

	get localTransform(): Matrix2D {
		if (this._localTransformDirty) {
			this._cachedLocalTransform = Matrix2D.compose(this._position, this._rotation, this._scale);
			this._localTransformDirty = false;
		}
		return this._cachedLocalTransform;
	}

	// === Tint ===
	get tint(): Color {
		return this._tint;
	}

	set tint(c: Color) {
		if (this._tint === c) return;
		this._tint = c;
		this._tintDirty = true;
		// Always propagate to children regardless of own dirty state
		for (const child of this.children) {
			if (child instanceof Node2D) {
				child._markTintDirty();
			}
		}
	}

	get selfTint(): Color {
		return this._selfTint;
	}

	set selfTint(c: Color) {
		if (this._selfTint === c) return;
		this._selfTint = c;
		this._tintDirty = true;
	}

	/**
	 * The inherited tint (all ancestor tints * self tint), WITHOUT selfTint.
	 * Used by children to inherit tint without picking up our selfTint.
	 */
	get _inheritedTint(): Color {
		const parent = this.parent;
		const parentTint = parent instanceof Node2D ? parent._inheritedTint : Color.WHITE;
		return parentTint.multiply(this._tint);
	}

	get effectiveTint(): Color {
		if (this._tintDirty) {
			this._cachedEffectiveTint = this._inheritedTint.multiply(this._selfTint);
			this._tintDirty = false;
		}
		return this._cachedEffectiveTint;
	}

	// === Custom Drawing ===
	override onDraw(_ctx: DrawContext): void {}

	// === Convenience ===
	lookAt(target: Vec2): void {
		const dir = target.sub(this.globalPosition);
		this.rotation = dir.angle();
	}

	moveToward(target: Vec2, speed: number, dt: number): void {
		this.position = this.position.moveToward(target, speed * dt);
	}

	toLocal(worldPoint: Vec2): Vec2 {
		return this.globalTransform.inverseTransformPoint(worldPoint);
	}

	toGlobal(localPoint: Vec2): Vec2 {
		return this.globalTransform.transformPoint(localPoint);
	}

	// === Internal ===
	/** @internal */
	get _hasVisualContent(): boolean {
		return this.hasVisualContent;
	}

	private _markTransformDirty(): void {
		this._localTransformDirty = true;
		this._globalTransformDirty = true;
		for (const child of this.children) {
			if (child instanceof Node2D) {
				child._markGlobalTransformDirty();
			}
		}
	}

	/** @internal */
	_markGlobalTransformDirty(): void {
		if (this._globalTransformDirty) return;
		this._globalTransformDirty = true;
		for (const child of this.children) {
			if (child instanceof Node2D) {
				child._markGlobalTransformDirty();
			}
		}
	}

	private _markTintDirty(): void {
		if (this._tintDirty) return;
		this._tintDirty = true;
		for (const child of this.children) {
			if (child instanceof Node2D) {
				child._markTintDirty();
			}
		}
	}
}

function createVec2Proxy(target: Vec2, onDirty: () => void): Vec2 {
	return new Proxy(target, {
		set(obj, prop, value) {
			if (prop === "x" || prop === "y") {
				const old = obj[prop];
				obj[prop] = value;
				if (old !== value) onDirty();
				return true;
			}
			return Reflect.set(obj, prop, value);
		},
	});
}

/** @internal Apply typed props to a Node2D. */
export function applyNode2DProps(node: Node, props: Node2DProps): void {
	applyNodeProps(node, props);
	if (node instanceof Node2D) {
		if (props.position !== undefined) node.position = props.position;
		if (props.rotation !== undefined) node.rotation = props.rotation;
		if (props.scale !== undefined) node.scale = props.scale;
		if (props.zIndex !== undefined) node.zIndex = props.zIndex;
		if (props.visible !== undefined) node.visible = props.visible;
		if (props.tint !== undefined) node.tint = props.tint;
		if (props.selfTint !== undefined) node.selfTint = props.selfTint;
	}
}
