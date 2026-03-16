import { Canvas2DDrawContext, type DrawContext, Node2D, Signal } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import {
	type ParticleConfig,
	type ResolvedParticleConfig,
	resolveConfig,
} from "./particle-config.js";
import { ParticleRenderer2D } from "./particle-renderer-2d.js";
import { ParticleSimulator } from "./particle-simulator.js";

/**
 * A Node2D that emits and renders particles.
 * Particles are NOT scene tree nodes — they're managed internally
 * in a flat SoA pool for performance.
 */
export class ParticleEmitter extends Node2D {
	/** Whether the emitter is actively emitting. Default: true */
	emitting = true;

	/** If true, destroy self when done emitting and all particles dead. Default: false */
	oneShot = false;

	/** Emitted when oneShot completes (all particles dead after emission stops) */
	readonly finished = new Signal<void>();

	private _config: ParticleConfig;
	private _resolved: ResolvedParticleConfig;
	private _simulator: ParticleSimulator;
	private _renderer2d = new ParticleRenderer2D();
	private _prevPosition = new Vec2(0, 0);
	private _initialized = false;

	constructor(config: ParticleConfig = {}) {
		super();
		this._config = config;
		this._resolved = resolveConfig(config);
		this._simulator = new ParticleSimulator(this._resolved.maxParticles);
	}

	/** Particle configuration. Can be changed at runtime. */
	get config(): ParticleConfig {
		return this._config;
	}

	set config(value: ParticleConfig) {
		this._config = value;
		this._resolved = resolveConfig(value);
		// Resize simulator if capacity changed
		if (this._simulator.pool.capacity !== this._resolved.maxParticles) {
			this._simulator = new ParticleSimulator(this._resolved.maxParticles);
		}
	}

	/** Read-only: number of currently alive particles */
	get aliveCount(): number {
		return this._simulator.pool.alive;
	}

	/** Read-only: true when all particles are dead and emitting is false */
	get isFinished(): boolean {
		return !this.emitting && this._simulator.pool.alive === 0;
	}

	/** Emit a burst of particles immediately */
	burst(count?: number): void {
		const n = count ?? Math.ceil(this._resolved.maxParticles * 0.25);
		this._simulator.burst(this._resolved, n, 0, 0, this.game.random);
	}

	/** Restart the emitter (kills existing particles, resets accumulator) */
	restart(): void {
		this._simulator.pool.reset();
		this._simulator.resetAccumulator();
		this.emitting = true;
		this._initialized = false;
	}

	override onFixedUpdate(dt: number): void {
		// Emit at local origin — the canvas transform handles global positioning.
		// For "world" space, we undo the emitter's movement in the render pass
		// by tracking position deltas and offsetting particles accordingly.
		const pos = this.globalPosition;

		if (!this._initialized) {
			this._prevPosition._set(pos.x, pos.y);
			this._initialized = true;
		}

		if (this.emitting) {
			this._simulator.emit(this._resolved, dt, 0, 0, this.game.random);
		}

		// For world-space simulation, offset particles by the inverse of
		// emitter movement so they stay fixed in world space while the
		// emitter (and its canvas transform) moves.
		const dx = pos.x - this._prevPosition.x;
		const dy = pos.y - this._prevPosition.y;
		const isWorld = this._resolved.simulationSpace === "world";
		const emitterDX = isWorld ? -dx : 0;
		const emitterDY = isWorld ? -dy : 0;
		this._simulator.update(this._resolved, dt, this.game.random, emitterDX, emitterDY);
		this._prevPosition._set(pos.x, pos.y);

		// oneShot auto-destroy
		if (this.oneShot && !this.emitting && this._simulator.pool.alive === 0) {
			this.finished.emit();
			this.destroy();
		}
	}

	override onDraw(ctx: DrawContext): void {
		if (ctx instanceof Canvas2DDrawContext) {
			this._renderer2d.render(
				this._simulator.pool,
				this._resolved,
				ctx.ctx,
				this.game?.assets ?? null,
			);
		}
	}
}
