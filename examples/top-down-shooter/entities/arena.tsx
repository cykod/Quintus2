import { type DrawContext, Node, Node2D } from "@quintus/core";
import { Color, Vec2 } from "@quintus/math";
import { CollisionShape, Shape, StaticCollider } from "@quintus/physics";
import {
	ARENA_BOTTOM,
	ARENA_LEFT,
	ARENA_RIGHT,
	ARENA_TOP,
	GAME_HEIGHT,
	GAME_WIDTH,
	WALL_THICKNESS,
} from "../config.js";

const HALF_W = GAME_WIDTH / 2;
const HALF_H = GAME_HEIGHT / 2;
const HALF_THICK = WALL_THICKNESS / 2;

const FLOOR_COLOR = Color.fromHex("#2a2a3e");
const GRID_COLOR = Color.fromHex("#666666");
const COVER_COLOR = Color.fromHex("#3a3a5e");
const _pos = new Vec2(0, 0);
const _size = new Vec2(0, 0);

class Floor extends Node2D {
	override zIndex = -10;

	onDraw(ctx: DrawContext): void {
		_pos.x = 0;
		_pos.y = 0;
		_size.x = GAME_WIDTH;
		_size.y = GAME_HEIGHT;
		ctx.rect(_pos, _size, { fill: FLOOR_COLOR });

		ctx.setAlpha(0.1);
		for (let x = ARENA_LEFT; x <= ARENA_RIGHT; x += 32) {
			_pos.x = x;
			_pos.y = ARENA_TOP;
			_size.x = 1;
			_size.y = ARENA_BOTTOM - ARENA_TOP;
			ctx.rect(_pos, _size, { fill: GRID_COLOR });
		}
		for (let y = ARENA_TOP; y <= ARENA_BOTTOM; y += 32) {
			_pos.x = ARENA_LEFT;
			_pos.y = y;
			_size.x = ARENA_RIGHT - ARENA_LEFT;
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
		return (
			<>
				<Floor />

				{/* Top wall */}
				<StaticCollider collisionGroup="walls" position={[HALF_W, HALF_THICK]}>
					<CollisionShape shape={Shape.rect(GAME_WIDTH, WALL_THICKNESS)} />
				</StaticCollider>

				{/* Bottom wall */}
				<StaticCollider collisionGroup="walls" position={[HALF_W, GAME_HEIGHT - HALF_THICK]}>
					<CollisionShape shape={Shape.rect(GAME_WIDTH, WALL_THICKNESS)} />
				</StaticCollider>

				{/* Left wall */}
				<StaticCollider collisionGroup="walls" position={[HALF_THICK, HALF_H]}>
					<CollisionShape shape={Shape.rect(WALL_THICKNESS, GAME_HEIGHT)} />
				</StaticCollider>

				{/* Right wall */}
				<StaticCollider collisionGroup="walls" position={[GAME_WIDTH - HALF_THICK, HALF_H]}>
					<CollisionShape shape={Shape.rect(WALL_THICKNESS, GAME_HEIGHT)} />
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
