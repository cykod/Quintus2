import { type DrawContext, Node2D, type Signal, signal } from "@quintus/core";
import { Color, Vec2 } from "@quintus/math";
import {
	GAME_HEIGHT,
	GAME_WIDTH,
	GRAVITY,
	OFFSCREEN_MARGIN,
	PROJECTILE_RADIUS,
	SWEEP_STEP,
} from "../config.js";
import type { SolidQuery } from "../terrain/terrain.js";

// DrawContext shape styles take a Color, not a hex string — convert once at module scope.
const SHELL_COLOR = Color.fromHex("#2b2b2b");

export class Projectile extends Node2D {
	readonly detonated: Signal<Vec2> = signal<Vec2>();
	readonly missed: Signal<void> = signal<void>();
	velocity = new Vec2(0, 0);
	private wind = 0;
	private terrain!: SolidQuery;

	init(pos: Vec2, velocity: Vec2, wind: number, terrain: SolidQuery): this {
		this.position._set(pos.x, pos.y);
		this.velocity = velocity.clone();
		this.wind = wind;
		this.terrain = terrain;
		return this;
	}

	override onFixedUpdate(dt: number): void {
		this.velocity.y += GRAVITY * dt;
		this.velocity.x += this.wind * dt;
		const nx = this.position.x + this.velocity.x * dt;
		const ny = this.position.y + this.velocity.y * dt;
		const dx = nx - this.position.x;
		const dy = ny - this.position.y;
		// Sweep-sample the terrain in SWEEP_STEP-px increments so a fast shell can't
		// tunnel through thin terrain between two end-of-step positions. Start at i=1
		// so the muzzle position itself (guaranteed clear) is never re-sampled.
		const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / SWEEP_STEP));
		for (let i = 1; i <= steps; i++) {
			const t = i / steps;
			const px = this.position.x + dx * t;
			const py = this.position.y + dy * t;
			if (this.terrain.isSolid(px, py)) {
				this.detonated.emit(new Vec2(px, py));
				this.destroy();
				return;
			}
		}
		this.position._set(nx, ny);
		// Off-screen guard — a top exit is allowed (the shell arcs above and returns).
		if (
			nx < -OFFSCREEN_MARGIN ||
			nx > GAME_WIDTH + OFFSCREEN_MARGIN ||
			ny > GAME_HEIGHT + OFFSCREEN_MARGIN
		) {
			this.missed.emit();
			this.destroy();
		}
	}

	override onDraw(ctx: DrawContext): void {
		ctx.circle(new Vec2(0, 0), PROJECTILE_RADIUS, { fill: SHELL_COLOR });
	}
}
