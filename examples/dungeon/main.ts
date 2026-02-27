import { AudioPlugin } from "@quintus/audio";
import { Game } from "@quintus/core";
import { InputPlugin } from "@quintus/input";
import { Vec2 } from "@quintus/math";
import { PhysicsPlugin } from "@quintus/physics";
import { TouchPlugin, topDownLayout } from "@quintus/touch";
import { TweenPlugin } from "@quintus/tween";
import { COLLISION_GROUPS, INPUT_BINDINGS } from "./config.js";
import { GameOverScene } from "./scenes/game-over-scene.js";
import { Level1 } from "./scenes/level1.js";
import { Level2 } from "./scenes/level2.js";
import { Level3 } from "./scenes/level3.js";
import { TestItemsLevel } from "./scenes/test-items-level.js";
import { TitleScene } from "./scenes/title-scene.js";
import { VictoryScene } from "./scenes/victory-scene.js";

const game = new Game({
	width: 320,
	height: 240,
	canvas: "game",
	scale: "fit",
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
game.use(
	TouchPlugin({
		layout: topDownLayout({
			moveActions: { left: "left", right: "right", up: "up", down: "down" },
			actions: [
				{ action: "attack", label: "Atk", icon: "⚔" },
				{ action: "defend", label: "Def", icon: "🛡" },
				{ action: "interact", label: "E", icon: "✋" },
				{ action: "use_potion", label: "Pot", icon: "🧪" },
			],
		}),
		fullscreen: true,
	}),
);
game.use(TweenPlugin());
game.use(AudioPlugin());

// === Register Scenes ===
game.registerScenes({
	title: TitleScene,
	level1: Level1,
	level2: Level2,
	level3: Level3,
	"game-over": GameOverScene,
	victory: VictoryScene,
	"test-items": TestItemsLevel,
});

// === Load Assets & Start ===
game.assets
	.load({
		images: ["assets/tileset.png"],
		tmx: ["assets/level1.tmx", "assets/level2.tmx", "assets/level3.tmx", "assets/test-items.tmx"],
		audio: [
			"assets/sfx/swing.ogg",
			"assets/sfx/hit.ogg",
			"assets/sfx/enemy-swing.ogg",
			"assets/sfx/player-hurt.ogg",
			"assets/sfx/enemy-die.ogg",
			"assets/sfx/shield-up.ogg",
			"assets/sfx/shield-block.ogg",
			"assets/sfx/pickup.ogg",
			"assets/sfx/loot.ogg",
			"assets/sfx/chest-open.ogg",
			"assets/sfx/door-open.ogg",
			"assets/sfx/use-potion.ogg",
		],
	})
	.then(() => {
		game.start(location.hash === "#test-items" ? "test-items" : "title");
	});
