import { Vec2 } from "@quintus/math";
import { CollisionShape, Shape, StaticCollider } from "@quintus/physics";
import { Sprite } from "@quintus/sprites";
import { FRAME, tileAtlas } from "../sprites.js";

/**
 * Platform that oscillates between its start position and a calculated endpoint.
 * Uses `constantVelocity` for automatic player carry (Actor.move() applies it).
 */
export class MovingPlatform extends StaticCollider {
	override collisionGroup = "world";

	/** Movement axis. */
	direction: "horizontal" | "vertical" = "horizontal";

	/** Distance in pixels from start to endpoint. */
	distance = 128;

	/** Movement speed in pixels/sec. */
	speed = 60;

	/** Pause duration at each endpoint in seconds. */
	waitTime = 0.5;

	sprite!: Sprite;

	private _startPos = new Vec2(0, 0);
	private _progress = 0;
	private _forward = true;
	private _waiting = 0;

	override build() {
		return (
			<>
				<CollisionShape shape={Shape.rect(128, 14)} position={[0, -25]} />
				<Sprite ref="sprite" texture={tileAtlas.texture} centered />
			</>
		);
	}

	override onReady() {
		super.onReady();
		this._startPos = this.position.clone();
		this.sprite.sourceRect = tileAtlas.getFrameOrThrow(FRAME.CLOUD_MIDDLE);
		this.tag("moving_platform");
	}

	override onFixedUpdate(dt: number) {
		if (this._waiting > 0) {
			this._waiting -= dt;
			this.constantVelocity._set(0, 0);
			if (this._waiting > 0) return;
			// Fall through to resume movement
		}

		const moveDir = this._forward ? 1 : -1;
		const speedDt = (this.speed / this.distance) * dt;
		this._progress += speedDt * moveDir;

		if (this._progress >= 1) {
			this._progress = 1;
			this._forward = false;
			this._waiting = this.waitTime;
		} else if (this._progress <= 0) {
			this._progress = 0;
			this._forward = true;
			this._waiting = this.waitTime;
		}

		const offset = this._progress * this.distance;
		if (this.direction === "horizontal") {
			this.position.x = this._startPos.x + offset;
			this.constantVelocity._set(this._waiting > 0 ? 0 : this.speed * moveDir, 0);
		} else {
			this.position.y = this._startPos.y + offset;
			this.constantVelocity._set(0, this._waiting > 0 ? 0 : this.speed * moveDir);
		}

		this._getWorld()?.updatePosition(this);
	}
}
