import { Game } from "@quintus/core";
import { InputPlugin } from "@quintus/input";
import { Vec2 } from "@quintus/math";
import { PhysicsPlugin } from "@quintus/physics";
import { TweenPlugin } from "@quintus/tween";
import { COLLISION_GROUPS, INPUT_BINDINGS } from "./config.js";
import { GameOverScene } from "./scenes/game-over-scene.js";
import { Level1 } from "./scenes/level1.js";
import { Level2 } from "./scenes/level2.js";
import { Level3 } from "./scenes/level3.js";
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
		gravity: new Vec2(0, 0),
		collisionGroups: COLLISION_GROUPS,
	}),
);
game.use(InputPlugin({ actions: INPUT_BINDINGS }));
game.use(TweenPlugin());

// === Register TMX loader (fetch XML as text) ===
game.assets.registerLoader("tmx", async (_name: string, path: string) => {
	const response = await fetch(path);
	if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
	return response.text();
});

// === Register Scenes ===
game.registerScenes({
	title: TitleScene,
	level1: Level1,
	level2: Level2,
	level3: Level3,
	"game-over": GameOverScene,
	victory: VictoryScene,
});

// === Load Assets & Start ===
game.assets
	.load({
		images: ["assets/tileset.png"],
		tmx: ["assets/level1.tmx", "assets/level2.tmx", "assets/level3.tmx"],
	})
	.then(() => {
		game.start("title");
	});
