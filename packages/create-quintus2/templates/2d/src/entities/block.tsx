import { CollisionShape, Color, type DrawContext, Shape, StaticCollider, Vec2 } from "quintus2";

/**
 * A visible, solid rectangle: floor, wall, or platform. Immovable `StaticCollider`
 * (group "world") plus an `onDraw` that fills its rect so it actually shows up —
 * the built-in `StaticCollider` has no visual of its own.
 *
 * Pass `w`/`h`/`color` as JSX props (hex strings coerce to `Color`). The optional
 * `topColor` paints a thin highlight along the top edge for a bit of depth.
 */
export class Block extends StaticCollider {
	override collisionGroup = "world";

	w = 32;
	h = 32;
	color: Color = Color.fromHex("#3a2e4d");
	topColor: Color | null = null;

	override build() {
		return <CollisionShape shape={Shape.rect(this.w, this.h)} />;
	}

	override onDraw(ctx: DrawContext) {
		// onDraw runs with the origin at the node's center, so offset by -half.
		const topLeft = new Vec2(-this.w / 2, -this.h / 2);
		ctx.rect(topLeft, new Vec2(this.w, this.h), { fill: this.color });
		if (this.topColor) {
			ctx.rect(topLeft, new Vec2(this.w, Math.min(3, this.h)), { fill: this.topColor });
		}
	}
}
