import type { DrawContext } from "@quintus/core";
import { Color, Vec2 } from "@quintus/math";
import { CollisionShape, Sensor, Shape } from "@quintus/physics";
import { TARGET_POINTS, TARGET_RADIUS } from "../config.js";

// DrawContext styles take a Color, not a hex string — convert once at module scope.
const CRATE_FILL = Color.fromHex("#a9702f");
const CRATE_EDGE = Color.fromHex("#5f3d15");
const CRATE_PLANK = Color.fromHex("#c88a45");

/**
 * A crate target that sits on the terrain surface. It registers a circular
 * sensor body in group "target" so the scene's blast query (`queryCircle`)
 * can find it at detonation time — the projectile never knows targets exist.
 */
export class Target extends Sensor {
	override collisionGroup = "target";
	points = TARGET_POINTS;

	override build() {
		return <CollisionShape shape={Shape.circle(TARGET_RADIUS)} />;
	}

	override onReady(): void {
		super.onReady();
		this.tag("target");
	}

	override onDraw(ctx: DrawContext): void {
		// Local space: crate centered on the pivot (which the scene seats on the surface).
		const r = TARGET_RADIUS;
		ctx.rect(new Vec2(-r, -r), new Vec2(r * 2, r * 2), {
			fill: CRATE_FILL,
			stroke: CRATE_EDGE,
			strokeWidth: 2,
		});
		// Diagonal planks for a crate look (visual only).
		ctx.line(new Vec2(-r, -r), new Vec2(r, r), { width: 2, color: CRATE_PLANK });
		ctx.line(new Vec2(-r, r), new Vec2(r, -r), { width: 2, color: CRATE_PLANK });
	}
}
