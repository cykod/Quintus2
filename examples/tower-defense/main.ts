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
import { TitleScene } from "./scenes/title-scene.js";

const game = new Game({
	width: GAME_WIDTH,
	height: GAME_HEIGHT,
	canvas: "game",
	pixelArt: true,
	backgroundColor: "#2d5a1e",
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
	"game-over": GameOverScene,
});

// === Load Assets & Start ===
game.assets
	.load({
		images: ["assets/tileset.png"],
		tmx: ["assets/level1.tmx", "assets/level2.tmx"],
		audio: [
			"assets/sfx/arrow.ogg",
			"assets/sfx/cannon.ogg",
			"assets/sfx/slow.ogg",
			"assets/sfx/enemy-die.ogg",
			"assets/sfx/place.ogg",
			"assets/sfx/wave-start.ogg",
			"assets/sfx/life-lost.ogg",
			"assets/sfx/click.ogg",
			"assets/sfx/victory.ogg",
			"assets/sfx/gameover.ogg",
		],
	})
	.then(() => {
		game.start("title");
	});
