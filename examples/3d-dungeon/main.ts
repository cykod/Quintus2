import { Game } from "@quintus/core";
import { InputPlugin } from "@quintus/input";
import { ThreePlugin } from "@quintus/three";
import { TouchPlugin, topDownLayout } from "@quintus/touch";
import { MODEL_PATHS } from "./assets.js";
import { GAME_HEIGHT, GAME_WIDTH, INPUT_BINDINGS } from "./config.js";
import { GameOverScene } from "./scenes/game-over-scene.js";
import { Level1 } from "./scenes/level1.js";
import { Level2 } from "./scenes/level2.js";
import { Level3 } from "./scenes/level3.js";
import { TitleScene } from "./scenes/title-scene.js";
import { WinScene } from "./scenes/win-scene.js";

const game = new Game({
	width: GAME_WIDTH,
	height: GAME_HEIGHT,
	renderer: null,
	scale: "fit",
});

game.use(ThreePlugin({ antialias: true, background: 0x1a1a2e }));
game.use(InputPlugin({ actions: INPUT_BINDINGS }));
game.use(
	TouchPlugin({
		layout: topDownLayout({
			moveActions: {
				left: "move_left",
				right: "move_right",
				up: "move_up",
				down: "move_down",
			},
			actions: [{ action: "interact", label: "Act", icon: "\u2726" }],
		}),
		scenes: [Level1, Level2, Level3],
	}),
);

game.registerScenes({
	title: TitleScene,
	level1: Level1,
	level2: Level2,
	level3: Level3,
	win: WinScene,
	"game-over": GameOverScene,
});

game.assets.load({ glb: MODEL_PATHS }).then(() => {
	game.start("title");
});
