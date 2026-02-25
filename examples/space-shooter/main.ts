import { AudioPlugin } from "@quintus/audio";
import { Game } from "@quintus/core";
import { InputPlugin } from "@quintus/input";
import { Vec2 } from "@quintus/math";
import { PhysicsPlugin } from "@quintus/physics";
import { TweenPlugin } from "@quintus/tween";
import { COLLISION_GROUPS, GAME_HEIGHT, GAME_WIDTH, INPUT_BINDINGS } from "./config.js";
import { GameOverScene } from "./scenes/game-over-scene.js";
import { ShooterLevel } from "./scenes/shooter-level.js";
import { TitleScene } from "./scenes/title-scene.js";
import { loadAtlas } from "./sprites.js";

const game = new Game({
	width: GAME_WIDTH,
	height: GAME_HEIGHT,
	canvas: "game",
	pixelArt: false,
	backgroundColor: "#0a0a1e",
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
	game: ShooterLevel,
	"game-over": GameOverScene,
});

// === Load Assets & Start ===
game.assets
	.load({
		images: ["assets/tileset.png", "assets/particles.png"],
		xml: ["assets/tileset.xml"],
		audio: [
			"assets/player_shoot.ogg",
			"assets/enemy_shoot.ogg",
			"assets/enemy_hit.ogg",
			"assets/enemy_die.ogg",
			"assets/boss_die.ogg",
			"assets/player_hit.ogg",
			"assets/powerup.ogg",
		],
	})
	.then(() => {
		loadAtlas(game);
		game.start("title");
	});
