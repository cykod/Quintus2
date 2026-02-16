import { describe, expect, it, vi } from "vitest";
import {
	AABB,
	// @quintus/physics
	Actor,
	AnimatedSprite,
	AssetLoader,
	// @quintus/audio
	AudioBus,
	AudioPlayer,
	AudioPlugin,
	AudioSystem,
	Button,
	// @quintus/camera
	Camera,
	Canvas2DRenderer,
	CollisionObject,
	CollisionShape,
	Color,
	Container,
	clamp,
	definePlugin,
	Ease,
	// @quintus/core
	Game,
	GameLoop,
	// @quintus/input
	Input,
	InputEvent,
	InputPlugin,
	// @quintus/ui
	Label,
	Layer,
	lerp,
	Matrix2D,
	mergeRects,
	Node,
	Node2D,
	Panel,
	PhysicsPlugin,
	PhysicsWorld,
	ProgressBar,
	parseTiledMap,
	Rect,
	Scene,
	SeededRandom,
	Sensor,
	Shape,
	Signal,
	SpatialHash,
	// @quintus/sprites
	Sprite,
	SpriteSheet,
	StaticCollider,
	signal,
	// @quintus/tilemap
	TileMap,
	// @quintus/tween
	Tween,
	TweenPlugin,
	TweenSystem,
	UINode,
	// @quintus/math
	Vec2,
} from "./index.js";

function createGame(): Game {
	return new Game({ width: 320, height: 240, renderer: null });
}

describe("quintus meta-package", () => {
	describe("re-exports all packages", () => {
		it("exports @quintus/math classes", () => {
			expect(Vec2).toBeDefined();
			expect(Matrix2D).toBeDefined();
			expect(Color).toBeDefined();
			expect(AABB).toBeDefined();
			expect(Rect).toBeDefined();
			expect(SeededRandom).toBeDefined();
			expect(clamp(5, 0, 3)).toBe(3);
			expect(lerp(0, 10, 0.5)).toBe(5);
		});

		it("exports @quintus/core classes", () => {
			expect(Game).toBeDefined();
			expect(Node).toBeDefined();
			expect(Node2D).toBeDefined();
			expect(Scene).toBeDefined();
			expect(Signal).toBeDefined();
			expect(signal).toBeDefined();
			expect(GameLoop).toBeDefined();
			expect(AssetLoader).toBeDefined();
			expect(Canvas2DRenderer).toBeDefined();
			expect(definePlugin).toBeDefined();
		});

		it("exports @quintus/physics classes", () => {
			expect(Actor).toBeDefined();
			expect(StaticCollider).toBeDefined();
			expect(Sensor).toBeDefined();
			expect(CollisionShape).toBeDefined();
			expect(CollisionObject).toBeDefined();
			expect(PhysicsPlugin).toBeDefined();
			expect(PhysicsWorld).toBeDefined();
			expect(Shape).toBeDefined();
			expect(SpatialHash).toBeDefined();
		});

		it("exports @quintus/sprites classes", () => {
			expect(Sprite).toBeDefined();
			expect(AnimatedSprite).toBeDefined();
			expect(SpriteSheet).toBeDefined();
		});

		it("exports @quintus/input classes", () => {
			expect(Input).toBeDefined();
			expect(InputEvent).toBeDefined();
			expect(InputPlugin).toBeDefined();
		});

		it("exports @quintus/tilemap classes", () => {
			expect(TileMap).toBeDefined();
			expect(parseTiledMap).toBeDefined();
			expect(mergeRects).toBeDefined();
		});

		it("exports @quintus/camera classes", () => {
			expect(Camera).toBeDefined();
		});

		it("exports @quintus/tween classes", () => {
			expect(Tween).toBeDefined();
			expect(Ease).toBeDefined();
			expect(TweenPlugin).toBeDefined();
			expect(TweenSystem).toBeDefined();
		});

		it("exports @quintus/audio classes", () => {
			expect(AudioBus).toBeDefined();
			expect(AudioPlayer).toBeDefined();
			expect(AudioPlugin).toBeDefined();
			expect(AudioSystem).toBeDefined();
		});

		it("exports @quintus/ui classes", () => {
			expect(Label).toBeDefined();
			expect(Button).toBeDefined();
			expect(Container).toBeDefined();
			expect(ProgressBar).toBeDefined();
			expect(Panel).toBeDefined();
			expect(Layer).toBeDefined();
			expect(UINode).toBeDefined();
		});
	});

	describe("module augmentations", () => {
		it("game.physics accessor works with PhysicsPlugin", () => {
			const game = createGame();
			game.use(PhysicsPlugin());

			class TestScene extends Scene {}
			game.start(TestScene);

			expect(game.physics).toBeInstanceOf(PhysicsWorld);
			game.stop();
		});

		it("game.input accessor works with InputPlugin", () => {
			const game = createGame();
			game.use(
				InputPlugin({
					actions: { jump: ["KeyW"] },
				}),
			);

			class TestScene extends Scene {}
			game.start(TestScene);

			expect(game.input).toBeInstanceOf(Input);
			game.stop();
		});

		it("game.audio accessor works with AudioPlugin", () => {
			// Mock AudioContext for test environment
			const mockCtx = {
				createGain: () => ({
					gain: { value: 1 },
					connect: vi.fn(),
					disconnect: vi.fn(),
				}),
				destination: {},
				currentTime: 0,
				state: "running",
				resume: vi.fn().mockResolvedValue(undefined),
				close: vi.fn().mockResolvedValue(undefined),
			};
			// biome-ignore lint/complexity/useArrowFunction: must be constructable with `new`
			vi.stubGlobal("AudioContext", function () {
				return mockCtx;
			});

			const game = createGame();
			game.use(AudioPlugin());

			class TestScene extends Scene {}
			game.start(TestScene);

			expect(game.audio).toBeInstanceOf(AudioSystem);
			game.stop();

			vi.unstubAllGlobals();
		});

		it("node.tween() works with TweenPlugin", () => {
			const game = createGame();
			game.use(TweenPlugin());

			class TestScene extends Scene {
				onReady() {
					const node = new Node2D();
					node.name = "target";
					this.addChild(node);
				}
			}
			game.start(TestScene);

			const target = (game.currentScene as Scene).find("target") as Node2D;
			expect(target).toBeTruthy();

			target.alpha = 1;
			const tween = target.tween().to({ alpha: 0 }, 1);
			expect(tween).toBeInstanceOf(Tween);

			game.stop();
		});
	});
});
