import "@quintus/jsx";
import { AudioPlugin } from "@quintus/audio";
import { Game } from "@quintus/core";
import { InputPlugin } from "@quintus/input";
import { Vec2 } from "@quintus/math";
import { PhysicsPlugin } from "@quintus/physics";
import { platformerLayout, TouchPlugin } from "@quintus/touch";
import { TweenPlugin } from "@quintus/tween";
import { COLLISION_GROUPS, INPUT_BINDINGS } from "./config.js";
import { TestScene } from "./scenes/test-scene.js";
import { loadAtlases } from "./sprites.js";

const game = new Game({
	width: 640,
	height: 360,
	canvas: "game",
	scale: "fit",
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
game.use(TouchPlugin({ layout: platformerLayout(), fullscreen: true }));
game.use(TweenPlugin());
game.use(AudioPlugin());

// === Register Scenes ===
game.registerScenes({
	test: TestScene,
});

// === Load Assets & Start ===
game.assets
	.load({
		images: [
			"assets/tiles.png",
			"assets/characters.png",
			"assets/enemies.png",
			"assets/bg_clouds.png",
			"assets/bg_color_hills.png",
			"assets/bg_fade_hills.png",
			"assets/bg_solid_sky.png",
		],
		xml: ["assets/tiles.xml", "assets/characters.xml", "assets/enemies.xml"],
		tmx: ["assets/level1.tmx", "assets/tileset.tsx"],
		audio: [
			"assets/sounds/bump.ogg",
			"assets/sounds/coin.ogg",
			"assets/sounds/disappear.ogg",
			"assets/sounds/gem.ogg",
			"assets/sounds/hurt.ogg",
			"assets/sounds/jump.ogg",
			"assets/sounds/jump_high.ogg",
			"assets/sounds/magic.ogg",
			"assets/sounds/select.ogg",
			"assets/sounds/throw.ogg",
		],
	})
	.then(() => {
		loadAtlases(game);
		game.start("test");
	});
