import { AudioPlugin } from "@quintus/audio";
import { Game } from "@quintus/core";
import { InputPlugin } from "@quintus/input";
import { Vec2 } from "@quintus/math";
import { PhysicsPlugin } from "@quintus/physics";
import { TweenPlugin } from "@quintus/tween";
import { COLLISION_GROUPS, INPUT_BINDINGS } from "./config.js";
import { TitleScene } from "./scenes/title-scene.js";

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

// === Register TMX loader (fetch XML as text) ===
game.assets.registerLoader("tmx", async (_name: string, path: string) => {
	const response = await fetch(path);
	if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
	return response.text();
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
		game.start(TitleScene);
	});
