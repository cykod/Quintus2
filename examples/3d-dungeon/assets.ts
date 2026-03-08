import type { Game } from "@quintus/core";

export const MODEL_PATHS = [
	"assets/models/floor.glb",
	"assets/models/wall.glb",
	"assets/models/character-human.glb",
	"assets/models/coin.glb",
	"assets/models/trap.glb",
	"assets/models/stairs.glb",
	"assets/models/chest.glb",
	"assets/models/barrel.glb",
];

export function hasModels(game: Game): boolean {
	return game.assets.get("floor") != null;
}
