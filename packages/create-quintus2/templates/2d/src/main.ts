import { AudioPlugin, Game, InputPlugin, PhysicsPlugin, Vec2 } from "quintus2";
import { COLLISION_GROUPS, GAME_HEIGHT, GAME_WIDTH, INPUT_BINDINGS } from "./config.js";
import { Level1 } from "./scenes/level1.js";
import { WinScene } from "./scenes/win.js";

const game = new Game({
	width: GAME_WIDTH,
	height: GAME_HEIGHT,
	canvas: "game",
	scale: "fit",
	pixelArt: true,
	backgroundColor: "#1a1a2e",
	seed: 42,
});

// === Plugins ===
game.use(PhysicsPlugin({ gravity: new Vec2(0, 800), collisionGroups: COLLISION_GROUPS }));
game.use(InputPlugin({ actions: INPUT_BINDINGS }));
game.use(AudioPlugin());

// === Scenes ===
game.registerScenes({ level1: Level1, win: WinScene });

// === Load assets, then start ===
game.assets
	.load({
		images: ["assets/tiles.png"],
		audio: ["assets/coin.ogg"],
	})
	.then(() => {
		game.start("level1");
	})
	.catch((err) => {
		// The most likely first edit here is a mistyped asset path. Without this handler that
		// surfaces only as an unhandled rejection + a blank canvas — log something actionable.
		console.error("Failed to load assets — check the paths under public/assets/", err);
	});
