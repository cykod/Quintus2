import { Vec2 } from "@quintus/math";
import { describe, expect, it } from "vitest";
import { GAME_WIDTH, SWEEP_STEP } from "../config.js";
import { Projectile } from "../entities/projectile.js";
import type { SolidQuery } from "../terrain/terrain.js";

const DT = 1 / 60;

// Stub terrain: solid at/below y = 300, empty above. Isolates ballistics from Phase 1.
const solidBelow300 = (): SolidQuery => ({ isSolid: (_x: number, y: number) => y >= 300 });
// Stub terrain that is never solid — the shell must fly off-screen.
const alwaysEmpty = (): SolidQuery => ({ isSolid: () => false });

function makeProjectile(
	velocity: Vec2,
	wind: number,
	terrain: SolidQuery,
	pos = new Vec2(100, 100),
) {
	const p = new Projectile();
	p.init(pos, velocity, wind, terrain);
	return p;
}

describe("Projectile", () => {
	it("accelerates downward under gravity (monotonic vy and y)", () => {
		const p = makeProjectile(new Vec2(200, 0), 0, alwaysEmpty());
		let lastVy = p.velocity.y;
		let lastY = p.position.y;
		for (let i = 0; i < 20; i++) {
			p.onFixedUpdate(DT);
			expect(p.velocity.y).toBeGreaterThan(lastVy);
			expect(p.position.y).toBeGreaterThan(lastY);
			lastVy = p.velocity.y;
			lastY = p.position.y;
		}
	});

	it("accelerates horizontally with positive wind", () => {
		const p = makeProjectile(new Vec2(0, -400), 100, alwaysEmpty());
		let lastVx = p.velocity.x;
		for (let i = 0; i < 20; i++) {
			p.onFixedUpdate(DT);
			expect(p.velocity.x).toBeGreaterThan(lastVx);
			lastVx = p.velocity.x;
		}
	});

	it("decelerates horizontally with negative wind", () => {
		const p = makeProjectile(new Vec2(0, -400), -100, alwaysEmpty());
		let lastVx = p.velocity.x;
		for (let i = 0; i < 20; i++) {
			p.onFixedUpdate(DT);
			expect(p.velocity.x).toBeLessThan(lastVx);
			lastVx = p.velocity.x;
		}
	});

	it("detonates once on terrain and self-destructs", () => {
		const p = makeProjectile(new Vec2(0, 400), 0, solidBelow300(), new Vec2(100, 100));
		const points: Vec2[] = [];
		p.detonated.connect((point) => points.push(point));

		for (let i = 0; i < 200 && !p.isDestroyed; i++) {
			p.onFixedUpdate(DT);
		}

		expect(points).toHaveLength(1);
		expect(points[0]!.y).toBeGreaterThanOrEqual(300);
		expect(points[0]!.y).toBeLessThanOrEqual(300 + SWEEP_STEP);
		expect(p.isDestroyed).toBe(true);
	});

	it("does not tunnel through thin terrain at high speed", () => {
		// 3000 px/s at dt=1/60 ⇒ 50 px per step, far larger than SWEEP_STEP (3).
		// Sweep sampling must still catch the y=300 boundary rather than skipping past it.
		const p = makeProjectile(new Vec2(0, 3000), 0, solidBelow300(), new Vec2(100, 100));
		const points: Vec2[] = [];
		p.detonated.connect((point) => points.push(point));

		for (let i = 0; i < 50 && !p.isDestroyed; i++) {
			p.onFixedUpdate(DT);
		}

		expect(points).toHaveLength(1);
		expect(points[0]!.y).toBeGreaterThanOrEqual(300);
		expect(points[0]!.y).toBeLessThanOrEqual(300 + SWEEP_STEP);
		expect(p.isDestroyed).toBe(true);
	});

	it("emits missed once and destroys when it flies off the right edge", () => {
		const p = makeProjectile(new Vec2(3000, 0), 0, alwaysEmpty(), new Vec2(400, 100));
		let missedCount = 0;
		p.missed.connect(() => missedCount++);

		for (let i = 0; i < 100 && !p.isDestroyed; i++) {
			p.onFixedUpdate(DT);
		}

		expect(missedCount).toBe(1);
		expect(p.position.x).toBeGreaterThan(GAME_WIDTH + 50);
		expect(p.isDestroyed).toBe(true);
	});

	it("is deterministic across repeated runs with identical inputs", () => {
		// Two shells with byte-identical init inputs, stepped the same way against the
		// same stub terrain, must produce identical arcs and identical detonation points.
		const run = () => {
			const p = makeProjectile(new Vec2(200, -260), 40, solidBelow300(), new Vec2(100, 100));
			const path: Array<[number, number]> = [];
			const hits: Vec2[] = [];
			p.detonated.connect((point) => hits.push(point));
			for (let i = 0; i < 200 && !p.isDestroyed; i++) {
				p.onFixedUpdate(DT);
				path.push([p.position.x, p.position.y]);
			}
			return { path, hits };
		};

		const a = run();
		const b = run();

		expect(a.path).toEqual(b.path);
		expect(a.hits).toHaveLength(1);
		expect(b.hits).toHaveLength(1);
		expect(a.hits[0]!.x).toBe(b.hits[0]!.x);
		expect(a.hits[0]!.y).toBe(b.hits[0]!.y);
	});
});
