import { type Signal, signal } from "@quintus/core";
import type { Actor } from "@quintus/physics";

// biome-ignore lint/suspicious/noExplicitAny: TypeScript mixin pattern requires any[]
type Constructor<T = object> = new (...args: any[]) => T;

export interface DamageableConfig {
	maxHealth: number;
	invincibilityDuration: number;
	deathTween: boolean;
}

export interface DamageableInterface {
	health: number;
	maxHealth: number;
	readonly damaged: Signal<number>;
	readonly died: Signal<void>;
	takeDamage(amount: number): void;
	heal(amount: number): void;
	isDead(): boolean;
	isInvincible(): boolean;
}

const DEFAULTS: DamageableConfig = {
	maxHealth: 3,
	invincibilityDuration: 1.5,
	deathTween: true,
};

export function Damageable<T extends Constructor<Actor>>(
	Base: T,
	config?: Partial<DamageableConfig>,
): T & Constructor<DamageableInterface> {
	const cfg = { ...DEFAULTS, ...config };

	class DamageableMixin extends Base {
		health = cfg.maxHealth;
		maxHealth = cfg.maxHealth;

		readonly damaged: Signal<number> = signal<number>();
		readonly died: Signal<void> = signal<void>();

		private _invincibilityTimer = 0;
		private _dead = false;

		override onReady() {
			super.onReady();
			this.health = this.maxHealth;
		}

		override onFixedUpdate(dt: number) {
			super.onFixedUpdate(dt);
			if (this._invincibilityTimer > 0) {
				this._invincibilityTimer -= dt;
				if (this._invincibilityTimer < 0) this._invincibilityTimer = 0;
			}
		}

		takeDamage(amount: number): void {
			if (this._dead) return;
			if (this._invincibilityTimer > 0) return;
			this.health -= amount;
			if (this.health < 0) this.health = 0;
			this.damaged.emit(this.health);

			if (this.health <= 0) {
				this._dead = true;
				this.died.emit();
				this._playDeathEffect();
			} else if (cfg.invincibilityDuration > 0) {
				this._invincibilityTimer = cfg.invincibilityDuration;
			}
		}

		heal(amount: number): void {
			if (this._dead) return;
			this.health = Math.min(this.health + amount, this.maxHealth);
		}

		isDead(): boolean {
			return this._dead;
		}

		isInvincible(): boolean {
			return this._invincibilityTimer > 0;
		}

		private _playDeathEffect(): void {
			if (!cfg.deathTween) {
				this.destroy();
				return;
			}
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
					.to({ scale: { x: 0, y: 0 } }, 0.3)
					.onComplete(() => this.destroy());
			} catch {
				this.destroy();
			}
		}

		override _poolReset(): void {
			super._poolReset();
			this.health = this.maxHealth;
			this._invincibilityTimer = 0;
			this._dead = false;
			this.damaged.disconnectAll();
			this.died.disconnectAll();
		}
	}

	return DamageableMixin as unknown as T & Constructor<DamageableInterface>;
}
