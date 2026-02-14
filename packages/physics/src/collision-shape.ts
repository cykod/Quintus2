import { Node2D, type Node2DProps } from "@quintus/core";
import type { AABB, Matrix2D } from "@quintus/math";
import type { Shape2D } from "./shapes.js";
import { shapeAABB } from "./shapes.js";

export interface CollisionShapeProps extends Node2DProps {
	shape?: Shape2D;
	disabled?: boolean;
}

export class CollisionShape extends Node2D {
	/** The collision shape geometry. Must be set before the body enters the tree. */
	shape: Shape2D | null = null;

	/** When true, this shape is ignored during collision detection. */
	disabled = false;

	/**
	 * Get the world-space transform for this shape.
	 * Uses Node2D's cached globalTransform — no new allocation.
	 */
	getWorldTransform(): Matrix2D {
		return this.globalTransform;
	}

	/** Compute the world-space AABB for this shape. */
	getWorldAABB(): AABB | null {
		if (!this.shape || this.disabled) return null;
		return shapeAABB(this.shape, this.globalTransform);
	}
}
