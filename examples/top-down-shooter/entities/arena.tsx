import { type DrawContext, Node, Node2D } from "@quintus/core";
import { Color, Vec2 } from "@quintus/math";
import { CollisionShape, Shape, StaticCollider } from "@quintus/physics";
import { WALL_THICKNESS } from "../config.js";

const HALF_THICK = WALL_THICKNESS / 2;

const FLOOR_COLOR = Color.fromHex("#2a2a3e");
const GRID_COLOR = Color.fromHex("#666666");
const COVER_COLOR = Color.fromHex("#3a3a5e");
const _pos = new Vec2(0, 0);
const _size = new Vec2(0, 0);

class Floor extends Node2D {
	override zIndex = -10;

	onDraw(ctx: DrawContext): void {
		const w = this.game.width;
		const h = this.game.height;
		const aLeft = WALL_THICKNESS;
		const aTop = WALL_THICKNESS;
		const aRight = w - WALL_THICKNESS;
		const aBottom = h - WALL_THICKNESS;

		_pos.x = 0;
		_pos.y = 0;
		_size.x = w;
		_size.y = h;
		ctx.rect(_pos, _size, { fill: FLOOR_COLOR });

		ctx.setAlpha(0.1);
		for (let x = aLeft; x <= aRight; x += 32) {
			_pos.x = x;
			_pos.y = aTop;
			_size.x = 1;
			_size.y = aBottom - aTop;
			ctx.rect(_pos, _size, { fill: GRID_COLOR });
		}
		for (let y = aTop; y <= aBottom; y += 32) {
			_pos.x = aLeft;
			_pos.y = y;
			_size.x = aRight - aLeft;
			_size.y = 1;
			ctx.rect(_pos, _size, { fill: GRID_COLOR });
		}
		ctx.setAlpha(1);
	}
}

/** Visible cover wall — draws a filled rect matching its collision shape. */
class CoverWall extends StaticCollider {
	coverWidth = 60;
	coverHeight = 16;

	onDraw(ctx: DrawContext): void {
		_pos.x = -this.coverWidth / 2;
		_pos.y = -this.coverHeight / 2;
		_size.x = this.coverWidth;
		_size.y = this.coverHeight;
		ctx.rect(_pos, _size, { fill: COVER_COLOR });
	}
}

export class Arena extends Node {
	override build() {
		const w = this.game.width;
		const h = this.game.height;
		const halfW = w / 2;
		const halfH = h / 2;

		return (
			<>
				<Floor />

				{/* Top wall */}
				<StaticCollider collisionGroup="walls" position={[halfW, HALF_THICK]}>
					<CollisionShape shape={Shape.rect(w, WALL_THICKNESS)} />
				</StaticCollider>

				{/* Bottom wall */}
				<StaticCollider collisionGroup="walls" position={[halfW, h - HALF_THICK]}>
					<CollisionShape shape={Shape.rect(w, WALL_THICKNESS)} />
				</StaticCollider>

				{/* Left wall */}
				<StaticCollider collisionGroup="walls" position={[HALF_THICK, halfH]}>
					<CollisionShape shape={Shape.rect(WALL_THICKNESS, h)} />
				</StaticCollider>

				{/* Right wall */}
				<StaticCollider collisionGroup="walls" position={[w - HALF_THICK, halfH]}>
					<CollisionShape shape={Shape.rect(WALL_THICKNESS, h)} />
				</StaticCollider>

				{/* Interior cover walls — visible and offset from player spawn */}
				<CoverWall collisionGroup="walls" position={[200, 200]} coverWidth={60} coverHeight={16}>
					<CollisionShape shape={Shape.rect(60, 16)} />
				</CoverWall>
				<CoverWall collisionGroup="walls" position={[600, 200]} coverWidth={60} coverHeight={16}>
					<CollisionShape shape={Shape.rect(60, 16)} />
				</CoverWall>
				<CoverWall collisionGroup="walls" position={[400, 180]} coverWidth={16} coverHeight={60}>
					<CollisionShape shape={Shape.rect(16, 60)} />
				</CoverWall>
				<CoverWall collisionGroup="walls" position={[200, 430]} coverWidth={60} coverHeight={16}>
					<CollisionShape shape={Shape.rect(60, 16)} />
				</CoverWall>
				<CoverWall collisionGroup="walls" position={[600, 430]} coverWidth={60} coverHeight={16}>
					<CollisionShape shape={Shape.rect(60, 16)} />
				</CoverWall>
			</>
		);
	}
}
