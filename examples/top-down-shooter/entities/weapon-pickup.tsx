import { Pickup } from "@quintus/ai-prefabs";
import type { DrawContext } from "@quintus/core";
import { type Signal, signal } from "@quintus/core";
import { Color, Vec2 } from "@quintus/math";
import type { Actor } from "@quintus/physics";
import { CollisionShape, Shape } from "@quintus/physics";
import { WEAPONS } from "./weapons.js";

const PICKUP_RADIUS = 10;
const PICKUP_LIFETIME = 8;
const BLINK_START = 3;
const _center = new Vec2(0, 0);
const _labelPos = new Vec2(0, -PICKUP_RADIUS - 6);

const WEAPON_COLORS: Record<string, Color> = {
	pistol: Color.fromHex("#44ff44"),
	machine: Color.fromHex("#4488ff"),
	silencer: Color.fromHex("#ff44ff"),
};
const WHITE = Color.fromHex("#ffffff");

export class WeaponPickup extends Pickup {
	override collisionGroup = "pickups";
	override collectTag = "player";
	override bobAmount = 2;
	override bobSpeed = 1.2;
	override popScale = 1.5;
	override popDuration = 0.15;

	weaponId = "pistol";
	private _lifetime = PICKUP_LIFETIME;

	// Callback for pool recycling / cleanup
	_onCollected: ((pickup: WeaponPickup) => void) | null = null;

	readonly weaponCollected: Signal<string> = signal<string>();

	override build() {
		return <CollisionShape shape={Shape.circle(PICKUP_RADIUS)} />;
	}

	override onReady() {
		super.onReady();
		this._lifetime = PICKUP_LIFETIME;
	}

	override onCollect(_collector: Actor): void {
		this.weaponCollected.emit(this.weaponId);
		this._onCollected?.(this);
	}

	override onFixedUpdate(dt: number) {
		super.onFixedUpdate(dt);
		this._lifetime -= dt;
		if (this._lifetime <= 0 && this.isInsideTree) {
			this._onCollected?.(this);
		}
	}

	onDraw(ctx: DrawContext): void {
		// Blink when about to expire
		if (this._lifetime < BLINK_START && Math.sin(this._lifetime * 10) < 0) return;
		const color = WEAPON_COLORS[this.weaponId] ?? WHITE;
		ctx.circle(_center, PICKUP_RADIUS, { fill: color });
		ctx.setAlpha(0.5);
		ctx.circle(_center, PICKUP_RADIUS * 0.6, { fill: WHITE });
		ctx.setAlpha(1);

		// Draw weapon name label above the pickup
		const name = WEAPONS[this.weaponId]?.name ?? this.weaponId;
		ctx.text(name, _labelPos, {
			size: 10,
			color: WHITE,
			align: "center",
			baseline: "bottom",
		});
	}

	reset(): void {
		this.weaponId = "pistol";
		this._lifetime = PICKUP_LIFETIME;
		this._onCollected = null;
	}
}
