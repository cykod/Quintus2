import { type DrawContext, type Poolable, type Signal, signal } from "@quintus/core";
import { Color, Vec2 } from "@quintus/math";
import { type CollisionObject, CollisionShape, Sensor, Shape } from "@quintus/physics";

const PICKUP_RADIUS = 10;
const _center = new Vec2(0, 0);

const WEAPON_COLORS: Record<string, Color> = {
	pistol: Color.fromHex("#44ff44"),
	machine: Color.fromHex("#4488ff"),
	silencer: Color.fromHex("#ff44ff"),
};
const WHITE = Color.fromHex("#ffffff");

export class WeaponPickup extends Sensor implements Poolable {
	override collisionGroup = "pickups";

	weaponId = "pistol";
	private _recycled = false;

	_onCollected: ((pickup: WeaponPickup) => void) | null = null;

	readonly collected: Signal<string> = signal<string>();

	override build() {
		return <CollisionShape shape={Shape.circle(PICKUP_RADIUS)} />;
	}

	override onReady() {
		super.onReady();
		this._recycled = false;
		this.bodyEntered.connect((other: CollisionObject) => {
			if (other.hasTag("player") && !this._recycled) {
				this._recycled = true;
				this.collected.emit(this.weaponId);
				this._onCollected?.(this);
			}
		});
	}

	onDraw(ctx: DrawContext): void {
		const color = WEAPON_COLORS[this.weaponId] ?? WHITE;
		ctx.circle(_center, PICKUP_RADIUS, { fill: color });
		ctx.setAlpha(0.5);
		ctx.circle(_center, PICKUP_RADIUS * 0.6, { fill: WHITE });
		ctx.setAlpha(1);
	}

	reset(): void {
		this.weaponId = "pistol";
		this._recycled = false;
		this._onCollected = null;
	}
}
