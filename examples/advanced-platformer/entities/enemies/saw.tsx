import { Node2D } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import { CollisionShape, Sensor, Shape } from "@quintus/physics";
import { AnimatedSprite } from "@quintus/sprites";
import { sawSheet } from "../../sprites.js";

/** Inner sensor that detects player overlap for damage. */
class SawSensor extends Sensor {
	override collisionGroup = "hazards";

	override onReady() {
		super.onReady();
		this.tag("enemy");
		this.tag("saw_blade");
	}
}

/**
 * Path-following spinning saw hazard.
 * Unstompable — always damages player on contact.
 * Uses Node2D (not Actor) since it doesn't need physics response.
 */
export class Saw extends Node2D {
	speed = 100;
	pathEnd = new Vec2(0, 0);

	private _pathStart = new Vec2(0, 0);
	private _progress = 0;
	private _forward = true;

	override build() {
		return (
			<>
				<SawSensor>
					<CollisionShape shape={Shape.circle(24)} />
				</SawSensor>
				<AnimatedSprite spriteSheet={sawSheet} animation="spin" centered />
			</>
		);
	}

	override onReady() {
		super.onReady();
		this._pathStart = this.position.clone();
		this.tag("saw");
	}

	override onFixedUpdate(dt: number) {
		const totalDist = this._pathStart.distanceTo(this.pathEnd);
		if (totalDist < 1) return;

		const step = (this.speed * dt) / totalDist;

		if (this._forward) {
			this._progress += step;
			if (this._progress >= 1) {
				this._progress = 1;
				this._forward = false;
			}
		} else {
			this._progress -= step;
			if (this._progress <= 0) {
				this._progress = 0;
				this._forward = true;
			}
		}

		this.position = this._pathStart.lerp(this.pathEnd, this._progress);
	}
}
