import { type Signal, signal } from "@quintus/core";
import { Actor, CollisionShape, Shape } from "@quintus/physics";
import { Sprite } from "@quintus/sprites";
import { BASIC_ENEMY_HP, BASIC_ENEMY_POINTS, BASIC_ENEMY_SPEED, GAME_HEIGHT } from "../config.js";
import { BASIC_ENEMY_SCALE_X, BASIC_ENEMY_SCALE_Y, FRAME, tilesetAtlas } from "../sprites.js";

export class BasicEnemy extends Actor {
	override collisionGroup = "enemies";
	override solid = true;
	override gravity = 0;
	override applyGravity = false;

	hp = BASIC_ENEMY_HP;
	points = BASIC_ENEMY_POINTS;

	readonly died: Signal<BasicEnemy> = signal<BasicEnemy>();

	override build() {
		return (
			<>
				<CollisionShape shape={Shape.rect(16, 14)} />
				<Sprite
					texture="tileset"
					sourceRect={tilesetAtlas.getFrameOrThrow(FRAME.BASIC_ENEMY)}
					scale={[BASIC_ENEMY_SCALE_X, BASIC_ENEMY_SCALE_Y]}
				/>
			</>
		);
	}

	override onReady() {
		super.onReady();
		this.tag("enemy");
	}

	override onFixedUpdate(dt: number) {
		this.velocity._set(0, BASIC_ENEMY_SPEED);
		this.move(dt);

		// Wrap to top when off-screen bottom
		if (this.position.y > GAME_HEIGHT + 40) {
			this.position._set(this.position.x, -30);
			const world = this._getWorld();
			if (world) world.updatePosition(this);
		}
	}

	takeDamage(amount: number): void {
		this.hp -= amount;
		if (this.hp <= 0) {
			this.died.emit(this);
			this.destroy();
		}
	}

	serialize(): Record<string, unknown> {
		return { hp: this.hp, x: this.position.x, y: this.position.y };
	}
}
