import { Bullet } from "@quintus/ai-prefabs";
import type { DrawContext } from "@quintus/core";
import { Color, Vec2 } from "@quintus/math";
import { CollisionShape, Shape } from "@quintus/physics";

const BULLET_RADIUS = 3;
const PLAYER_BULLET_COLOR = Color.fromHex("#ffdd44");
const ENEMY_BULLET_COLOR = Color.fromHex("#ff4444");
const _center = new Vec2(0, 0);

/**
 * Unified bullet class for both player and enemy projectiles.
 * `damageTag` distinguishes targets: player bullets hit "enemy", enemy bullets hit "player".
 * `drawColor` configures rendering per bullet type. Both are reset on pool reuse.
 */
export class ShooterBullet extends Bullet {
	drawColor: Color = PLAYER_BULLET_COLOR;
	damageTag = "enemy";

	// Prevents duplicate damage from handler stacking on pool reuse:
	// onReady() connects a new hit handler each time the bullet enters the tree,
	// but the previous connection may not be cleaned up. This flag ensures only
	// the first hit per lifecycle deals damage.
	private _hitHandled = false;

	override build() {
		return <CollisionShape shape={Shape.circle(BULLET_RADIUS)} />;
	}

	override onReady() {
		super.onReady();
		this.hit.connect((collider) => {
			if (this._hitHandled) return;
			this._hitHandled = true;
			if (collider.hasTag(this.damageTag)) {
				(collider as { takeDamage?: (n: number) => void }).takeDamage?.(this.damage);
			}
		});
	}

	onDraw(ctx: DrawContext): void {
		ctx.circle(_center, BULLET_RADIUS, { fill: this.drawColor });
	}

	override reset(): void {
		super.reset();
		this.drawColor = PLAYER_BULLET_COLOR;
		this.damageTag = "enemy";
		this._hitHandled = false;
	}
}

export { PLAYER_BULLET_COLOR, ENEMY_BULLET_COLOR };
