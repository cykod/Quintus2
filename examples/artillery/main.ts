import { AudioPlugin } from "@quintus/audio";
import { Game } from "@quintus/core";
import { InputPlugin } from "@quintus/input";
import { Vec2 } from "@quintus/math";
import { PhysicsPlugin } from "@quintus/physics";
import { TouchPlugin } from "@quintus/touch";
import { COLLISION_GROUPS, GAME_HEIGHT, GAME_WIDTH, INPUT_BINDINGS, SEED } from "./config.js";
import { GameScene } from "./scenes/game-scene.js";
import { ResultsScene } from "./scenes/results-scene.js";
import { TitleScene } from "./scenes/title-scene.js";
import { artilleryLayout } from "./touch-layout.js";

const game = new Game({
	width: GAME_WIDTH,
	height: GAME_HEIGHT,
	canvas: "game",
	scale: "fill",
	fillAxis: "width",
	pixelArt: false,
	backgroundColor: "#8ec7e6",
	seed: SEED,
});

// World gravity is zero — the projectile applies GRAVITY (and wind) itself, so no
// engine body is subject to hidden acceleration (keeps ballistics deterministic).
game.use(PhysicsPlugin({ gravity: new Vec2(0, 0), collisionGroups: COLLISION_GROUPS }));
game.use(InputPlugin({ actions: INPUT_BINDINGS }));
// Mobile: on-screen aim (◀/▶) + FIRE buttons, only during play. Auto-shown on touch
// devices; the title/results screens advance via a tap (ui_confirm binds mouse:left).
game.use(TouchPlugin({ layout: artilleryLayout(), scenes: [GameScene] }));
game.use(AudioPlugin());

game.registerScenes({ title: TitleScene, game: GameScene, results: ResultsScene });

// Load SFX (Kenney CC0 clips reused from tower-defense/space-shooter — see
// assets/ATTRIBUTION.md) keyed by filename: "fire" and "explosion".
game.assets.load({ audio: ["assets/fire.ogg", "assets/explosion.ogg"] }).then(() => {
	game.start("title");
});
