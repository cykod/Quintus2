import { AudioPlugin } from "@quintus/audio";
import { Game } from "@quintus/core";
import { InputPlugin } from "@quintus/input";
import { TweenPlugin } from "@quintus/tween";
import { GAME_HEIGHT, GAME_WIDTH, INPUT_BINDINGS } from "./config.js";
import { LevelCompleteScene } from "./scenes/level-complete.js";
import { LevelSelectScene } from "./scenes/level-select.js";
import { SokobanLevel } from "./scenes/sokoban-level.js";
import { TitleScene } from "./scenes/title-scene.js";

const game = new Game({
	width: GAME_WIDTH,
	height: GAME_HEIGHT,
	canvas: "game",
	pixelArt: true,
	backgroundColor: "#3b2d1f",
	seed: 42,
});

// === Plugins — NO PhysicsPlugin ===
game.use(InputPlugin({ actions: INPUT_BINDINGS }));
game.use(TweenPlugin());
game.use(AudioPlugin());

// === Register Scenes ===
game.registerScenes({
	title: TitleScene,
	"level-select": LevelSelectScene,
	level: SokobanLevel,
	"level-complete": LevelCompleteScene,
});

// === Load Assets & Start ===
game.assets
	.load({
		images: ["assets/tileset.png"],
		audio: [
			"assets/sfx/step.ogg",
			"assets/sfx/push.ogg",
			"assets/sfx/place.ogg",
			"assets/sfx/win.ogg",
			"assets/sfx/undo.ogg",
			"assets/sfx/reset.ogg",
			"assets/sfx/click.ogg",
		],
	})
	.then(() => {
		game.start("title");
	});
