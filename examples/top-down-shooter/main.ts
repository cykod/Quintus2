import { AudioPlugin } from "@quintus/audio";
import { Game } from "@quintus/core";
import { InputPlugin } from "@quintus/input";
import { Vec2 } from "@quintus/math";
import { PhysicsPlugin } from "@quintus/physics";
import { dualStickLayout, TouchPlugin } from "@quintus/touch";
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
		layout: dualStickLayout({
			fireAction: "fire",
			aimFrom: "Player",
			aimDistance: 120,
			weaponButtons: [
				{ action: "weapon1", label: "1" },
				{ action: "weapon2", label: "2" },
				{ action: "weapon3", label: "3" },
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
		audio: [
			"assets/shoot_pistol.ogg",
			"assets/shoot_machine.ogg",
			"assets/shoot_silencer.ogg",
			"assets/player_hit.ogg",
			"assets/enemy_hit.ogg",
			"assets/enemy_die.ogg",
			"assets/pickup.ogg",
			"assets/wave_start.ogg",
			"assets/weapon_switch.ogg",
		],
	})
	.then(() => {
		loadAtlases(game);
		game.start("title");
	});
