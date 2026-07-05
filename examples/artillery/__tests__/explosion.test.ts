import type { DrawContext } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import { describe, expect, it } from "vitest";
import { EXPLOSION_DURATION } from "../config.js";
import { Explosion } from "../entities/explosion.js";

const DT = 1 / 60;

function makeExplosion(point = new Vec2(120, 200)): Explosion {
	const e = new Explosion();
	e.init(point);
	return e;
}

describe("Explosion", () => {
	it("seats itself at the detonation point via init", () => {
		const e = makeExplosion(new Vec2(321, 88));
		expect(e.position.x).toBe(321);
		expect(e.position.y).toBe(88);
	});

	it("stays alive until EXPLOSION_DURATION of accumulated onUpdate time elapses", () => {
		const e = makeExplosion();
		// Drive up to just before the lifetime threshold in fixed steps.
		let elapsed = 0;
		while (elapsed + DT < EXPLOSION_DURATION) {
			e.onUpdate(DT);
			elapsed += DT;
			expect(e.isDestroyed).toBe(false);
		}
		// One more step crosses EXPLOSION_DURATION → self-destruct.
		e.onUpdate(DT);
		expect(e.isDestroyed).toBe(true);
	});

	it("self-destructs on a single step that meets or exceeds EXPLOSION_DURATION", () => {
		const e = makeExplosion();
		e.onUpdate(EXPLOSION_DURATION);
		expect(e.isDestroyed).toBe(true);
	});

	it("draws its expanding flash without throwing (no pixel assertions)", () => {
		const e = makeExplosion();
		const calls: Array<{ radius: number; alpha: number }> = [];
		let alpha = 1;
		// Minimal DrawContext stub — canvas draws are no-ops under the mock, so we
		// only confirm onDraw runs and its radius/alpha math stays in range.
		const ctx = {
			save() {},
			restore() {},
			setAlpha(a: number) {
				alpha = a;
			},
			circle(_center: Vec2, radius: number) {
				calls.push({ radius, alpha });
			},
		} as unknown as DrawContext;

		e.onDraw(ctx);
		e.onUpdate(EXPLOSION_DURATION / 2);
		e.onDraw(ctx);

		expect(calls.length).toBe(2);
		for (const c of calls) {
			expect(c.alpha).toBeGreaterThanOrEqual(0);
			expect(c.alpha).toBeLessThanOrEqual(1);
			expect(c.radius).toBeGreaterThan(0);
		}

		// Directional check: over time the flash must GROW and FADE. Range-only
		// assertions would pass even if the radius/alpha signs were flipped.
		const [early, later] = calls;
		expect(later!.radius).toBeGreaterThan(early!.radius);
		expect(later!.alpha).toBeLessThan(early!.alpha);
	});
});
