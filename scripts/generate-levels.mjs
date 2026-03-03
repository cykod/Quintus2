#!/usr/bin/env node
/**
 * Generates level1.tmx, level2.tmx, level3.tmx for the advanced platformer.
 * Run: node scripts/generate-levels.mjs
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = join(__dirname, "../examples/advanced-platformer/assets");

// ── Tile IDs (TMX global, firstgid=1 → TMX = local + 1) ─────────────────
// Interactive tiles (same across all levels)
const COIN = 35;
const GEM = 59;
const HEART = 64;
const COIN_BLOCK = 2;
const BRICK = 26;
const EXCL_BLOCK = 6;
const SPRING = 128;
const FALL_AWAY = 30;
const SPIKE = 12;
const FLAG = 53;
const DOOR = 42;
const LADDER_TOP = 102;
const LADDER_MID = 103;
const LADDER_BOT = 104;
const WATER = 311;
const LAVA = 105;
const KEY_RED = 100;
const KEY_BLUE = 98;
const KEY_GREEN = 99;
const LOCK_RED = 113;
const LOCK_BLUE = 111;
const LOCK_GREEN = 112;

// Enemy tile IDs (enemies-tileset, firstgid=325)
const SLIME = 369;
const BEE = 328;
const SNAIL = 377;
const FROG = 346;
const SAW = 356;

// Green (Level 1)
const GREEN_FILL = 175;
const GREEN_UNDER = 172;
const GREEN_PLAT_L = 184;
const GREEN_PLAT_M = 183;
const GREEN_PLAT_R = 185;

// Brown/Desert (Level 2)
const BROWN_FILL = 231;
const BROWN_UNDER = 228;
const BROWN_PLAT_L = 212;
const BROWN_PLAT_M = 211;
const BROWN_PLAT_R = 213;

// Grey/Stone (Level 3)
const GREY_FILL = 287;
const GREY_UNDER = 284;
const GREY_PLAT_L = 268;
const GREY_PLAT_M = 267;
const GREY_PLAT_R = 269;

// ── Helpers ──────────────────────────────────────────────────────────────
function emptyRow(w) {
	return new Array(w).fill(0);
}

function fillRange(row, start, end, val) {
	for (let i = start; i <= end; i++) row[i] = val;
}

function set(row, overrides) {
	for (const [col, val] of Object.entries(overrides)) {
		row[Number(col)] = val;
	}
}

function groundRow(w, fill, gaps) {
	const row = new Array(w).fill(fill);
	for (const [s, e] of gaps) fillRange(row, s, e, 0);
	return row;
}

function underRow(w, under, liquid, gaps) {
	const row = new Array(w).fill(under);
	for (const [s, e] of gaps) fillRange(row, s, e, liquid);
	return row;
}

// ── Level 1: Grasslands (100×20) ─────────────────────────────────────────
function generateLevel1() {
	const W = 100,
		H = 20;
	const F = GREEN_FILL,
		U = GREEN_UNDER;
	const gaps = [
		[19, 22],
		[56, 62],
	];

	const main = [],
		enemies = [],
		bg = [],
		fg = [];

	for (let r = 0; r < H; r++) {
		bg.push(emptyRow(W));
		fg.push(emptyRow(W));
		const m = emptyRow(W);
		const e = emptyRow(W);

		if (r === 8) {
			// Elevated breakable blocks (reachable by spring)
			set(m, { 34: BRICK, 35: EXCL_BLOCK, 36: BRICK });
		}
		if (r === 10) {
			// One-way platforms over gap 2
			set(m, { 57: GREEN_PLAT_L, 58: GREEN_PLAT_M, 59: GREEN_PLAT_R });
		}
		if (r === 11) {
			// One-way platforms over gap 1
			set(m, { 19: GREEN_PLAT_L, 20: GREEN_PLAT_M, 21: GREEN_PLAT_R });
			// Coin block
			set(m, { 43: COIN_BLOCK });
		}
		if (r === 14) {
			// Coin on cloud above gap 1
			set(m, { 20: COIN });
		}
		if (r === 15) {
			// Items row (1 tile above ground)
			set(m, {
				5: COIN,
				7: COIN,
				9: COIN,
				35: COIN,
				45: FLAG,
				58: COIN,
				65: COIN,
				67: COIN,
				70: GEM,
				75: HEART,
				80: COIN,
				82: COIN,
				84: COIN,
				90: GEM,
				97: DOOR,
			});
			e[12] = SLIME;
			e[25] = SLIME;
		}
		if (r === 9) {
			e[59] = BEE;
		}
		if (r === 16) {
			const row = groundRow(W, F, gaps);
			row[33] = SPRING;
			m.splice(0, W, ...row);
		}
		if (r === 17) {
			m.splice(0, W, ...groundRow(W, F, gaps));
		}
		if (r === 18 || r === 19) {
			m.splice(0, W, ...underRow(W, U, WATER, gaps));
		}

		main.push(m);
		enemies.push(e);
	}

	return { W, H, main, enemies, bg, fg, spawnX: 192, spawnY: 960 };
}

// ── Level 2: Desert Ruins (120×25) ───────────────────────────────────────
function generateLevel2() {
	const W = 120,
		H = 25;
	const F = BROWN_FILL,
		U = BROWN_UNDER;
	const gaps = [
		[40, 48],
		[75, 80],
	];

	const main = [],
		enemies = [],
		bg = [],
		fg = [];

	for (let r = 0; r < H; r++) {
		bg.push(emptyRow(W));
		fg.push(emptyRow(W));
		const m = emptyRow(W);
		const e = emptyRow(W);

		// ── Elevated platform at top of ladder ──
		if (r === 10) {
			fillRange(m, 20, 30, F);
			set(m, { 22: COIN, 24: COIN, 26: GEM, 28: COIN });
		}

		// ── Ladder column (rows 11-20) ──
		if (r === 11) m[20] = LADDER_BOT;
		if (r >= 12 && r <= 19) m[20] = LADDER_MID;
		if (r === 20) m[20] = LADDER_TOP;

		// ── One-way platforms over pit gap ──
		if (r === 15) {
			set(m, { 42: BROWN_PLAT_L, 43: BROWN_PLAT_M, 44: BROWN_PLAT_R });
			set(m, { 46: BROWN_PLAT_L, 47: BROWN_PLAT_M, 48: BROWN_PLAT_R });
		}

		// ── One-way platforms over second gap ──
		if (r === 16) {
			set(m, { 76: BROWN_PLAT_L, 77: BROWN_PLAT_M, 78: BROWN_PLAT_R });
		}

		// ── Fall-away platforms in pit area ──
		if (r === 19) {
			set(m, { 42: FALL_AWAY, 44: FALL_AWAY, 46: FALL_AWAY });
		}

		// ── Items row (1 tile above ground) ──
		if (r === 20) {
			set(m, {
				5: COIN,
				7: COIN,
				9: COIN,
				15: COIN,
				25: FLAG,
				35: COIN,
				37: COIN,
				55: KEY_RED,
				60: GEM,
				65: COIN,
				67: COIN,
				70: FLAG,
				85: LOCK_RED,
				90: GEM,
				95: COIN,
				97: COIN,
				100: HEART,
				105: GEM,
				110: COIN,
				112: COIN,
				117: DOOR,
			});
			e[12] = SNAIL;
			e[33] = FROG;
			e[63] = SNAIL;
			e[95] = FROG;
		}

		// ── Ground ──
		if (r === 21 || r === 22) {
			m.splice(0, W, ...groundRow(W, F, gaps));
		}
		if (r === 23 || r === 24) {
			m.splice(0, W, ...underRow(W, U, WATER, gaps));
		}

		main.push(m);
		enemies.push(e);
	}

	return { W, H, main, enemies, bg, fg, spawnX: 192, spawnY: 1280 };
}

// ── Level 3: Dark Fortress (140×30) ──────────────────────────────────────
function generateLevel3() {
	const W = 140,
		H = 30;
	const F = GREY_FILL,
		U = GREY_UNDER;
	const gaps = [
		[30, 35],
		[55, 62],
		[90, 96],
		[120, 126],
	];

	const main = [],
		enemies = [],
		bg = [],
		fg = [];

	for (let r = 0; r < H; r++) {
		bg.push(emptyRow(W));
		fg.push(emptyRow(W));
		const m = emptyRow(W);
		const e = emptyRow(W);

		// ── Upper elevated platform with blue key ──
		if (r === 12) {
			fillRange(m, 38, 50, F);
			set(m, { 40: COIN, 42: COIN, 44: KEY_BLUE, 46: COIN, 48: GEM });
		}

		// ── Green key elevated platform ──
		if (r === 14) {
			fillRange(m, 82, 92, F);
			set(m, { 84: COIN, 86: KEY_GREEN, 88: COIN, 90: GEM });
		}

		// ── Mid-level platforms over gaps ──
		if (r === 18) {
			// Over gap 1
			set(m, { 31: GREY_PLAT_L, 32: GREY_PLAT_M, 33: GREY_PLAT_R });
			// Over gap 2
			set(m, { 57: GREY_PLAT_L, 58: GREY_PLAT_M, 59: GREY_PLAT_R });
		}
		if (r === 19) {
			// Extended cloud over gap 2
			set(m, { 60: GREY_PLAT_L, 61: GREY_PLAT_M, 62: GREY_PLAT_R });
		}
		if (r === 20) {
			// Over gap 3
			set(m, { 91: GREY_PLAT_L, 92: GREY_PLAT_M, 93: GREY_PLAT_R });
			// Over gap 4
			set(m, { 121: GREY_PLAT_L, 122: GREY_PLAT_M, 123: GREY_PLAT_R });
		}

		// ── Ladder from ground up to blue key platform (col 38) ──
		if (r === 13) m[38] = LADDER_BOT;
		if (r >= 14 && r <= 24) m[38] = LADDER_MID;
		if (r === 25) m[38] = LADDER_TOP;

		// ── Items row (1 tile above ground) ──
		if (r === 25) {
			set(m, {
				5: COIN,
				7: COIN,
				9: COIN,
				15: COIN,
				17: COIN,
				22: FLAG,
				28: COIN,
				42: COIN,
				50: LOCK_BLUE,
				53: COIN,
				68: FLAG,
				72: GEM,
				74: COIN,
				80: COIN,
				98: LOCK_GREEN,
				102: COIN,
				104: GEM,
				110: FLAG,
				115: HEART,
				130: COIN,
				132: GEM,
				137: DOOR,
			});
			// Spikes near gap edges
			set(m, { 29: SPIKE, 54: SPIKE, 89: SPIKE, 119: SPIKE });
			// Enemies
			e[12] = SLIME;
			e[20] = SLIME;
			e[65] = SNAIL;
			e[78] = FROG;
			e[105] = SAW;
			e[130] = SLIME;
		}
		// Flying enemies
		if (r === 18) {
			e[45] = BEE;
			e[115] = BEE;
		}

		// ── Ground rows ──
		if (r === 26 || r === 27) {
			m.splice(0, W, ...groundRow(W, F, gaps));
		}
		if (r === 28 || r === 29) {
			m.splice(0, W, ...underRow(W, U, LAVA, gaps));
		}

		main.push(m);
		enemies.push(e);
	}

	return { W, H, main, enemies, bg, fg, spawnX: 192, spawnY: 1600 };
}

// ── TMX Writer ───────────────────────────────────────────────────────────
function toCSV(layers) {
	return layers.map((row) => row.join(",")).join(",\n");
}

function writeTMX(filename, data) {
	const { W, H, main, enemies, bg, fg, spawnX, spawnY } = data;

	const tmx = `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" tiledversion="1.11.2" orientation="orthogonal" renderorder="right-down" width="${W}" height="${H}" tilewidth="64" tileheight="64" infinite="0" nextlayerid="6" nextobjectid="2">
 <tileset firstgid="1" source="tileset.tsx"/>
 <tileset firstgid="325" source="enemies-tileset.tsx"/>
 <layer id="1" name="background" width="${W}" height="${H}">
  <data encoding="csv">
${toCSV(bg)}
</data>
 </layer>
 <layer id="2" name="main" width="${W}" height="${H}">
  <data encoding="csv">
${toCSV(main)}
</data>
 </layer>
 <layer id="5" name="enemies" width="${W}" height="${H}">
  <data encoding="csv">
${toCSV(enemies)}
</data>
 </layer>
 <layer id="3" name="foreground" width="${W}" height="${H}">
  <data encoding="csv">
${toCSV(fg)}
</data>
 </layer>
 <objectgroup id="4" name="entities">
  <object id="1" name="player_start" x="${spawnX}" y="${spawnY}" width="64" height="64"/>
 </objectgroup>
</map>
`;

	const filepath = join(ASSETS_DIR, filename);
	writeFileSync(filepath, tmx);
	console.log(`Written ${filepath}`);
}

// ── Generate all levels ──────────────────────────────────────────────────
writeTMX("level1.tmx", generateLevel1());
writeTMX("level2.tmx", generateLevel2());
writeTMX("level3.tmx", generateLevel3());

console.log("Done! All 3 level TMX files generated.");
