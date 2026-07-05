import { type DrawContext, Node2D, type Signal, signal } from "@quintus/core";
import { Color, clamp, Vec2 } from "@quintus/math";
import {
	ANGLE_RATE,
	DEFAULT_ANGLE,
	MAX_ANGLE,
	MAX_POWER,
	MIN_ANGLE,
	MIN_POWER,
	MUZZLE_LENGTH,
	POWER_RATE,
} from "../config.js";
import { gameState } from "../state.js";

// DrawContext styles take a Color, not a hex string — convert once at module scope.
const BARREL_COLOR = Color.fromHex("#3a3a3a");
const BORE_COLOR = Color.fromHex("#151515");
const BASE_COLOR = Color.fromHex("#5a4632");
const WHEEL_COLOR = Color.fromHex("#2c2116");
const HUB_COLOR = Color.fromHex("#6b5236");

// Polar → cartesian in screen space (y-down, CCW from +x): note the −sin.
// Not `Vec2.fromAngle`, which returns (cos, +sin) — the opposite sign convention.
const polar = (angle: number, len: number): Vec2 =>
	new Vec2(Math.cos(angle) * len, -Math.sin(angle) * len);

export class Cannon extends Node2D {
	readonly fired: Signal<{ velocity: Vec2 }> = signal<{ velocity: Vec2 }>();
	angle = DEFAULT_ANGLE;
	/** Muzzle velocity, charged while `fire` is held. Idle = MIN_POWER (empty meter). */
	power = MIN_POWER;
	canFire = true;
	/** True while `fire` is held and power is ramping up toward the release shot. */
	private charging = false;

	override onFixedUpdate(dt: number): void {
		const input = this.game.input;

		// Aim: Left raises the barrel (toward up-left), Right lowers it toward the horizon.
		if (input.isPressed("aim_raise")) {
			this.angle = clamp(this.angle + ANGLE_RATE * dt, MIN_ANGLE, MAX_ANGLE);
		}
		if (input.isPressed("aim_lower")) {
			this.angle = clamp(this.angle - ANGLE_RATE * dt, MIN_ANGLE, MAX_ANGLE);
		}

		// Power: hold `fire` to charge the muzzle velocity from MIN_POWER toward MAX_POWER;
		// release to launch. A quick tap fires weakly; a long hold fires at full power.
		if (this.canFire) {
			if (input.isPressed("fire")) {
				if (!this.charging) {
					this.charging = true;
					this.power = MIN_POWER; // start each shot's charge from empty
				} else {
					this.power = clamp(this.power + POWER_RATE * dt, MIN_POWER, MAX_POWER);
				}
			} else if (this.charging) {
				this.charging = false;
				this.fired.emit({ velocity: polar(this.angle, this.power) });
				this.power = MIN_POWER; // empty the meter, ready for the next shot
			}
		}

		gameState.angle = this.angle;
		gameState.power = this.power;
	}

	/** World-space muzzle tip — where the shell spawns (clears terrain via elevation). */
	muzzlePosition(): Vec2 {
		return this.position.add(polar(this.angle, MUZZLE_LENGTH));
	}

	override onDraw(ctx: DrawContext): void {
		// Local space: pivot at origin. Barrel points at `angle`; carriage sits below.
		const pivot = new Vec2(0, 0);
		const muzzle = polar(this.angle, MUZZLE_LENGTH);

		// Carriage + wheel (drawn first, behind the barrel) — a stout, chunky base.
		ctx.rect(new Vec2(-15, 2), new Vec2(30, 15), { fill: BASE_COLOR });
		ctx.circle(new Vec2(0, 12), 11, { fill: WHEEL_COLOR });
		ctx.circle(new Vec2(0, 12), 4, { fill: HUB_COLOR });

		// Barrel: a thick tube with a rounded breech and a flared muzzle + dark bore,
		// so it reads as a fat cannon rather than a thin line.
		ctx.line(pivot, muzzle, { width: 14, color: BARREL_COLOR });
		ctx.circle(pivot, 9, { fill: BARREL_COLOR }); // breech (rounded back)
		ctx.circle(muzzle, 8, { fill: BARREL_COLOR }); // muzzle rim (flared front)
		ctx.circle(muzzle, 4.5, { fill: BORE_COLOR }); // bore opening
	}
}
