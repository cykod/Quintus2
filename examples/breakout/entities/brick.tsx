import { CollisionShape, Shape, StaticCollider } from "@quintus/physics";
import type { TextureAtlas } from "@quintus/sprites";
import { Sprite } from "@quintus/sprites";
import { BRICK_HEIGHT, BRICK_WIDTH } from "../config.js";
import {
	BRICK_SCALE_X,
	BRICK_SCALE_Y,
	FRAME,
	tilesBlueAtlas,
	tilesGreenAtlas,
	tilesGreyAtlas,
	tilesRedAtlas,
	tilesYellowAtlas,
} from "../sprites.js";

export type BrickType = "normal" | "hard" | "metal";

export interface BrickColor {
	atlas: TextureAtlas | null;
	texture: string;
	frame: string;
}

const BRICK_COLORS = {
	blue: { atlas: null as TextureAtlas | null, texture: "tiles_blue", frame: FRAME.BRICK_BLUE },
	green: {
		atlas: null as TextureAtlas | null,
		texture: "tiles_green",
		frame: FRAME.BRICK_GREEN,
	},
	yellow: {
		atlas: null as TextureAtlas | null,
		texture: "tiles_yellow",
		frame: FRAME.BRICK_YELLOW,
	},
	red: { atlas: null as TextureAtlas | null, texture: "tiles_red", frame: FRAME.BRICK_RED },
	grey: { atlas: null as TextureAtlas | null, texture: "tiles_grey", frame: FRAME.BRICK_GREY },
} satisfies Record<string, BrickColor>;

/** Lazily resolve atlas references (module-level lets aren't available at import time). */
function resolveAtlases(): void {
	BRICK_COLORS.blue.atlas = tilesBlueAtlas;
	BRICK_COLORS.green.atlas = tilesGreenAtlas;
	BRICK_COLORS.yellow.atlas = tilesYellowAtlas;
	BRICK_COLORS.red.atlas = tilesRedAtlas;
	BRICK_COLORS.grey.atlas = tilesGreyAtlas;
}

const BRICK_DEFS: Record<BrickType, { health: number; points: number }> = {
	normal: { health: 1, points: 10 },
	hard: { health: 2, points: 20 },
	metal: { health: 3, points: 30 },
};

export class Brick extends StaticCollider {
	override collisionGroup = "bricks";

	brickType: BrickType = "normal";
	colorName = "blue";

	health = 1;
	points = 10;

	sprite!: Sprite;

	override build() {
		resolveAtlases();
		const color = (BRICK_COLORS as Record<string, BrickColor>)[this.colorName];
		return (
			<>
				<CollisionShape shape={Shape.rect(BRICK_WIDTH, BRICK_HEIGHT)} />
				<Sprite
					ref="sprite"
					texture={color?.texture ?? "tiles_blue"}
					sourceRect={color?.atlas?.getFrameOrThrow(color.frame)}
					scale={[BRICK_SCALE_X, BRICK_SCALE_Y]}
				/>
			</>
		);
	}

	override onReady() {
		super.onReady();
		const def = BRICK_DEFS[this.brickType];
		this.health = def.health;
		this.points = def.points;
	}

	/** Apply damage. Returns true if the brick was destroyed. */
	hit(damage: number): boolean {
		this.health -= damage;
		if (this.health <= 0) {
			this.destroy();
			return true;
		}
		// Visual feedback for damaged bricks: flash alpha briefly
		this.sprite.alpha = 0.6;
		this.after(0.1, () => {
			if (!this.isDestroyed) this.sprite.alpha = 1;
		});
		return false;
	}
}

/** Helper: create a Brick with the given type and color at a position. */
export function makeBrick(
	type: BrickType,
	colorName: string,
	x: number,
	y: number,
): { brickType: BrickType; colorName: string; position: [number, number] } {
	return { brickType: type, colorName, position: [x, y] };
}
