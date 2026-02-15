import { Rect } from "@quintus/math";
import { describe, expect, it } from "vitest";
import type { Animation } from "./sprite-sheet.js";
import { SpriteSheet } from "./sprite-sheet.js";

function requireAnimation(sheet: SpriteSheet, name: string): Animation {
	const anim = sheet.getAnimation(name);
	if (!anim) throw new Error(`Animation "${name}" not found`);
	return anim;
}

describe("SpriteSheet", () => {
	it("computes frame rects for a simple grid", () => {
		const sheet = new SpriteSheet({
			texture: "hero",
			frameWidth: 16,
			frameHeight: 24,
			columns: 4,
			rows: 2,
		});
		expect(sheet.frameCount).toBe(8);
		expect(sheet.getFrameRect(0)).toEqual(new Rect(0, 0, 16, 24));
		expect(sheet.getFrameRect(1)).toEqual(new Rect(16, 0, 16, 24));
		expect(sheet.getFrameRect(4)).toEqual(new Rect(0, 24, 16, 24));
		expect(sheet.getFrameRect(7)).toEqual(new Rect(48, 24, 16, 24));
	});

	it("computes frame rects with margin and spacing", () => {
		const sheet = new SpriteSheet({
			texture: "tiles",
			frameWidth: 8,
			frameHeight: 8,
			columns: 2,
			rows: 2,
			margin: 1,
			spacing: 2,
		});
		// First frame: margin + 0 * (8 + 2) = 1, 1
		expect(sheet.getFrameRect(0)).toEqual(new Rect(1, 1, 8, 8));
		// Second frame: margin + 1 * (8 + 2) = 11, 1
		expect(sheet.getFrameRect(1)).toEqual(new Rect(11, 1, 8, 8));
		// Third frame: row 1, col 0: margin + 0 * (8+2) = 1, margin + 1 * (8+2) = 11
		expect(sheet.getFrameRect(2)).toEqual(new Rect(1, 11, 8, 8));
		// Fourth frame: row 1, col 1: 11, 11
		expect(sheet.getFrameRect(3)).toEqual(new Rect(11, 11, 8, 8));
	});

	it("auto-calculates rows from animation max frame", () => {
		const sheet = new SpriteSheet({
			texture: "hero",
			frameWidth: 16,
			frameHeight: 24,
			columns: 4,
			animations: {
				run: { frames: [0, 1, 2, 3, 4, 5] },
			},
		});
		// Max frame is 5, columns=4, so rows = ceil(6/4) = 2
		expect(sheet.rows).toBe(2);
		expect(sheet.frameCount).toBe(8);
	});

	it("defaults to 1 row with no animations and no explicit rows", () => {
		const sheet = new SpriteSheet({
			texture: "hero",
			frameWidth: 16,
			frameHeight: 24,
			columns: 4,
		});
		// maxFrame=0 → rows = ceil(1/4) = 1
		expect(sheet.rows).toBe(1);
		expect(sheet.frameCount).toBe(4);
	});

	it("looks up animations by name", () => {
		const sheet = new SpriteSheet({
			texture: "hero",
			frameWidth: 16,
			frameHeight: 24,
			columns: 8,
			animations: {
				idle: { frames: [0, 1], fps: 4, loop: true },
				jump: { frames: [6], loop: false },
			},
		});

		const idle = requireAnimation(sheet, "idle");
		expect(idle.name).toBe("idle");
		expect(idle.frames).toEqual([0, 1]);
		expect(idle.fps).toBe(4);
		expect(idle.loop).toBe(true);

		const jump = requireAnimation(sheet, "jump");
		expect(jump.name).toBe("jump");
		expect(jump.frames).toEqual([6]);
		expect(jump.fps).toBe(10); // default
		expect(jump.loop).toBe(false);

		expect(sheet.getAnimation("missing")).toBeUndefined();
	});

	it("hasAnimation returns correct boolean", () => {
		const sheet = new SpriteSheet({
			texture: "hero",
			frameWidth: 16,
			frameHeight: 24,
			columns: 4,
			animations: {
				idle: { frames: [0, 1] },
			},
		});
		expect(sheet.hasAnimation("idle")).toBe(true);
		expect(sheet.hasAnimation("run")).toBe(false);
	});

	it("animationNames returns all names", () => {
		const sheet = new SpriteSheet({
			texture: "hero",
			frameWidth: 16,
			frameHeight: 24,
			columns: 8,
			animations: {
				idle: { frames: [0, 1] },
				run: { frames: [2, 3, 4, 5] },
				jump: { frames: [6] },
			},
		});
		expect(sheet.animationNames).toEqual(["idle", "run", "jump"]);
	});

	it("getFrameRect clamps out-of-range index to first frame", () => {
		const sheet = new SpriteSheet({
			texture: "hero",
			frameWidth: 16,
			frameHeight: 24,
			columns: 4,
			rows: 1,
		});
		expect(sheet.getFrameRect(99)).toEqual(sheet.getFrameRect(0));
	});

	it("fromJSON creates sheet with explicit columns", () => {
		const json = {
			texture: "hero",
			frameWidth: 16,
			frameHeight: 24,
			columns: 8,
			animations: {
				idle: { frames: [0, 1] },
			},
		};
		const sheet = SpriteSheet.fromJSON(json);
		expect(sheet.columns).toBe(8);
		expect(sheet.hasAnimation("idle")).toBe(true);
	});

	it("fromJSON auto-detects columns from image width", () => {
		const json = {
			texture: "hero",
			frameWidth: 16,
			frameHeight: 24,
		};
		const sheet = SpriteSheet.fromJSON(json, 128);
		expect(sheet.columns).toBe(8); // 128 / 16 = 8
	});

	it("fromJSON defaults to 1 column with no width or columns", () => {
		const json = {
			texture: "hero",
			frameWidth: 16,
			frameHeight: 24,
		};
		const sheet = SpriteSheet.fromJSON(json);
		expect(sheet.columns).toBe(1);
	});

	it("animation frames are frozen (immutable)", () => {
		const sheet = new SpriteSheet({
			texture: "hero",
			frameWidth: 16,
			frameHeight: 24,
			columns: 4,
			animations: {
				idle: { frames: [0, 1] },
			},
		});
		const anim = requireAnimation(sheet, "idle");
		expect(() => {
			(anim.frames as number[])[0] = 99;
		}).toThrow();
	});

	it("stores texture, frameWidth, frameHeight, margin, spacing", () => {
		const sheet = new SpriteSheet({
			texture: "tiles",
			frameWidth: 32,
			frameHeight: 16,
			columns: 4,
			margin: 2,
			spacing: 1,
		});
		expect(sheet.texture).toBe("tiles");
		expect(sheet.frameWidth).toBe(32);
		expect(sheet.frameHeight).toBe(16);
		expect(sheet.columns).toBe(4);
		expect(sheet.margin).toBe(2);
		expect(sheet.spacing).toBe(1);
	});
});
