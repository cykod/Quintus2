import { Node2D, type Node2DProps } from "@quintus/core";
import type { AABB, Matrix2D } from "@quintus/math";
import type { Shape2D } from "./shapes.js";
import { shapeAABB } from "./shapes.js";
import type { CollisionShapeSnapshot } from "./snapshot-types.js";

export interface CollisionShapeProps extends Node2DProps {
	shape?: Shape2D;
	disabled?: boolean;
}

export class CollisionShape extends Node2D {
	/** The collision shape geometry. */
	private _shape: Shape2D | null = null;

	/** When true, this shape is ignored during collision detection. */
	disabled = false;

	get shape(): Shape2D | null {
		return this._shape;
	}

	set shape(value: Shape2D | null) {
		this._shape = value;
		this._notifyParent();
	}

	/**
	 * @internal Notify parent CollisionObject when this shape enters the tree
	 * with a pre-set shape (e.g. shape was set before add).
	 */
	override onReady(): void {
		super.onReady();
		if (this._shape) this._notifyParent();
	}

	/**
	 * Get the world-space transform for this shape.
	 * Uses Node2D's cached globalTransform — no new allocation.
	 */
	getWorldTransform(): Matrix2D {
		return this.globalTransform;
	}

	override serialize(): CollisionShapeSnapshot {
		return {
			...super.serialize(),
			shapeType: this._shape ? this._shape.type : null,
			shapeDesc: this._shape ? describeShape(this._shape) : "none",
			disabled: this.disabled,
		};
	}

	/** Compute the world-space AABB for this shape. */
	getWorldAABB(): AABB | null {
		if (!this._shape || this.disabled) return null;
		return shapeAABB(this._shape, this.globalTransform);
	}

	/**
	 * Notify parent CollisionObject to update its spatial hash entry.
	 * Uses duck-typing to avoid circular import with collision-object.
	 */
	private _notifyParent(): void {
		if (!this.isInsideTree) return;
		const parent = this.parent as unknown as { _onShapeChanged?: () => void } | null;
		if (parent && typeof parent._onShapeChanged === "function") {
			parent._onShapeChanged();
		}
	}
}

function describeShape(shape: Shape2D): string {
	switch (shape.type) {
		case "rect":
			return `rect ${shape.width}x${shape.height}`;
		case "circle":
			return `circle r=${shape.radius}`;
		case "capsule":
			return `capsule r=${shape.radius} h=${shape.height}`;
		case "polygon":
			return `polygon ${shape.points.length}pts`;
	}
}
