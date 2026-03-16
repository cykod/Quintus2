import type { AssetLoader } from "@quintus/core";
import { evaluateCurve, evaluateGradient } from "./curve.js";
import type { ResolvedParticleConfig } from "./particle-config.js";
import type { ParticlePool } from "./particle-pool.js";

const TAU = Math.PI * 2;

// Typed-array element read — always safe for indices within [0, alive).
function f32(arr: Float32Array, i: number): number {
	return arr[i] as number;
}

/**
 * Batch-renders all alive particles onto a Canvas2D context.
 * No per-particle save()/restore() — uses direct fill calls with manual transforms.
 */
export class ParticleRenderer2D {
	render(
		pool: ParticlePool,
		config: ResolvedParticleConfig,
		ctx: CanvasRenderingContext2D,
		assets: AssetLoader | null,
	): void {
		if (pool.alive === 0) return;

		ctx.save();

		// Blend mode
		if (config.blendMode === "additive") {
			ctx.globalCompositeOperation = "lighter";
		} else {
			ctx.globalCompositeOperation = "source-over";
		}

		const curveSizeVal = config.curves?.size;
		const curveAlphaVal = config.curves?.alpha;
		const curveSpeedVal = config.curves?.speed;
		const curveColorVal = config.curves?.color;
		const uniformColor = config._uniformColor;

		// Set uniform color once if applicable (and no curve overrides)
		if (uniformColor && !curveColorVal && !curveAlphaVal) {
			ctx.fillStyle = uniformColor;
		}

		// Dedup fillStyle changes
		let prevR = -1;
		let prevG = -1;
		let prevB = -1;
		let prevA = -1;

		for (let i = 0; i < pool.alive; i++) {
			const t = f32(pool.age, i) / f32(pool.life, i); // 0..1 normalized life progress

			// Size
			let sizeScale: number;
			if (curveSizeVal != null) {
				sizeScale = evaluateCurve(curveSizeVal, t);
			} else {
				sizeScale = config.sizeOverLife[0] + (config.sizeOverLife[1] - config.sizeOverLife[0]) * t;
			}
			const s = f32(pool.size, i) * sizeScale;
			if (s <= 0) continue;

			// Speed curve
			if (curveSpeedVal != null) {
				const speedMul = evaluateCurve(curveSpeedVal, t);
				pool.vx[i] = f32(pool.vx, i) * speedMul;
				pool.vy[i] = f32(pool.vy, i) * speedMul;
			}

			// Color
			if (curveColorVal != null) {
				const c = evaluateGradient(curveColorVal, t);
				const cr = (c.r * 255) | 0;
				const cg = (c.g * 255) | 0;
				const cb = (c.b * 255) | 0;
				let ca = c.a;
				if (curveAlphaVal != null) {
					ca *= evaluateCurve(curveAlphaVal, t);
				}
				if (cr !== prevR || cg !== prevG || cb !== prevB || ca !== prevA) {
					ctx.fillStyle = `rgba(${cr},${cg},${cb},${ca})`;
					prevR = cr;
					prevG = cg;
					prevB = cb;
					prevA = ca;
				}
			} else if (!uniformColor || curveAlphaVal != null) {
				const ri = f32(pool.r, i);
				const gi = f32(pool.g, i);
				const bi = f32(pool.b, i);
				const ai = f32(pool.a, i);
				const cr = ((ri + (f32(pool.rEnd, i) - ri) * t) * 255) | 0;
				const cg = ((gi + (f32(pool.gEnd, i) - gi) * t) * 255) | 0;
				const cb = ((bi + (f32(pool.bEnd, i) - bi) * t) * 255) | 0;
				let ca = ai + (f32(pool.aEnd, i) - ai) * t;
				if (curveAlphaVal != null) {
					ca *= evaluateCurve(curveAlphaVal, t);
				}
				if (cr !== prevR || cg !== prevG || cb !== prevB || ca !== prevA) {
					ctx.fillStyle = `rgba(${cr},${cg},${cb},${ca})`;
					prevR = cr;
					prevG = cg;
					prevB = cb;
					prevA = ca;
				}
			}

			const px = f32(pool.x, i);
			const py = f32(pool.y, i);
			const rot = f32(pool.rotation, i);

			switch (config.shape) {
				case "circle":
					ctx.beginPath();
					ctx.arc(px, py, s * 0.5, 0, TAU);
					ctx.fill();
					break;

				case "rect":
					if (rot !== 0) {
						ctx.save();
						ctx.translate(px, py);
						ctx.rotate(rot);
						ctx.fillRect(-s * 0.5, -s * 0.5, s, s);
						ctx.restore();
					} else {
						ctx.fillRect(px - s * 0.5, py - s * 0.5, s, s);
					}
					break;

				case "triangle": {
					const hs = s * 0.5;
					ctx.save();
					ctx.translate(px, py);
					if (rot !== 0) ctx.rotate(rot);
					ctx.beginPath();
					ctx.moveTo(0, -hs);
					ctx.lineTo(-hs, hs);
					ctx.lineTo(hs, hs);
					ctx.closePath();
					ctx.fill();
					ctx.restore();
					break;
				}

				case "texture": {
					if (!assets || !config.texture) break;
					const img = assets.getImage(config.texture);
					if (!img) break;
					ctx.save();
					ctx.translate(px, py);
					if (rot !== 0) ctx.rotate(rot);
					ctx.drawImage(img, -s * 0.5, -s * 0.5, s, s);
					ctx.restore();
					break;
				}
			}
		}

		ctx.restore();
	}
}
