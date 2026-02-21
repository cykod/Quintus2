import type { NodeConstructor } from "@quintus/core";
import { Barbarian } from "../entities/barbarian.js";
import { Chest } from "../entities/chest.js";
import { Door } from "../entities/door.js";
import { Dwarf } from "../entities/dwarf.js";
import { HealthPickup } from "../entities/health-pickup.js";
import { PotionPickup } from "../entities/potion-pickup.js";

/** Type → constructor mapping for spawnObjects(). */
export const ENTITY_MAPPING: Record<string, NodeConstructor> = {
	Dwarf: Dwarf,
	Skeleton: Dwarf, // backward compat for old TMX files
	Barbarian: Barbarian,
	Orc: Barbarian, // backward compat for old TMX files
	Chest: Chest,
	HealthPickup: HealthPickup,
	PotionPickup: PotionPickup,
	Door: Door,
};
