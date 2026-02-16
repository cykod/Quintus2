#!/usr/bin/env node
/**
 * Level generator for the Quintus platformer example.
 *
 * Converts text-art level descriptions into Tiled-compatible JSON files
 * using the Kenney Pico-8 Platformer tileset (8×8 packed, 15 columns).
 *
 * Tileset: https://kenney.nl/assets/pico-8-platformer (CC0)
 *
 * Usage: node generate-levels.mjs
 */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = join(__dirname, "..", "assets");

// === Tiled flip flags ===
const FLIP_H = 0x80000000;
const FLIP_V = 0x40000000;
const FLIP_D = 0x20000000;

// === Tile GIDs (1-indexed as Tiled expects, firstgid=1) ===
// Row 0 (indices 0–14)
const FILL = 1; // Interior fill (light tan solid)
const FILL_ALT = 2; // Orange-tinted fill variant
const BG = 3; // Dark background fill
const INNER_TL = 4; // Inner corner top-left
const TOP = 5; // Top surface edge
const INNER_TR = 6; // Inner corner top-right
const LEFT = 7; // Left surface edge
const OUTER_TL = 8; // Outer corner top-left (convex triangle)
const OUTER_TR = 9; // Outer corner top-right
const DECO_SMALL = 10; // Small cross decoration
const PLATFORM_L = 11; // Platform left end cap
const LEDGE = 12; // Ledge/narrow surface

// Row 1 (indices 15–29)
const INNER_BL = 16; // Inner corner bottom-left
const BOTTOM = 17; // Bottom surface edge
const INNER_BR = 18; // Inner corner bottom-right
const TREE_TOP = 19; // Tree top / vertical decoration
const RIGHT = 20; // Right surface edge (also door frame)
// Tiles 21-23: Blue water tiles
const DECO_VINE = 24; // Vine / hanging decoration
const OUTER_BL = 25; // Outer corner bottom-left
const PLATFORM_R = 26; // Platform right end / surface
const WALL_DETAIL = 27; // Wall detail tile
const WALL_VERT = 28; // Vertical wall right
const WALL_CORNER = 29; // Wall corner piece
const WALL_BASE = 30; // Wall base

// Row 2 (indices 30–44) — Pink terrain theme (same structure as orange)
const PINK_FILL = 31;
const PINK_BG = 33;
const PINK_TOP = 35;

// Row 3 (indices 45-59) — Additional terrain
const PIPE_TOP = 47; // Pipe/column top
const PIPE_MID = 62; // Pipe/column middle (row 4)

// Rows 4-5 (indices 60–89) — Characters & decorations
const TREE_TRUNK_1 = 64; // Tree trunk segment
const TREE_TRUNK_2 = 65; // Tree trunk continuation

// Rows 6-7 (indices 90–119) — Player, enemies, items
const SPIKE = 71; // Spike / hazard
const FLAG_TOP = 72; // Flag (top)
const FLAG_BOTTOM = 73; // Flag (bottom)

// === Autotile logic ===

/**
 * Given a boolean solid grid, determine the correct GID for each cell.
 * Uses the orange terrain theme (rows 0–1 of the tileset).
 */
function autotile(solid, width, height) {
	const data = new Array(width * height).fill(0);

	function isSolid(x, y) {
		if (x < 0 || x >= width || y < 0 || y >= height) return false;
		return solid[y * width + x];
	}

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			if (!isSolid(x, y)) continue;

			const above = isSolid(x, y - 1);
			const below = isSolid(x, y + 1);
			const left = isSolid(x - 1, y);
			const right = isSolid(x + 1, y);
			const aboveLeft = isSolid(x - 1, y - 1);
			const aboveRight = isSolid(x + 1, y - 1);
			const belowLeft = isSolid(x - 1, y + 1);
			const belowRight = isSolid(x + 1, y + 1);

			let gid = FILL; // Default: interior

			// Edges (one side exposed)
			if (!above && below && left && right) {
				gid = TOP;
			} else if (above && !below && left && right) {
				gid = BOTTOM;
			} else if (above && below && !left && right) {
				gid = LEFT;
			} else if (above && below && left && !right) {
				gid = RIGHT;
			}

			// Outer corners (two adjacent sides exposed)
			else if (!above && !left && below && right) {
				gid = OUTER_TL;
			} else if (!above && !right && below && left) {
				gid = OUTER_TR;
			} else if (!below && !left && above && right) {
				gid = OUTER_BL;
			} else if (!below && !right && above && left) {
				gid = (OUTER_BL | FLIP_H) >>> 0; // Mirror BL corner horizontally for BR
			}

			// Inner corners (diagonal exposed while cardinal neighbors are solid)
			else if (above && below && left && right) {
				if (!aboveLeft) gid = INNER_TL;
				else if (!aboveRight) gid = INNER_TR;
				else if (!belowLeft) gid = INNER_BL;
				else if (!belowRight) gid = INNER_BR;
				else gid = FILL; // Fully interior
			}

			// Narrow horizontal (top and bottom exposed)
			else if (!above && !below && left && right) {
				gid = LEDGE;
			}

			// Narrow vertical (left and right exposed)
			else if (above && below && !left && !right) {
				gid = WALL_VERT;
			}

			// Single tile (all sides exposed)
			else if (!above && !below && !left && !right) {
				gid = DECO_SMALL;
			}

			// Endcaps
			else if (!above && below && !left && !right) {
				gid = TOP; // Column top
			} else if (above && !below && !left && !right) {
				gid = BOTTOM; // Column bottom
			} else if (!above && !below && left && !right) {
				gid = PLATFORM_R; // Right endcap
			} else if (!above && !below && !left && right) {
				gid = PLATFORM_L; // Left endcap
			}

			data[y * width + x] = gid;
		}
	}

	return data;
}

/**
 * Fill background layer: BG tile everywhere except where solid.
 */
function backgroundLayer(solid, width, height) {
	const data = new Array(width * height).fill(0);
	for (let i = 0; i < width * height; i++) {
		data[i] = solid[i] ? 0 : BG;
	}
	return data;
}

// === Level definitions ===

/**
 * Parse a text-art level description.
 *
 * Legend:
 *   # = solid ground
 *   . = air (background)
 *   P = player start (on air)
 *   C = coin (on air)
 *   S = patrol enemy (on air, spawns on ground below)
 *   B = bat/flying enemy (on air)
 *   H = health pickup (on air)
 *   E = level exit (on air)
 *   T = tree decoration (on air)
 *   = (space) = air
 */
function parseLevel(text) {
	const lines = text.split("\n").filter((l) => l.length > 0);
	const height = lines.length;
	const width = Math.max(...lines.map((l) => l.length));

	const solid = new Array(width * height).fill(false);
	const objects = [];

	for (let y = 0; y < height; y++) {
		const line = lines[y];
		for (let x = 0; x < width; x++) {
			const ch = x < line.length ? line[x] : ".";
			const idx = y * width + x;

			switch (ch) {
				case "#":
					solid[idx] = true;
					break;
				case "P":
					objects.push({
						name: "player_start",
						type: "Player",
						x: x * 8 + 4,
						y: y * 8 + 4,
					});
					break;
				case "C":
					objects.push({
						name: "coin",
						type: "Coin",
						x: x * 8 + 4,
						y: y * 8 + 4,
					});
					break;
				case "S":
					objects.push({
						name: "patrol_enemy",
						type: "PatrolEnemy",
						x: x * 8 + 4,
						y: y * 8 + 4,
					});
					break;
				case "B":
					objects.push({
						name: "flying_enemy",
						type: "FlyingEnemy",
						x: x * 8 + 4,
						y: y * 8 + 4,
					});
					break;
				case "H":
					objects.push({
						name: "health_pickup",
						type: "HealthPickup",
						x: x * 8 + 4,
						y: y * 8 + 4,
					});
					break;
				case "E":
					objects.push({
						name: "exit",
						type: "LevelExit",
						x: x * 8 + 4,
						y: y * 8 + 4,
					});
					break;
				// T, space, . = air (no action)
			}
		}
	}

	return { solid, objects, width, height };
}

/**
 * Build a Tiled-compatible JSON map from parsed level data.
 */
function buildTiledJSON(level) {
	const { solid, objects, width, height } = level;

	const groundData = autotile(solid, width, height);
	const bgData = backgroundLayer(solid, width, height);

	return {
		compressionlevel: -1,
		height,
		infinite: false,
		layers: [
			{
				data: bgData,
				height,
				id: 1,
				name: "background",
				opacity: 1,
				type: "tilelayer",
				visible: true,
				width,
				x: 0,
				y: 0,
			},
			{
				data: groundData,
				height,
				id: 2,
				name: "ground",
				opacity: 1,
				type: "tilelayer",
				visible: true,
				width,
				x: 0,
				y: 0,
			},
			{
				draworder: "topdown",
				id: 3,
				name: "entities",
				objects: objects.map((obj, i) => ({
					height: 0,
					id: i + 1,
					name: obj.name,
					point: true,
					rotation: 0,
					type: obj.type,
					visible: true,
					width: 0,
					x: obj.x,
					y: obj.y,
				})),
				opacity: 1,
				type: "objectgroup",
				visible: true,
				x: 0,
				y: 0,
			},
		],
		nextlayerid: 4,
		nextobjectid: objects.length + 1,
		orientation: "orthogonal",
		renderorder: "right-down",
		tiledversion: "1.10.2",
		tileheight: 8,
		tilesets: [
			{
				columns: 15,
				firstgid: 1,
				image: "tileset.png",
				imageheight: 80,
				imagewidth: 120,
				margin: 0,
				name: "kenney-pico8",
				spacing: 0,
				tilecount: 150,
				tileheight: 8,
				tilewidth: 8,
			},
		],
		tilewidth: 8,
		type: "map",
		version: "1.10",
		width,
	};
}

// ============================================================
// Level 1: "Green Hills" — Tutorial
// 100 columns × 30 rows = 800 × 240 pixels
// ============================================================

const LEVEL_1_ART = `
......................................................................................................
......................................................................................................
......................................................................................................
......................................................................................................
......................................................................................................
......................................................................................................
......................................................................................................
......................................................................................................
......................................................................................................
......................................................................................................
......................................................................................................
......................................................................................................
..............C.C.C.........................C...........................C..C..C.........................
..............#####.....................C...####.............................######...........C..........
...................................S...####.....................................C.........########.......
...........C...............................................................................................
..........####.....................................C..C.............................C.C..................
.....P.........................................########....................C........#####.......E........
.......................S...........................................................C.........########...
..##########.....##########...####.................C.......####.....C...######........................##
......................................................................................................
......................................................................................................
..................................................####.....####.......................................
......................................................................................................
......................................................................................................
######################################..######..####################################################
######################################..######..####################################################
######################################..######..####################################################
######################################..######..####################################################
######################################..######..####################################################
`.trim();

// ============================================================
// Level 2: "Cave Depths" — Challenge
// 140 columns × 30 rows = 1120 × 240 pixels
// ============================================================

const LEVEL_2_ART = `
............................................................................................................................................
............................................................................................................................................
............................................................................................................................................
............................................................................................................................................
............................................................................................................................................
............................................................................................................................................
............................................................................................................................................
............................................................................................................................................
....................B.......................................................B........................................
.......C.C......................C.C..................................C.C............C.C...........................
.......#####.................########...............................######..........#####...C.C.C.................
.................................................................................................#######..........
.....P...............S................C....C.....C.........................................C..C.................E..
.............................................##########.................C........####..........########....########.
.......................S.............................................######.......................................
..#########.....###########....####...................####......................................C.C................
...........................................................................................########..............
...............................................................................................C.................
..............................................................C.....................................................
.............................................####.......####..####.........H......................................
............................................................................................................................................
.........................................####....................................................................
............................................................................................................................................
............................................................................S.................S..................
............................................................................................................................................
##############################################..########..######################################################
##############################################..########..######################################################
##############################################..########..######################################################
##############################################..########..######################################################
##############################################..########..######################################################
`.trim();

// === Generate and write ===

function generateLevel(art, filename) {
	const level = parseLevel(art);
	const json = buildTiledJSON(level);
	const path = join(ASSETS_DIR, filename);
	writeFileSync(path, JSON.stringify(json, null, 2));
	console.log(
		`Generated ${filename}: ${level.width}×${level.height} tiles, ${level.objects.length} entities`,
	);
}

generateLevel(LEVEL_1_ART, "level1.json");
generateLevel(LEVEL_2_ART, "level2.json");

console.log("Done! Assets written to examples/platformer/assets/");
