import { AudioPlugin } from "@quintus/audio";
import { Game } from "@quintus/core";
import { InputPlugin } from "@quintus/input";
import { Vec2 } from "@quintus/math";
import { PhysicsPlugin } from "@quintus/physics";
import { TweenPlugin } from "@quintus/tween";
import { COLLISION_GROUPS, GAME_HEIGHT, GAME_WIDTH, INPUT_BINDINGS } from "./config.js";
import { GameOverScene } from "./scenes/game-over-scene.js";
import { Level1 } from "./scenes/level1.js";
import { Level2 } from "./scenes/level2.js";
import { Level3 } from "./scenes/level3.js";
import { TitleScene } from "./scenes/title-scene.js";
import { VictoryScene } from "./scenes/victory-scene.js";
import { loadAtlases } from "./sprites.js";

const game = new Game({
	width: GAME_WIDTH,
	height: GAME_HEIGHT,
	canvas: "game",
	pixelArt: false,
	backgroundColor: "#0a0a2e",
	seed: 42,
});

// === Plugins ===
game.use(
	PhysicsPlugin({
		gravity: new Vec2(0, 0),
		collisionGroups: COLLISION_GROUPS,
	}),
);
game.use(InputPlugin({ actions: INPUT_BINDINGS }));
game.use(TweenPlugin());
game.use(AudioPlugin());

// === Register Scenes ===
game.registerScenes({
	title: TitleScene,
	level1: Level1,
	level2: Level2,
	level3: Level3,
	"game-over": GameOverScene,
	victory: VictoryScene,
});

// === Load Assets & Start ===
game.assets
	.load({
		images: [
			"assets/paddles.png",
			"assets/balls.png",
			"assets/tiles_blue.png",
			"assets/tiles_red.png",
			"assets/tiles_green.png",
			"assets/tiles_yellow.png",
			"assets/tiles_grey.png",
			"assets/coins.png",
		],
		xml: [
			"assets/paddles.xml",
			"assets/balls.xml",
			"assets/tiles_blue.xml",
			"assets/tiles_red.xml",
			"assets/tiles_green.xml",
			"assets/tiles_yellow.xml",
			"assets/tiles_grey.xml",
			"assets/coins.xml",
		],
		audio: [
			"assets/brick.wav",
			"assets/brick-strong.wav",
			"assets/paddle.wav",
			"assets/powerup.wav",
			"assets/wall.wav",
		],
	})
	.then(() => {
		loadAtlases(game);
		game.start("title");
	});
