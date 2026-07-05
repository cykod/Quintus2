import { Camera } from "@quintus/camera";
import { Scene } from "@quintus/core";
import type { SeededRandom, Vec2 } from "@quintus/math";
import {
	AMMO_BONUS,
	BLAST_RADIUS,
	CANNON_ELEVATION,
	CANNON_X,
	DIRECT_HIT_MULTIPLIER,
	DIRECT_HIT_RADIUS,
	GAME_HEIGHT,
	GAME_WIDTH,
	MAX_PLACEMENT_ATTEMPTS,
	MAX_WIND,
	SHAKE_DURATION,
	SHAKE_INTENSITY,
	TARGET_COUNT,
	TARGET_MAX_X,
	TARGET_MIN_SPACING,
	TARGET_MIN_X,
	TARGET_RADIUS,
} from "../config.js";
import { Cannon } from "../entities/cannon.js";
import { Explosion } from "../entities/explosion.js";
import { Projectile } from "../entities/projectile.js";
import { Target } from "../entities/target.js";
import { HUD } from "../hud/hud.js";
import { gameState } from "../state.js";
import { Terrain } from "../terrain/terrain.js";

/**
 * The playable round: destructible terrain, an aimable cannon, crate targets,
 * and blast-radius scoring. Blast damage is resolved purely by a `queryCircle`
 * at the detonation point — the projectile never knows targets exist.
 */
export class GameScene extends Scene {
	camera!: Camera; // string ref from build()
	terrain!: Terrain;
	cannon!: Cannon;
	/** Forked gameplay RNG — isolated from `game.random`, which Camera.shake consumes. */
	protected rng!: SeededRandom;

	override build() {
		// The camera MUST sit at screen center so its view transform is identity —
		// a default Camera at (0,0) shifts world origin to screen center and desyncs
		// the terrain from its authoritative mask (packages/camera/src/camera.ts).
		return (
			<>
				<Camera ref="camera" position={[GAME_WIDTH / 2, GAME_HEIGHT / 2]} />
				<HUD />
			</>
		);
	}

	override onReady(): void {
		// Fork a dedicated gameplay stream so terrain/target/wind draws stay
		// independent of Camera.shake, which draws from game.random each frame.
		this.rng = this.game.random.fork("artillery");

		this.terrain = new Terrain(GAME_WIDTH, GAME_HEIGHT);
		this.add(this.terrain);
		this.terrain.generate(this.rng);

		this.cannon = this.add(Cannon);
		this.cannon.position._set(CANNON_X, this.terrain.surfaceY(CANNON_X) - CANNON_ELEVATION);
		this.cannon.fired.connect(({ velocity }) => this.onFire(velocity));

		this.placeTargets(this.terrain, this.rng);

		// First-shot wind.
		gameState.wind = this.rng.int(-MAX_WIND, MAX_WIND);
	}

	/**
	 * Bounded rejection sampling: for each target, try up to
	 * MAX_PLACEMENT_ATTEMPTS random columns, accepting the first that clears
	 * TARGET_MIN_SPACING from every placed target. On exhaustion, fall back to
	 * the evenly-spaced band column that maximizes distance from the already-
	 * placed targets — deterministic, in-range, and spacing-respecting whenever
	 * the band can accommodate it (best-effort only if the window is over-packed).
	 * Bounded draws + RNG-free fallback → deterministic per seed.
	 */
	protected placeTargets(terrain: Terrain, rng: SeededRandom): void {
		const placedX: number[] = [];
		for (let i = 0; i < TARGET_COUNT; i++) {
			let x = -1;
			for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; attempt++) {
				const candidate = rng.int(TARGET_MIN_X, TARGET_MAX_X);
				if (placedX.every((px) => Math.abs(px - candidate) >= TARGET_MIN_SPACING)) {
					x = candidate;
					break;
				}
			}
			if (x < 0) {
				x = this.fallbackColumn(placedX);
			}
			placedX.push(x);
			const target = this.add(Target);
			target.position._set(x, terrain.surfaceY(x) - TARGET_RADIUS);
		}
	}

	/**
	 * Deterministic, RNG-free placement fallback: scan TARGET_COUNT evenly-spaced
	 * candidate columns across the band and return the one that maximizes the
	 * minimum distance to every already-placed target (lowest-index tie-break).
	 * Maximizing separation clears TARGET_MIN_SPACING whenever the band has room;
	 * in an over-packed window it degrades gracefully to the most-separated slot.
	 */
	protected fallbackColumn(placedX: readonly number[]): number {
		const span = TARGET_MAX_X - TARGET_MIN_X;
		let best = TARGET_MIN_X;
		let bestGap = -1;
		for (let s = 0; s < TARGET_COUNT; s++) {
			const candidate = Math.floor(TARGET_MIN_X + ((s + 0.5) * span) / TARGET_COUNT);
			const gap = placedX.length
				? Math.min(...placedX.map((px) => Math.abs(px - candidate)))
				: Number.POSITIVE_INFINITY;
			if (gap > bestGap) {
				bestGap = gap;
				best = candidate;
			}
		}
		return best;
	}

	onFire(velocity: Vec2): void {
		gameState.ammo -= 1;
		this.cannon.canFire = false;
		this.game.audio.play("fire");
		const shell = this.add(Projectile).init(
			this.cannon.muzzlePosition(),
			velocity,
			gameState.wind,
			this.terrain,
		);
		shell.detonated.connect((point) => this.onDetonate(point));
		shell.missed.connect(() => this.onMissed());
	}

	onDetonate(point: Vec2): void {
		this.terrain.carveCircle(point.x, point.y, BLAST_RADIUS);
		this.add(Explosion).init(point);
		this.camera.shake(SHAKE_INTENSITY, SHAKE_DURATION);
		this.game.audio.play("explosion");

		// Self-destruct: a shell that detonates within its own blast radius of the
		// cannon blows the player up — immediate game over, regardless of any targets
		// the same blast might have caught.
		if (point.distanceTo(this.cannon.position) <= BLAST_RADIUS) {
			this.cannon.canFire = false;
			gameState.won = false;
			gameState.selfDestruct = true;
			this.switchTo("results");
			return;
		}

		// queryCircle catches a target when its body (radius TARGET_RADIUS) overlaps
		// the blast circle, so the effective splash reach is BLAST_RADIUS +
		// TARGET_RADIUS (= 56px from center), wider than the 44px terrain carve.
		const hits = this.game.physics.queryCircle(point, BLAST_RADIUS, {
			groups: ["target"],
			includeSensors: true,
		});
		for (const body of hits) {
			const t = body as Target;
			const direct = point.distanceTo(t.position) <= DIRECT_HIT_RADIUS;
			gameState.score += direct ? t.points * DIRECT_HIT_MULTIPLIER : t.points;
			t.destroy();
			gameState.targetsRemaining -= 1;
		}
		this.afterShot();
	}

	onMissed(): void {
		this.afterShot();
	}

	afterShot(): void {
		if (gameState.targetsRemaining <= 0) {
			gameState.score += gameState.ammo * AMMO_BONUS; // reward leftover shells
			gameState.won = true;
			this.switchTo("results"); // outcome passed via gameState; switchTo takes no params
		} else if (gameState.ammo <= 0) {
			gameState.won = false;
			this.switchTo("results");
		} else {
			gameState.wind = this.rng.int(-MAX_WIND, MAX_WIND);
			this.cannon.canFire = true;
		}
	}
}
