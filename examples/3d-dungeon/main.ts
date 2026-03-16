import { AudioPlugin } from "@quintus/audio";
import { Game } from "@quintus/core";
import { InputPlugin } from "@quintus/input";
import { ThreePlugin } from "@quintus/three";
import { puzzleLayout, TouchPlugin } from "@quintus/touch";
import { AUDIO_PATHS, MODEL_PATHS } from "./assets.js";
import { GAME_HEIGHT, GAME_WIDTH, INPUT_BINDINGS } from "./config.js";
import { DebugSwordScene } from "./scenes/debug-sword.js";
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
	scale: "fill",
});

game.use(ThreePlugin({ antialias: true, background: 0x1a1a2e, shadows: true }));
game.use(AudioPlugin());
game.use(InputPlugin({ actions: INPUT_BINDINGS }));
game.use(
	TouchPlugin({
		layout: puzzleLayout({
			actions: {
				left: "turn_left",
				right: "turn_right",
				up: "move_forward",
				down: "move_backward",
			},
			buttons: [{ action: "interact", label: "Act" }],
		}),
		scenes: [Level1, Level2, Level3],
	}),
);

game.registerScenes({
	"debug-sword": DebugSwordScene,
	title: TitleScene,
	level1: Level1,
	level2: Level2,
	level3: Level3,
	win: WinScene,
	"game-over": GameOverScene,
});

game.assets.load({ glb: MODEL_PATHS, audio: AUDIO_PATHS }).then(() => {
	game.start("title");
});
