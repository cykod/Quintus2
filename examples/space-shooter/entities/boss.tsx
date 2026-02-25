import { type Signal, signal } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import { Actor, CollisionShape, Shape } from "@quintus/physics";
import { Sprite } from "@quintus/sprites";
import {
    BOSS_FIRE_INTERVAL,
    BOSS_HP,
    BOSS_POINTS,
    BOSS_SPEED,
    GAME_WIDTH,
} from "../config.js";
import { BOSS_SCALE, FRAME, tilesetAtlas } from "../sprites.js";
import { enemyBulletPool } from "./enemy-bullet.js";
import { spawnFlash } from "./explosion.js";

const BOSS_HALF_WIDTH = 30;
const BOSS_RADIUS = 28;

export class Boss extends Actor {
    override collisionGroup = "enemies";
    override solid = true;
    override gravity = 0;
    override applyGravity = false;

    hp = BOSS_HP;
    points = BOSS_POINTS;

    readonly died: Signal<Boss> = signal<Boss>();

    private _fireTimer = 0;
    private _movingRight = true;

    override build() {
        return (
            <>
                <CollisionShape shape={Shape.circle(BOSS_RADIUS)} />
                <Sprite
                    texture="tileset"
                    sourceRect={tilesetAtlas.getFrameOrThrow(FRAME.BOSS)}
                    scale={[BOSS_SCALE, BOSS_SCALE]}
                />
            </>
        );
    }

    override onReady() {
        super.onReady();
        this.tag("enemy");
        this.tag("boss");
    }

    override onFixedUpdate(dt: number) {
        // Horizontal patrol
        if (this._movingRight) {
            this.velocity = new Vec2(BOSS_SPEED, 0);
            if (this.position.x >= GAME_WIDTH - BOSS_HALF_WIDTH) {
                this._movingRight = false;
            }
        } else {
            this.velocity = new Vec2(-BOSS_SPEED, 0);
            if (this.position.x <= BOSS_HALF_WIDTH) {
                this._movingRight = true;
            }
        }
        this.move(dt);

        // Fire spread patterns
        this._fireTimer += dt;
        if (this._fireTimer >= BOSS_FIRE_INTERVAL) {
            this._fireTimer -= BOSS_FIRE_INTERVAL;
            this._fireSpread();
        }
    }

    takeDamage(amount: number, hitPoint?: Vec2): void {
        this.hp -= amount;
        if (this.hp <= 0) {
            this.game.audio.play("boss_die", { bus: "sfx" });
            this.died.emit(this);
            this.destroy();
        } else {
            this.game.audio.play("enemy_hit", { bus: "sfx", volume: 0.5 });
            spawnFlash(this, hitPoint ?? this.position);
        }
    }

    private _fireSpread(): void {
        if (!this.isInsideTree) return;
        this.game.audio.play("enemy_shoot", { bus: "sfx" });
        // Fire 3 bullets in a spread pattern
        for (const angle of [-0.3, 0, 0.3]) {
            const bullet = enemyBulletPool.acquire();
            bullet.angle = angle;
            bullet.position._set(this.position.x, this.position.y + 30);
            this.scene!.add(bullet);
        }
    }

    serialize(): Record<string, unknown> {
        return { hp: this.hp, x: this.position.x, y: this.position.y };
    }
}
