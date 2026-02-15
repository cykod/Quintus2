import { Matrix2D, Vec2 } from "@quintus/math";
import type { DrawContext } from "./draw-context.js";
import { Node } from "./node.js";
import type { Node2DSnapshot } from "./snapshot-types.js";

export interface Node2DProps {
	position?: Vec2;
	rotation?: number;
	scale?: Vec2;
	zIndex?: number;
	visible?: boolean;
}

export class Node2D extends Node {
	// === Transform state ===
	private _position: Vec2;
	private _rotation = 0;
	private _scale: Vec2;
	private _localTransformDirty = true;
	private _globalTransformDirty = true;
	private _cachedLocalTransform = Matrix2D.IDENTITY;
	private _cachedGlobalTransform = Matrix2D.IDENTITY;

	// === Rendering ===
	zIndex = 0;
	visible = true;

	constructor() {
		super();
		this._position = new Vec2(0, 0);
		this._position._onChange = () => this._markTransformDirty();
		this._scale = new Vec2(1, 1);
		this._scale._onChange = () => this._markTransformDirty();
	}

	// === Local Transform ===
	get position(): Vec2 {
		return this._position;
	}

	set position(v: Vec2) {
		this._position._set(v.x, v.y);
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
		return this._scale;
	}

	set scale(v: Vec2) {
		this._scale._set(v.x, v.y);
	}

	// === Global Transform ===
	get globalPosition(): Vec2 {
		return this.globalTransform.getTranslation();
	}

	set globalPosition(v: Vec2) {
		const parent = this.parent;
		if (parent instanceof Node2D) {
			const local = parent.globalTransform.inverseTransformPoint(v);
			this._position._set(local.x, local.y);
		} else {
			this._position._set(v.x, v.y);
		}
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

	// === Serialization ===
	override serialize(): Node2DSnapshot {
		const gp = this.globalPosition;
		return {
			...super.serialize(),
			position: { x: this.position.x, y: this.position.y },
			rotation: this._rotation,
			scale: { x: this.scale.x, y: this.scale.y },
			globalPosition: { x: gp.x, y: gp.y },
			visible: this.visible,
			zIndex: this.zIndex,
		};
	}

	// === Custom Drawing ===
	onDraw(_ctx: DrawContext): void {}

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
}
