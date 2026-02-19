import { type DrawContext, Game, Scene, type SpriteDrawOptions } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import { describe, expect, it, vi } from "vitest";
import { AnimatedSprite } from "./animated-sprite.js";
import { SpriteSheet } from "./sprite-sheet.js";

function createGame(): Game {
	const canvas = document.createElement("canvas");
	return new Game({ width: 800, height: 600, canvas, renderer: null });
}

function createSheet(): SpriteSheet {
	return new SpriteSheet({
		texture: "hero",
		frameWidth: 16,
		frameHeight: 24,
		columns: 8,
		animations: {
			idle: { frames: [0, 1], fps: 10, loop: true },
			run: { frames: [2, 3, 4, 5], fps: 10, loop: true },
			jump: { frames: [6], fps: 10, loop: false },
			fall: { frames: [7], fps: 10, loop: false },
			multi: { frames: [0, 1, 2], fps: 10, loop: false },
		},
	});
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

describe("AnimatedSprite", () => {
	it("play() starts an animation", () => {
		const sheet = createSheet();
		let sprite!: AnimatedSprite;
		const game = createGame();
		game.start(
			class TestScene extends Scene {
				onReady() {
					sprite = this.add(AnimatedSprite);
					sprite.spriteSheet = sheet;
				}
			},
		);

		sprite.play("idle");
		expect(sprite.currentAnimation).toBe("idle");
		expect(sprite.playing).toBe(true);
		expect(sprite.frame).toBe(0);
	});

	it("play() same animation does not restart unless restart=true", () => {
		const sheet = createSheet();
		let sprite!: AnimatedSprite;
		const game = createGame();
		game.start(
			class TestScene extends Scene {
				onReady() {
					sprite = this.add(AnimatedSprite);
					sprite.spriteSheet = sheet;
				}
			},
		);

		sprite.play("idle");
		// Advance some time to move frame
		sprite.onUpdate(0.15); // 10fps → 0.1s per frame, so this moves to frame 1
		expect(sprite.frame).toBe(1);

		// Play same anim → should NOT restart
		sprite.play("idle");
		expect(sprite.frame).toBe(1);

		// Play same anim with restart → SHOULD restart
		sprite.play("idle", true);
		expect(sprite.frame).toBe(0);
	});

	it("advances frames at correct fps", () => {
		const sheet = createSheet();
		let sprite!: AnimatedSprite;
		const game = createGame();
		game.start(
			class TestScene extends Scene {
				onReady() {
					sprite = this.add(AnimatedSprite);
					sprite.spriteSheet = sheet;
				}
			},
		);

		sprite.play("idle"); // 2 frames at 10fps → 0.1s per frame
		expect(sprite.frame).toBe(0);

		sprite.onUpdate(0.05); // 50ms → still frame 0
		expect(sprite.frame).toBe(0);

		sprite.onUpdate(0.05); // 100ms total → frame 1
		expect(sprite.frame).toBe(1);

		sprite.onUpdate(0.1); // 200ms total → frame 0 (loop)
		expect(sprite.frame).toBe(0);
	});

	it("speed multiplier works", () => {
		const sheet = createSheet();
		let sprite!: AnimatedSprite;
		const game = createGame();
		game.start(
			class TestScene extends Scene {
				onReady() {
					sprite = this.add(AnimatedSprite);
					sprite.spriteSheet = sheet;
				}
			},
		);

		sprite.play("idle"); // 10fps → 0.1s per frame
		sprite.speed = 2; // 2x → 0.05s per frame effective

		sprite.onUpdate(0.05); // 0.05 * 2 = 0.1s → frame 1
		expect(sprite.frame).toBe(1);
	});

	it("looping wraps back to frame 0", () => {
		const sheet = createSheet();
		let sprite!: AnimatedSprite;
		const game = createGame();
		game.start(
			class TestScene extends Scene {
				onReady() {
					sprite = this.add(AnimatedSprite);
					sprite.spriteSheet = sheet;
				}
			},
		);

		sprite.play("idle"); // 2 frames, loop=true
		sprite.onUpdate(0.1); // frame 1
		sprite.onUpdate(0.1); // frame 0 (wrap)
		expect(sprite.frame).toBe(0);
		expect(sprite.playing).toBe(true);
	});

	it("non-looping stops at last frame and emits animationFinished", () => {
		const sheet = createSheet();
		let sprite!: AnimatedSprite;
		const game = createGame();
		game.start(
			class TestScene extends Scene {
				onReady() {
					sprite = this.add(AnimatedSprite);
					sprite.spriteSheet = sheet;
				}
			},
		);

		const handler = vi.fn();
		sprite.animationFinished.connect(handler);

		sprite.play("multi"); // frames [0,1,2], loop=false
		sprite.onUpdate(0.1); // frame 1
		sprite.onUpdate(0.1); // frame 2
		expect(sprite.frame).toBe(2);

		sprite.onUpdate(0.1); // past last frame → stop
		expect(sprite.playing).toBe(false);
		expect(sprite.frame).toBe(2); // stays on last
		expect(handler).toHaveBeenCalledWith("multi");
		expect(handler).toHaveBeenCalledTimes(1);
	});

	it("stop() freezes playback", () => {
		const sheet = createSheet();
		let sprite!: AnimatedSprite;
		const game = createGame();
		game.start(
			class TestScene extends Scene {
				onReady() {
					sprite = this.add(AnimatedSprite);
					sprite.spriteSheet = sheet;
				}
			},
		);

		sprite.play("idle");
		sprite.onUpdate(0.1); // frame 1
		sprite.stop();
		expect(sprite.playing).toBe(false);
		expect(sprite.frame).toBe(1);

		sprite.onUpdate(0.1); // should NOT advance
		expect(sprite.frame).toBe(1);
	});

	it("pause() freezes playback (alias for stop)", () => {
		const sheet = createSheet();
		let sprite!: AnimatedSprite;
		const game = createGame();
		game.start(
			class TestScene extends Scene {
				onReady() {
					sprite = this.add(AnimatedSprite);
					sprite.spriteSheet = sheet;
				}
			},
		);

		sprite.play("idle");
		sprite.pause();
		expect(sprite.playing).toBe(false);
	});

	it("animationChanged signal fires on animation switch", () => {
		const sheet = createSheet();
		let sprite!: AnimatedSprite;
		const game = createGame();
		game.start(
			class TestScene extends Scene {
				onReady() {
					sprite = this.add(AnimatedSprite);
					sprite.spriteSheet = sheet;
				}
			},
		);

		const handler = vi.fn();
		sprite.animationChanged.connect(handler);

		sprite.play("idle");
		expect(handler).toHaveBeenCalledWith({ from: "", to: "idle" });

		sprite.play("run");
		expect(handler).toHaveBeenCalledWith({ from: "idle", to: "run" });
		expect(handler).toHaveBeenCalledTimes(2);
	});

	it("frameChanged signal fires each frame advance", () => {
		const sheet = createSheet();
		let sprite!: AnimatedSprite;
		const game = createGame();
		game.start(
			class TestScene extends Scene {
				onReady() {
					sprite = this.add(AnimatedSprite);
					sprite.spriteSheet = sheet;
				}
			},
		);

		const handler = vi.fn();
		sprite.frameChanged.connect(handler);

		sprite.play("run"); // frames [2,3,4,5]
		sprite.onUpdate(0.1); // frame 1
		expect(handler).toHaveBeenCalledWith(1);
		sprite.onUpdate(0.1); // frame 2
		expect(handler).toHaveBeenCalledWith(2);
		expect(handler).toHaveBeenCalledTimes(2);
	});

	it("setting frame manually clamps to valid range", () => {
		const sheet = createSheet();
		let sprite!: AnimatedSprite;
		const game = createGame();
		game.start(
			class TestScene extends Scene {
				onReady() {
					sprite = this.add(AnimatedSprite);
					sprite.spriteSheet = sheet;
				}
			},
		);

		sprite.play("run"); // 4 frames [2,3,4,5]
		sprite.frame = 99;
		expect(sprite.frame).toBe(3); // clamped to max index

		sprite.frame = -5;
		expect(sprite.frame).toBe(0); // clamped to 0
	});

	it("onDraw renders correct frame with correct sourceRect", () => {
		const sheet = createSheet();
		let sprite!: AnimatedSprite;
		const game = createGame();
		game.start(
			class TestScene extends Scene {
				onReady() {
					sprite = this.add(AnimatedSprite);
					sprite.spriteSheet = sheet;
				}
			},
		);

		sprite.play("run"); // frames [2,3,4,5]
		sprite.onUpdate(0.1); // frame 1 → sheet frame 3

		const ctx = mockDrawContext();
		sprite.onDraw(ctx);

		expect(ctx.imageCalls).toHaveLength(1);
		expect(ctx.imageCalls[0]?.name).toBe("hero");
		// Sheet frame 3 at column 3: x = 3 * 16 = 48
		expect(ctx.imageCalls[0]?.options?.sourceRect?.x).toBe(48);
		expect(ctx.imageCalls[0]?.options?.sourceRect?.y).toBe(0);
	});

	it("flipH is applied during draw", () => {
		const sheet = createSheet();
		let sprite!: AnimatedSprite;
		const game = createGame();
		game.start(
			class TestScene extends Scene {
				onReady() {
					sprite = this.add(AnimatedSprite);
					sprite.spriteSheet = sheet;
				}
			},
		);

		sprite.play("idle");
		sprite.flipH = true;

		const ctx = mockDrawContext();
		sprite.onDraw(ctx);

		expect(ctx.imageCalls[0]?.options?.flipH).toBe(true);
	});

	it("handles missing spriteSheet gracefully", () => {
		let sprite!: AnimatedSprite;
		const game = createGame();
		game.start(
			class TestScene extends Scene {
				onReady() {
					sprite = this.add(AnimatedSprite);
				}
			},
		);

		const ctx = mockDrawContext();
		sprite.onDraw(ctx);
		expect(ctx.imageCalls).toHaveLength(0);

		// Should not throw
		sprite.onUpdate(0.1);
	});

	it("play() throws for unknown animation", () => {
		const sheet = createSheet();
		let sprite!: AnimatedSprite;
		const game = createGame();
		game.start(
			class TestScene extends Scene {
				onReady() {
					sprite = this.add(AnimatedSprite);
					sprite.spriteSheet = sheet;
				}
			},
		);

		expect(() => sprite.play("nonexistent")).toThrow(/not found/);
	});

	it("play() does nothing when spriteSheet is null", () => {
		let sprite!: AnimatedSprite;
		const game = createGame();
		game.start(
			class TestScene extends Scene {
				onReady() {
					sprite = this.add(AnimatedSprite);
				}
			},
		);

		// Should not throw
		sprite.play("idle");
		expect(sprite.currentAnimation).toBe("");
	});

	it("centered=false draws at origin", () => {
		const sheet = createSheet();
		let sprite!: AnimatedSprite;
		const game = createGame();
		game.start(
			class TestScene extends Scene {
				onReady() {
					sprite = this.add(AnimatedSprite);
					sprite.spriteSheet = sheet;
					sprite.centered = false;
				}
			},
		);

		sprite.play("idle");

		const ctx = mockDrawContext();
		sprite.onDraw(ctx);

		expect(ctx.imageCalls[0]?.pos.x).toBe(0);
		expect(ctx.imageCalls[0]?.pos.y).toBe(0);
	});

	it("alpha is applied when less than 1", () => {
		const sheet = createSheet();
		let sprite!: AnimatedSprite;
		const game = createGame();
		game.start(
			class TestScene extends Scene {
				onReady() {
					sprite = this.add(AnimatedSprite);
					sprite.spriteSheet = sheet;
					sprite.alpha = 0.3;
				}
			},
		);

		sprite.play("idle");

		const ctx = mockDrawContext();
		sprite.onDraw(ctx);

		expect(ctx.alphaValues).toContain(0.3);
	});

	it("animation prop auto-plays on ready", () => {
		const sheet = createSheet();
		let sprite!: AnimatedSprite;
		const game = createGame();
		game.start(
			class TestScene extends Scene {
				onReady() {
					sprite = this.add(AnimatedSprite, {
						spriteSheet: sheet,
						animation: "run",
					});
				}
			},
		);

		expect(sprite.currentAnimation).toBe("run");
		expect(sprite.playing).toBe(true);
	});

	it("animation prop null does not auto-play", () => {
		const sheet = createSheet();
		let sprite!: AnimatedSprite;
		const game = createGame();
		game.start(
			class TestScene extends Scene {
				onReady() {
					sprite = this.add(AnimatedSprite, { spriteSheet: sheet });
				}
			},
		);

		expect(sprite.currentAnimation).toBe("");
		expect(sprite.playing).toBe(false);
	});
});
