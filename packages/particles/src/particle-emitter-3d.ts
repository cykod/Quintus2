import { Signal } from "@quintus/core";
import { Node3D } from "@quintus/three";
import * as THREE from "three";
import {
	type ParticleConfig3D,
	type ResolvedParticleConfig3D,
	resolveConfig3D,
} from "./particle-config-3d.js";
import { ParticleSimulator3D } from "./particle-simulator-3d.js";

// Minimal vertex shader: reads per-particle position, color (RGBA), and size
const VERTEX_SHADER = /* glsl */ `
attribute vec4 particleColor;
attribute float particleSize;
varying vec4 vColor;
void main() {
	vColor = particleColor;
	vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
	gl_PointSize = particleSize * (300.0 / -mvPosition.z);
	gl_Position = projectionMatrix * mvPosition;
}
`;

// Fragment shader: circular point with per-particle alpha
const FRAGMENT_SHADER = /* glsl */ `
varying vec4 vColor;
void main() {
	float dist = length(gl_PointCoord - vec2(0.5));
	if (dist > 0.5) discard;
	gl_FragColor = vColor;
}
`;

/**
 * 3D particle emitter node. Extends Node3D and renders particles
 * via THREE.Points with per-particle position, color (RGBA), and size.
 */
export class ParticleEmitter3D extends Node3D {
	/** Whether the emitter is actively emitting. Default: true */
	emitting = true;

	/** If true, destroy self when done emitting and all particles dead. Default: false */
	oneShot = false;

	/** Emitted when oneShot completes (all particles dead after emission stops) */
	readonly finished = new Signal<void>();

	private _config: ParticleConfig3D;
	private _resolved: ResolvedParticleConfig3D;
	private _simulator: ParticleSimulator3D;
	private _geometry: THREE.BufferGeometry | null = null;
	private _material: THREE.ShaderMaterial | null = null;
	private _positionAttr: THREE.BufferAttribute | null = null;
	private _colorAttr: THREE.BufferAttribute | null = null;
	private _sizeAttr: THREE.BufferAttribute | null = null;

	constructor(config: ParticleConfig3D = {}) {
		super();
		this._config = config;
		this._resolved = resolveConfig3D(config);
		this._simulator = new ParticleSimulator3D(this._resolved.maxParticles);
	}

	/** Particle configuration. Can be changed at runtime. */
	get config(): ParticleConfig3D {
		return this._config;
	}

	set config(value: ParticleConfig3D) {
		this._config = value;
		this._resolved = resolveConfig3D(value);
		if (this._simulator.pool.capacity !== this._resolved.maxParticles) {
			this._simulator = new ParticleSimulator3D(this._resolved.maxParticles);
			this._rebuildGeometry();
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

	/**
	 * Convenience: create a one-shot particle burst at a position.
	 * Creates the emitter, adds it to the parent, positions it, and fires a burst.
	 * The emitter auto-destroys when all particles expire (oneShot behavior).
	 *
	 * @param parent Node to add the emitter to
	 * @param config Particle configuration
	 * @param position World position for the burst
	 * @param count Number of particles to emit
	 * @returns The created emitter (for optional chaining)
	 */
	static burst(
		parent: Node3D,
		config: ParticleConfig3D,
		position: { x: number; y: number; z: number },
		count: number,
	): ParticleEmitter3D {
		const emitter = parent.add(ParticleEmitter3D, {
			config,
			oneShot: true,
			emitting: false,
		});
		emitter.position.set(position.x, position.y, position.z);
		emitter.burst(count);
		return emitter;
	}

	/** Restart the emitter (kills existing particles, resets accumulator) */
	restart(): void {
		this._simulator.pool.reset();
		this._simulator.resetAccumulator();
		this.emitting = true;
	}

	protected override _createObject3D(): THREE.Object3D {
		const cap = this._resolved.maxParticles;

		this._geometry = new THREE.BufferGeometry();
		this._positionAttr = new THREE.Float32BufferAttribute(new Float32Array(cap * 3), 3);
		this._colorAttr = new THREE.Float32BufferAttribute(new Float32Array(cap * 4), 4);
		this._sizeAttr = new THREE.Float32BufferAttribute(new Float32Array(cap), 1);

		this._geometry.setAttribute("position", this._positionAttr);
		this._geometry.setAttribute("particleColor", this._colorAttr);
		this._geometry.setAttribute("particleSize", this._sizeAttr);
		this._geometry.setDrawRange(0, 0);

		const isAdditive = this._resolved.blendMode === "additive";
		this._material = new THREE.ShaderMaterial({
			uniforms: {},
			vertexShader: VERTEX_SHADER,
			fragmentShader: FRAGMENT_SHADER,
			transparent: true,
			depthWrite: false,
			blending: isAdditive ? THREE.AdditiveBlending : THREE.NormalBlending,
		});

		return new THREE.Points(this._geometry, this._material);
	}

	override onFixedUpdate(dt: number): void {
		if (this.emitting) {
			this._simulator.emit(this._resolved, dt, 0, 0, this.game.random);
		}

		this._simulator.update(this._resolved, dt, this.game.random);

		// oneShot auto-destroy
		if (this.oneShot && !this.emitting && this._simulator.pool.alive === 0) {
			this.finished.emit();
			this.destroy();
		}
	}

	override onUpdate(): void {
		if (!this._positionAttr || !this._colorAttr || !this._sizeAttr || !this._geometry) return;

		this._simulator.syncBuffers(this._positionAttr, this._colorAttr, this._sizeAttr);
		this._geometry.setDrawRange(0, this._simulator.pool.alive);
	}

	override onDestroy(): void {
		this._geometry?.dispose();
		this._material?.dispose();
		this._geometry = null;
		this._material = null;
		this._positionAttr = null;
		this._colorAttr = null;
		this._sizeAttr = null;
	}

	private _rebuildGeometry(): void {
		if (!this._geometry) return;

		const cap = this._resolved.maxParticles;
		this._positionAttr = new THREE.Float32BufferAttribute(new Float32Array(cap * 3), 3);
		this._colorAttr = new THREE.Float32BufferAttribute(new Float32Array(cap * 4), 4);
		this._sizeAttr = new THREE.Float32BufferAttribute(new Float32Array(cap), 1);

		this._geometry.setAttribute("position", this._positionAttr);
		this._geometry.setAttribute("particleColor", this._colorAttr);
		this._geometry.setAttribute("particleSize", this._sizeAttr);
		this._geometry.setDrawRange(0, 0);
	}
}
