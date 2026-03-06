import { type Signal, signal } from "@quintus/core";
import { Actor, type CollisionObject, Sensor } from "@quintus/physics";

export class Pickup extends Sensor {
	override collisionGroup = "pickups";
	collectTag = "player";
	bobAmount = 4;
	bobSpeed = 0.8;
	popScale = 1.8;
	popDuration = 0.2;

	readonly collected: Signal<Actor> = signal<Actor>();

	private _collected = false;
	private _bobElapsed = 0;
	private _baseY = 0;

	protected onCollect(_collector: Actor): void {}

	override onReady() {
		super.onReady();
		this._baseY = this.position.y;

		this.bodyEntered.connect((body: CollisionObject) => {
			if (this._collected) return;
			if (!(body instanceof Actor)) return;
			if (!body.hasTag(this.collectTag)) return;

			this._collected = true;
			this.collected.emit(body);
			this.onCollect(body);
			this._playPopEffect();
		});
	}

	override onFixedUpdate(dt: number) {
		if (this._collected) return;
		if (this.bobAmount <= 0) return;

		this._bobElapsed += dt;
		this.position.y =
			this._baseY + Math.sin((2 * Math.PI * this._bobElapsed) / this.bobSpeed) * this.bobAmount;
	}

	private _playPopEffect(): void {
		try {
			// tween() is monkey-patched by @quintus/tween — optional at runtime
			const tweenFn = (this as unknown as Record<string, unknown>).tween;
			if (typeof tweenFn !== "function") {
				this.destroy();
				return;
			}
			(
				tweenFn.call(this) as {
					to(props: object, dur: number): { onComplete(fn: () => void): void };
				}
			)
				.to({ scale: { x: this.popScale, y: this.popScale } }, this.popDuration)
				.onComplete(() => this.destroy());
		} catch {
			this.destroy();
		}
	}

	override _poolReset(): void {
		super._poolReset();
		this._collected = false;
		this._bobElapsed = 0;
		this._baseY = 0;
		this.collected.disconnectAll();
	}
}
