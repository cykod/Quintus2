import { Node2D } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import { describe, expect, it, vi } from "vitest";
import { Ease } from "./easing.js";
import { TweenSystem } from "./tween-system.js";

function createSystem(): TweenSystem {
	return new TweenSystem();
}

class TestNode extends Node2D {
	value = 0;
	// biome-ignore lint/suspicious/noExplicitAny: needed for test
	tint: any = { lerp: (other: any, t: number) => ({ ...other, t, lerp: other.lerp }) };
}

describe("Tween", () => {
	describe("builder API", () => {
		it("creates sequential steps by default", () => {
			const sys = createSystem();
			const node = new TestNode();
			const tween = sys.create(node);
			tween.to({ alpha: 0.5 }, 0.5).to({ alpha: 1 }, 0.5);

			// After 0.5s, first step should complete
			tween._tick(0.5);
			expect(node.alpha).toBeCloseTo(0.5, 5);

			// After another 0.5s, second step should complete
			tween._tick(0.5);
			expect(node.alpha).toBeCloseTo(1, 5);
		});

		it("parallel() makes steps run simultaneously", () => {
			const sys = createSystem();
			const node = new TestNode();
			node.alpha = 1;
			node.rotation = 0;
			const tween = sys.create(node);
			tween.to({ alpha: 0 }, 1).parallel().to({ rotation: Math.PI }, 1);

			tween._tick(0.5);
			expect(node.alpha).toBeCloseTo(0.5, 5);
			expect(node.rotation).toBeCloseTo(Math.PI / 2, 5);

			tween._tick(0.5);
			expect(node.alpha).toBeCloseTo(0, 5);
			expect(node.rotation).toBeCloseTo(Math.PI, 5);
		});

		it("andThen() is a no-op (sequential is default)", () => {
			const sys = createSystem();
			const node = new TestNode();
			node.value = 0;
			const tween = sys.create(node);
			tween.to({ value: 10 }, 0.5).andThen().to({ value: 20 }, 0.5);

			tween._tick(0.5);
			expect(node.value).toBeCloseTo(10, 5);

			tween._tick(0.5);
			expect(node.value).toBeCloseTo(20, 5);
		});

		it("delay() pauses for the given duration", () => {
			const sys = createSystem();
			const node = new TestNode();
			node.value = 0;
			const tween = sys.create(node);
			tween.to({ value: 10 }, 0.5).delay(0.5).to({ value: 20 }, 0.5);

			tween._tick(0.5);
			expect(node.value).toBeCloseTo(10, 5);

			tween._tick(0.5); // delay
			expect(node.value).toBeCloseTo(10, 5);

			tween._tick(0.5);
			expect(node.value).toBeCloseTo(20, 5);
		});

		it("callback() calls function at the right point", () => {
			const sys = createSystem();
			const node = new TestNode();
			node.value = 0;
			const fn = vi.fn();
			const tween = sys.create(node);
			tween.to({ value: 10 }, 0.5).callback(fn).to({ value: 20 }, 0.5);

			tween._tick(0.5);
			expect(node.value).toBeCloseTo(10, 5);
			// First step complete, callback group not yet processed
			expect(fn).not.toHaveBeenCalled();

			tween._tick(0.01); // processes callback group
			expect(fn).toHaveBeenCalledOnce();

			tween._tick(0.5); // processes third group
			expect(node.value).toBeCloseTo(20, 0);
		});
	});

	describe("property interpolation", () => {
		it("interpolates numeric properties", () => {
			const sys = createSystem();
			const node = new TestNode();
			node.value = 0;
			const tween = sys.create(node);
			tween.to({ value: 100 }, 1);

			tween._tick(0.5);
			expect(node.value).toBeCloseTo(50, 5);

			tween._tick(0.5);
			expect(node.value).toBeCloseTo(100, 5);
		});

		it("interpolates Vec2 sub-properties", () => {
			const sys = createSystem();
			const node = new TestNode();
			node.position = new Vec2(0, 0);
			const tween = sys.create(node);
			tween.to({ position: { y: 100 } }, 1);

			tween._tick(0.5);
			expect(node.position.x).toBeCloseTo(0, 5);
			expect(node.position.y).toBeCloseTo(50, 5);

			tween._tick(0.5);
			expect(node.position.y).toBeCloseTo(100, 5);
		});

		it("interpolates multiple sub-properties", () => {
			const sys = createSystem();
			const node = new TestNode();
			node.position = new Vec2(0, 0);
			const tween = sys.create(node);
			tween.to({ position: { x: 100, y: 200 } }, 1);

			tween._tick(1);
			expect(node.position.x).toBeCloseTo(100, 5);
			expect(node.position.y).toBeCloseTo(200, 5);
		});

		it("interpolates objects with lerp (mode 3)", () => {
			const sys = createSystem();
			const node = new TestNode();
			const startVal = {
				r: 0,
				g: 0,
				b: 0,
				lerp(other: typeof startVal, t: number) {
					return {
						r: startVal.r + (other.r - startVal.r) * t,
						g: startVal.g + (other.g - startVal.g) * t,
						b: startVal.b + (other.b - startVal.b) * t,
						lerp: startVal.lerp,
					};
				},
			};
			const endVal = { r: 1, g: 0, b: 0, lerp: startVal.lerp };
			node.tint = startVal;
			const tween = sys.create(node);
			tween.to({ tint: endVal }, 1);

			tween._tick(0.5);
			expect(node.tint.r).toBeCloseTo(0.5, 5);

			tween._tick(0.5);
			expect(node.tint.r).toBeCloseTo(1, 5);
		});

		it("interpolates multiple properties simultaneously", () => {
			const sys = createSystem();
			const node = new TestNode();
			node.alpha = 1;
			node.rotation = 0;
			const tween = sys.create(node);
			tween.to({ alpha: 0, rotation: Math.PI }, 1);

			tween._tick(0.5);
			expect(node.alpha).toBeCloseTo(0.5, 5);
			expect(node.rotation).toBeCloseTo(Math.PI / 2, 5);
		});

		it("captures start values lazily when step begins", () => {
			const sys = createSystem();
			const node = new TestNode();
			node.value = 0;
			const tween = sys.create(node);
			tween.to({ value: 100 }, 1);

			// Change value before first tick
			node.value = 50;

			tween._tick(0.5);
			// Should lerp from 50 to 100, so at 50% = 75
			expect(node.value).toBeCloseTo(75, 5);
		});

		it("instant snap when duration is 0", () => {
			const sys = createSystem();
			const node = new TestNode();
			node.value = 0;
			const tween = sys.create(node);
			tween.to({ value: 100 }, 0);

			tween._tick(0.01);
			expect(node.value).toBeCloseTo(100, 5);
		});
	});

	describe("easing", () => {
		it("applies easing function", () => {
			const sys = createSystem();
			const node = new TestNode();
			node.value = 0;
			const tween = sys.create(node);
			tween.to({ value: 100 }, 1, Ease.quadIn);

			tween._tick(0.5);
			// quadIn(0.5) = 0.25, so value = 25
			expect(node.value).toBeCloseTo(25, 5);
		});

		it("accepts custom easing function", () => {
			const sys = createSystem();
			const node = new TestNode();
			node.value = 0;
			const customEase = (t: number) => t * t * t;
			const tween = sys.create(node);
			tween.to({ value: 1000 }, 1, customEase);

			tween._tick(0.5);
			expect(node.value).toBeCloseTo(125, 5);
		});
	});

	describe("control", () => {
		it("kill() stops the tween immediately", () => {
			const sys = createSystem();
			const node = new TestNode();
			node.value = 0;
			const tween = sys.create(node);
			tween.to({ value: 100 }, 1);

			tween._tick(0.5);
			expect(node.value).toBeCloseTo(50, 5);

			tween.kill();
			tween._tick(0.5);
			expect(node.value).toBeCloseTo(50, 5); // doesn't change
			expect(tween.isKilled).toBe(true);
			expect(tween.running).toBe(false);
		});

		it("pause() and resume() work correctly", () => {
			const sys = createSystem();
			const node = new TestNode();
			node.value = 0;
			const tween = sys.create(node);
			tween.to({ value: 100 }, 1);

			tween._tick(0.25);
			expect(node.value).toBeCloseTo(25, 5);

			tween.pause();
			tween._tick(0.25);
			expect(node.value).toBeCloseTo(25, 5); // doesn't change

			tween.resume();
			tween._tick(0.25);
			expect(node.value).toBeCloseTo(50, 5);
		});
	});

	describe("repeat", () => {
		it("repeats a fixed number of times", () => {
			const sys = createSystem();
			const node = new TestNode();
			node.value = 0;
			const tween = sys.create(node);
			tween.to({ value: 100 }, 0.5).repeat(1);

			tween._tick(0.5); // first play
			expect(node.value).toBeCloseTo(100, 5);

			tween._tick(0.25); // first repeat, halfway
			expect(node.value).toBeCloseTo(50, 5);

			tween._tick(0.25); // first repeat complete
			expect(tween.isComplete).toBe(true);
		});

		it("infinite repeat with .repeat()", () => {
			const sys = createSystem();
			const node = new TestNode();
			node.value = 0;
			const loopFn = vi.fn();
			const tween = sys.create(node);
			tween.to({ value: 100 }, 0.5).repeat();
			tween.looped.connect(loopFn);

			for (let i = 0; i < 10; i++) {
				tween._tick(0.5);
			}
			expect(tween.isComplete).toBe(false);
			expect(tween.running).toBe(true);
			expect(loopFn).toHaveBeenCalledTimes(10);
		});

		it("looped signal emits iteration index", () => {
			const sys = createSystem();
			const node = new TestNode();
			const iterations: number[] = [];
			const tween = sys.create(node);
			tween.to({ value: 100 }, 0.1).repeat(2);
			tween.looped.connect((i) => iterations.push(i));

			tween._tick(0.1); // first play
			tween._tick(0.1); // repeat 1
			tween._tick(0.1); // repeat 2
			expect(iterations).toEqual([1, 2]);
		});
	});

	describe("signals", () => {
		it("completed signal fires when tween finishes", () => {
			const sys = createSystem();
			const node = new TestNode();
			const fn = vi.fn();
			const tween = sys.create(node);
			tween.to({ value: 100 }, 0.5).onComplete(fn);

			tween._tick(0.5);
			expect(fn).toHaveBeenCalledOnce();
		});

		it("completed does not fire on kill", () => {
			const sys = createSystem();
			const node = new TestNode();
			const fn = vi.fn();
			const tween = sys.create(node);
			tween.to({ value: 100 }, 1).onComplete(fn);

			tween._tick(0.5);
			tween.kill();
			expect(fn).not.toHaveBeenCalled();
		});
	});

	describe("TweenSystem", () => {
		it("updates all active tweens", () => {
			const sys = createSystem();
			const n1 = new TestNode();
			const n2 = new TestNode();
			n1.value = 0;
			n2.value = 0;

			sys.create(n1).to({ value: 100 }, 1);
			sys.create(n2).to({ value: 200 }, 1);

			sys.update(0.5);
			expect(n1.value).toBeCloseTo(50, 5);
			expect(n2.value).toBeCloseTo(100, 5);
		});

		it("removes completed tweens", () => {
			const sys = createSystem();
			const node = new TestNode();
			node.value = 0;
			sys.create(node).to({ value: 100 }, 0.5);

			sys.update(0.5);
			// Tween should be removed; second update should not crash
			sys.update(0.5);
			expect(node.value).toBeCloseTo(100, 5);
		});

		it("removes killed tweens on update", () => {
			const sys = createSystem();
			const node = new TestNode();
			const tween = sys.create(node).to({ value: 100 }, 1);
			tween.kill();
			sys.update(0.1);
			// Should not crash, tween is removed
		});

		it("killTweensOf removes all tweens for a node", () => {
			const sys = createSystem();
			const node = new TestNode();
			node.value = 0;
			sys.create(node).to({ value: 100 }, 1);
			sys.create(node).to({ alpha: 0 }, 1);

			sys.killTweensOf(node);
			sys.update(0.5);
			expect(node.value).toBe(0);
			expect(node.alpha).toBe(1);
		});

		it("killAll removes all tweens", () => {
			const sys = createSystem();
			const n1 = new TestNode();
			const n2 = new TestNode();
			sys.create(n1).to({ value: 100 }, 1);
			sys.create(n2).to({ value: 200 }, 1);

			sys.killAll();
			sys.update(0.5);
			expect(n1.value).toBe(0);
			expect(n2.value).toBe(0);
		});

		it("auto-removes tweens when target node is destroyed", () => {
			const sys = createSystem();
			const node = new TestNode();
			node.value = 0;
			sys.create(node).to({ value: 100 }, 1);

			// Mark as destroyed
			(node as unknown as { _isDestroyed: boolean })._isDestroyed = true;

			sys.update(0.5);
			expect(node.value).toBe(0); // not updated
		});
	});

	describe("empty tween", () => {
		it("completes immediately with no steps", () => {
			const sys = createSystem();
			const node = new TestNode();
			const fn = vi.fn();
			const tween = sys.create(node);
			tween.onComplete(fn);

			tween._tick(0.01);
			expect(fn).toHaveBeenCalledOnce();
			expect(tween.isComplete).toBe(true);
		});
	});
});
