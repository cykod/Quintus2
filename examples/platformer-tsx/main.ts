import "@quintus/jsx";
import { AudioPlugin } from "@quintus/audio";
import { Game } from "@quintus/core";
import { InputPlugin } from "@quintus/input";
import { Vec2 } from "@quintus/math";
import { PhysicsPlugin } from "@quintus/physics";
import { TweenPlugin } from "@quintus/tween";
import { COLLISION_GROUPS, INPUT_BINDINGS } from "./config.js";
import { GameOverScene } from "./scenes/game-over-scene.js";
import { Level1 } from "./scenes/level1.js";
import { Level2 } from "./scenes/level2.js";
import { TitleScene } from "./scenes/title-scene.js";
import { VictoryScene } from "./scenes/victory-scene.js";

const game = new Game({
	width: 320,
	height: 240,
	canvas: "game",
	pixelArt: true,
	backgroundColor: "#1a1a2e",
	seed: 42,
});

// === Plugins ===
game.use(
	PhysicsPlugin({
		gravity: new Vec2(0, 800),
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
	victory: VictoryScene,
});

// === Load Assets & Start ===
game.assets
	.load({
		images: ["assets/tileset.png"],
		tmx: ["assets/level1.tmx", "assets/level2.tmx"],
		audio: [
			"assets/jump.ogg",
			"assets/coin.ogg",
			"assets/hit.ogg",
			"assets/stomp.ogg",
			"assets/heal.ogg",
			"assets/victory.ogg",
		],
	})
	.then(() => {
		game.start("title");
	});
