import { type DrawContext, Game, Scene, type SpriteDrawOptions } from "@quintus/core";
import { Rect, Vec2 } from "@quintus/math";
import { describe, expect, it, vi } from "vitest";
import { Sprite } from "./sprite.js";

function createGame(): Game {
	const canvas = document.createElement("canvas");
	return new Game({ width: 800, height: 600, canvas, renderer: null });
}

function mockDrawContext(): DrawContext & {
	imageCalls: Array<{ name: string; pos: Vec2; options?: SpriteDrawOptions }>;
	alphaValues: number[];
} {
	const imageCalls: Array<{ name: string; pos: Vec2; options?: SpriteDrawOptions }> = [];
	const alphaValues: number[] = [];
	return {
		imageCalls,
		alphaValues,
		line: vi.fn(),
		rect: vi.fn(),
		circle: vi.fn(),
		polygon: vi.fn(),
		text: vi.fn(),
		measureText: vi.fn(() => new Vec2(0, 0)),
		image: vi.fn((name: string, pos: Vec2, options?: SpriteDrawOptions) => {
			imageCalls.push({ name, pos: new Vec2(pos.x, pos.y), options });
		}),
		save: vi.fn(),
		restore: vi.fn(),
		setAlpha: vi.fn((alpha: number) => {
			alphaValues.push(alpha);
		}),
	};
}

describe("Sprite", () => {
	it("renders a texture centered by default", () => {
		const game = createGame();
		// Fake asset: register a 32x32 image
		const img = { width: 32, height: 32 } as unknown as ImageBitmap;
		game.assets._storeImage("test", img);

		let sprite!: Sprite;
		game.start(
			class TestScene extends Scene {
				onReady() {
					sprite = this.add(Sprite);
					sprite.texture = "test";
				}
			},
		);

		const ctx = mockDrawContext();
		sprite.onDraw(ctx);

		expect(ctx.imageCalls).toHaveLength(1);
		expect(ctx.imageCalls[0]?.name).toBe("test");
		expect(ctx.imageCalls[0]?.pos.x).toBe(-16); // centered: -32/2
		expect(ctx.imageCalls[0]?.pos.y).toBe(-16);
	});

	it("renders non-centered at origin", () => {
		const game = createGame();
		const img = { width: 32, height: 32 } as unknown as ImageBitmap;
		game.assets._storeImage("test", img);

		let sprite!: Sprite;
		game.start(
			class TestScene extends Scene {
				onReady() {
					sprite = this.add(Sprite);
					sprite.texture = "test";
					sprite.centered = false;
				}
			},
		);

		const ctx = mockDrawContext();
		sprite.onDraw(ctx);

		expect(ctx.imageCalls[0]?.pos.x).toBe(0);
		expect(ctx.imageCalls[0]?.pos.y).toBe(0);
	});

	it("passes flipH and flipV to draw context", () => {
		const game = createGame();
		const img = { width: 16, height: 16 } as unknown as ImageBitmap;
		game.assets._storeImage("test", img);

		let sprite!: Sprite;
		game.start(
			class TestScene extends Scene {
				onReady() {
					sprite = this.add(Sprite);
					sprite.texture = "test";
					sprite.flipH = true;
					sprite.flipV = true;
				}
			},
		);

		const ctx = mockDrawContext();
		sprite.onDraw(ctx);

		expect(ctx.imageCalls[0]?.options?.flipH).toBe(true);
		expect(ctx.imageCalls[0]?.options?.flipV).toBe(true);
	});

	it("applies alpha via setAlpha", () => {
		const game = createGame();
		const img = { width: 16, height: 16 } as unknown as ImageBitmap;
		game.assets._storeImage("test", img);

		let sprite!: Sprite;
		game.start(
			class TestScene extends Scene {
				onReady() {
					sprite = this.add(Sprite);
					sprite.texture = "test";
					sprite.alpha = 0.5;
				}
			},
		);

		const ctx = mockDrawContext();
		sprite.onDraw(ctx);

		expect(ctx.alphaValues).toContain(0.5);
	});

	it("does not set alpha when alpha is 1", () => {
		const game = createGame();
		const img = { width: 16, height: 16 } as unknown as ImageBitmap;
		game.assets._storeImage("test", img);

		let sprite!: Sprite;
		game.start(
			class TestScene extends Scene {
				onReady() {
					sprite = this.add(Sprite);
					sprite.texture = "test";
					sprite.alpha = 1;
				}
			},
		);

		const ctx = mockDrawContext();
		sprite.onDraw(ctx);

		expect(ctx.alphaValues).toHaveLength(0);
	});

	it("does not render when texture is empty", () => {
		const game = createGame();
		let sprite!: Sprite;
		game.start(
			class TestScene extends Scene {
				onReady() {
					sprite = this.add(Sprite);
				}
			},
		);

		const ctx = mockDrawContext();
		sprite.onDraw(ctx);
		expect(ctx.imageCalls).toHaveLength(0);
	});

	it("does not render when texture not loaded (0 dimensions)", () => {
		const game = createGame();
		let sprite!: Sprite;
		game.start(
			class TestScene extends Scene {
				onReady() {
					sprite = this.add(Sprite);
					sprite.texture = "missing";
				}
			},
		);

		const ctx = mockDrawContext();
		sprite.onDraw(ctx);
		expect(ctx.imageCalls).toHaveLength(0);
	});

	it("uses sourceRect dimensions for centering", () => {
		const game = createGame();
		let sprite!: Sprite;
		game.start(
			class TestScene extends Scene {
				onReady() {
					sprite = this.add(Sprite);
					sprite.texture = "items";
					sprite.sourceRect = new Rect(0, 0, 16, 16);
				}
			},
		);

		const ctx = mockDrawContext();
		sprite.onDraw(ctx);

		expect(ctx.imageCalls).toHaveLength(1);
		expect(ctx.imageCalls[0]?.pos.x).toBe(-8); // centered: -16/2
		expect(ctx.imageCalls[0]?.pos.y).toBe(-8);
		expect(ctx.imageCalls[0]?.options?.sourceRect).toEqual(new Rect(0, 0, 16, 16));
	});
});
