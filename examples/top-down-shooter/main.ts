import { AudioPlugin } from "@quintus/audio";
import { Game } from "@quintus/core";
import { InputPlugin } from "@quintus/input";
import { Vec2 } from "@quintus/math";
import { PhysicsPlugin } from "@quintus/physics";
import { TweenPlugin } from "@quintus/tween";
import { COLLISION_GROUPS, GAME_HEIGHT, GAME_WIDTH, INPUT_BINDINGS } from "./config.js";
import { ArenaScene } from "./scenes/arena-scene.js";
import { GameOverScene } from "./scenes/game-over-scene.js";
import { TitleScene } from "./scenes/title-scene.js";
import { loadAtlases } from "./sprites.js";

const game = new Game({
	width: GAME_WIDTH,
	height: GAME_HEIGHT,
	canvas: "game",
	pixelArt: true,
	backgroundColor: "#1a1a2e",
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
	arena: ArenaScene,
	"game-over": GameOverScene,
});

// === Load Assets & Start ===
game.assets
	.load({
		images: [
			"assets/spritesheet_characters.png",
			"assets/weapon_gun.png",
			"assets/weapon_machine.png",
			"assets/weapon_silencer.png",
		],
		xml: ["assets/spritesheet_characters.xml"],
	})
	.then(() => {
		loadAtlases(game);
		game.start("title");
	});
