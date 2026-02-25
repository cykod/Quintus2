#!/usr/bin/env node
/**
 * Build script: Creates a particle spritesheet from Kenney smoke-particles.
 * Resizes flash (550x496) and explosion (583x536) frames to game-appropriate sizes,
 * then packs them into a single grid spritesheet with XML atlas.
 *
 * Layout: 9 columns x 2 rows (all 64x64 cells)
 *   Row 0: flash frames 0–8 (scaled to ~32x32, centered in 64x64 cell)
 *   Row 1: explosion frames 0–8 (scaled to fit 64x64)
 *
 * Run: node build-particles.mjs
 * Requires: npm install sharp (in /tmp or globally)
 */

import { readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";

// Load sharp from /tmp where we installed it
const require = createRequire("/tmp/node_modules/");
const sharp = require("sharp");

const FLASH_DIR = "/workspaces/Quintus/tmp/kenney_smoke-particles/PNG/Flash";
const EXPLOSION_DIR = "/workspaces/Quintus/tmp/kenney_smoke-particles/PNG/Explosion";
const OUT_DIR = "/workspaces/Quintus/examples/space-shooter/assets";
const FRAME_SIZE = 64;
const COLS = 9;
const ROWS = 2;
const SHEET_W = COLS * FRAME_SIZE;
const SHEET_H = ROWS * FRAME_SIZE;

const flashFiles = readdirSync(FLASH_DIR).filter(f => f.endsWith(".png")).sort();
const explosionFiles = readdirSync(EXPLOSION_DIR).filter(f => f.endsWith(".png")).sort();

console.log(`Flash: ${flashFiles.length} frames, Explosion: ${explosionFiles.length} frames`);

async function main() {
	const composites = [];

	// Flash frames → row 0, resized to 32x32 then centered in 64x64 cell
	for (let i = 0; i < flashFiles.length; i++) {
		const src = join(FLASH_DIR, flashFiles[i]);
		const resized = await sharp(src)
			.resize(32, 32, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
			.extend({
				top: 16, bottom: 16, left: 16, right: 16,
				background: { r: 0, g: 0, b: 0, alpha: 0 },
			})
			.png()
			.toBuffer();

		composites.push({
			input: resized,
			left: i * FRAME_SIZE,
			top: 0,
		});
	}

	// Explosion frames → row 1, resized to 64x64
	for (let i = 0; i < explosionFiles.length; i++) {
		const src = join(EXPLOSION_DIR, explosionFiles[i]);
		const resized = await sharp(src)
			.resize(FRAME_SIZE, FRAME_SIZE, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
			.png()
			.toBuffer();

		composites.push({
			input: resized,
			left: i * FRAME_SIZE,
			top: FRAME_SIZE,
		});
	}

	// Create transparent base and composite all frames
	await sharp({
		create: {
			width: SHEET_W,
			height: SHEET_H,
			channels: 4,
			background: { r: 0, g: 0, b: 0, alpha: 0 },
		},
	})
		.composite(composites)
		.png()
		.toFile(join(OUT_DIR, "particles.png"));

	console.log(`Created particles.png (${SHEET_W}x${SHEET_H})`);

	// Generate XML atlas
	const xml = ['<TextureAtlas imagePath="particles.png">'];
	for (let i = 0; i < 9; i++) {
		xml.push(`\t<SubTexture name="flash${String(i).padStart(2, "0")}.png" x="${i * FRAME_SIZE}" y="0" width="${FRAME_SIZE}" height="${FRAME_SIZE}"/>`);
	}
	for (let i = 0; i < 9; i++) {
		xml.push(`\t<SubTexture name="explosion${String(i).padStart(2, "0")}.png" x="${i * FRAME_SIZE}" y="${FRAME_SIZE}" width="${FRAME_SIZE}" height="${FRAME_SIZE}"/>`);
	}
	xml.push("</TextureAtlas>");
	writeFileSync(join(OUT_DIR, "particles.xml"), xml.join("\n") + "\n");
	console.log("Created particles.xml");
}

main().catch(console.error);
