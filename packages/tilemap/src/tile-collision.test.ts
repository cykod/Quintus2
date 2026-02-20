import { Game, Node2D, Scene } from "@quintus/core";
import { CollisionShape, PhysicsPlugin, Shape, StaticCollider } from "@quintus/physics";
import { describe, expect, it } from "vitest";
import { buildSolidGrid, createColliders, getSolidTileIds, mergeRects } from "./tile-collision.js";
import type { ParsedTileLayer } from "./tiled-parser.js";

function makeSolidGrid(pattern: string[]): { solid: boolean[]; width: number; height: number } {
	const height = pattern.length;
	const width = pattern[0]?.length ?? 0;
	const solid: boolean[] = [];
	for (const row of pattern) {
		for (const ch of row) {
			solid.push(ch === "X");
		}
	}
	return { solid, width, height };
}

describe("mergeRects", () => {
	it("merges a single solid tile into one rect", () => {
		const { solid, width, height } = makeSolidGrid(["X"]);
		const rects = mergeRects(solid, width, height);
		expect(rects).toHaveLength(1);
		expect(rects[0]).toEqual({ col: 0, row: 0, spanW: 1, spanH: 1 });
	});

	it("merges a full grid into one rect", () => {
		const { solid, width, height } = makeSolidGrid(["XXX", "XXX", "XXX"]);
		const rects = mergeRects(solid, width, height);
		expect(rects).toHaveLength(1);
		expect(rects[0]).toEqual({ col: 0, row: 0, spanW: 3, spanH: 3 });
	});

	it("returns empty array for empty grid", () => {
		const { solid, width, height } = makeSolidGrid(["...", "...", "..."]);
		const rects = mergeRects(solid, width, height);
		expect(rects).toHaveLength(0);
	});

	it("merges L-shape into 2 rects", () => {
		const { solid, width, height } = makeSolidGrid(["XXXX.", "XXXX.", "..XX.", "..XX."]);
		const rects = mergeRects(solid, width, height);
		expect(rects).toHaveLength(2);
		// First rect: top 4×2
		expect(rects[0]).toEqual({ col: 0, row: 0, spanW: 4, spanH: 2 });
		// Second rect: bottom-right 2×2
		expect(rects[1]).toEqual({ col: 2, row: 2, spanW: 2, spanH: 2 });
	});

	it("handles scattered single tiles", () => {
		const { solid, width, height } = makeSolidGrid(["X.X", "...", "X.X"]);
		const rects = mergeRects(solid, width, height);
		expect(rects).toHaveLength(4);
	});

	it("handles checkerboard pattern", () => {
		const { solid, width, height } = makeSolidGrid(["X.X.", ".X.X", "X.X.", ".X.X"]);
		const rects = mergeRects(solid, width, height);
		expect(rects).toHaveLength(8); // Each tile is its own rect
	});

	it("merges horizontal strip", () => {
		const { solid, width, height } = makeSolidGrid(["XXXXX"]);
		const rects = mergeRects(solid, width, height);
		expect(rects).toHaveLength(1);
		expect(rects[0]).toEqual({ col: 0, row: 0, spanW: 5, spanH: 1 });
	});

	it("merges vertical strip", () => {
		const { solid, width, height } = makeSolidGrid(["X", "X", "X", "X"]);
		const rects = mergeRects(solid, width, height);
		expect(rects).toHaveLength(1);
		expect(rects[0]).toEqual({ col: 0, row: 0, spanW: 1, spanH: 4 });
	});
});

describe("buildSolidGrid", () => {
	it("treats all non-empty tiles as solid when solidTileIds is null", () => {
		const layer: ParsedTileLayer = {
			name: "ground",
			tiles: [
				{ localId: 0, tileset: {} as never, flipH: false, flipV: false, flipD: false },
				null,
				{ localId: 5, tileset: {} as never, flipH: false, flipV: false, flipD: false },
			],
			width: 3,
			height: 1,
			visible: true,
			opacity: 1,
			offsetX: 0,
			offsetY: 0,
			properties: new Map(),
		};
		const solid = buildSolidGrid(layer, null);
		expect(solid).toEqual([true, false, true]);
	});

	it("uses solidTileIds set for filtering", () => {
		const layer: ParsedTileLayer = {
			name: "ground",
			tiles: [
				{ localId: 0, tileset: {} as never, flipH: false, flipV: false, flipD: false },
				{ localId: 1, tileset: {} as never, flipH: false, flipV: false, flipD: false },
				{ localId: 2, tileset: {} as never, flipH: false, flipV: false, flipD: false },
			],
			width: 3,
			height: 1,
			visible: true,
			opacity: 1,
			offsetX: 0,
			offsetY: 0,
			properties: new Map(),
		};
		const solidIds = new Set([0, 2]);
		const solid = buildSolidGrid(layer, solidIds);
		expect(solid).toEqual([true, false, true]);
	});

	it("excludes tiles in excludeTileIds when allSolid", () => {
		const layer: ParsedTileLayer = {
			name: "tiles",
			tiles: [
				{ localId: 10, tileset: {} as never, flipH: false, flipV: false, flipD: false },
				{ localId: 55, tileset: {} as never, flipH: false, flipV: false, flipD: false },
				{ localId: 20, tileset: {} as never, flipH: false, flipV: false, flipD: false },
				null,
				{ localId: 56, tileset: {} as never, flipH: false, flipV: false, flipD: false },
			],
			width: 5,
			height: 1,
			visible: true,
			opacity: 1,
			offsetX: 0,
			offsetY: 0,
			properties: new Map(),
		};
		const solid = buildSolidGrid(layer, null, new Set([55, 56]));
		expect(solid).toEqual([true, false, true, false, false]);
	});

	it("excludes tiles in excludeTileIds when using solidTileIds", () => {
		const layer: ParsedTileLayer = {
			name: "tiles",
			tiles: [
				{ localId: 10, tileset: {} as never, flipH: false, flipV: false, flipD: false },
				{ localId: 55, tileset: {} as never, flipH: false, flipV: false, flipD: false },
				{ localId: 20, tileset: {} as never, flipH: false, flipV: false, flipD: false },
			],
			width: 3,
			height: 1,
			visible: true,
			opacity: 1,
			offsetX: 0,
			offsetY: 0,
			properties: new Map(),
		};
		const solidIds = new Set([10, 55, 20]);
		const solid = buildSolidGrid(layer, solidIds, new Set([55]));
		expect(solid).toEqual([true, false, true]);
	});
});

describe("getSolidTileIds", () => {
	it("extracts tile IDs with solid: true property", () => {
		const tilesets = [
			{
				firstgid: 1,
				name: "terrain",
				tilewidth: 16,
				tileheight: 16,
				image: "tiles.png",
				imagewidth: 160,
				imageheight: 160,
				columns: 10,
				tilecount: 100,
				tiles: [
					{
						id: 0,
						properties: [{ name: "solid", type: "bool" as const, value: true }],
					},
					{
						id: 5,
						properties: [{ name: "solid", type: "bool" as const, value: true }],
					},
					{
						id: 10,
						properties: [{ name: "decoration", type: "bool" as const, value: true }],
					},
				],
			},
		];
		const solidIds = getSolidTileIds(tilesets);
		expect(solidIds.has(0)).toBe(true);
		expect(solidIds.has(5)).toBe(true);
		expect(solidIds.has(10)).toBe(false);
	});
});

describe("createColliders", () => {
	const factories = {
		StaticCollider: StaticCollider as never,
		CollisionShape: CollisionShape as never,
		shapeRect: Shape.rect,
	};

	it("creates StaticCollider nodes from merged rects", () => {
		const game = new Game({
			width: 320,
			height: 240,
			canvas: document.createElement("canvas"),
			renderer: null,
		});
		game.use(
			PhysicsPlugin({
				collisionGroups: {
					default: { collidesWith: ["default"] },
					world: { collidesWith: ["default"] },
				},
			}),
		);

		let parent: Node2D | undefined;
		class TestScene extends Scene {
			onReady() {
				parent = this.add(Node2D);
			}
		}
		game.start(TestScene);

		const rects = [
			{ col: 0, row: 0, spanW: 4, spanH: 2 },
			{ col: 2, row: 2, spanW: 2, spanH: 2 },
		];

		// biome-ignore lint/style/noNonNullAssertion: test setup guarantees parent
		const colliders = createColliders(rects, 16, 16, "world", parent!, factories);
		expect(colliders).toHaveLength(2);

		// First collider: 4×2 tiles = 64×32 pixels, center at (32, 16)
		const c1 = colliders[0] as StaticCollider;
		expect(c1).toBeInstanceOf(StaticCollider);
		expect(c1.position.x).toBe(32);
		expect(c1.position.y).toBe(16);
		expect(c1.collisionGroup).toBe("world");

		const shape1 = c1.getChild(CollisionShape);
		expect(shape1).not.toBeNull();
		expect(shape1?.shape).toEqual(Shape.rect(64, 32));

		// Second collider: 2×2 tiles = 32×32 pixels, center at (48, 48)
		const c2 = colliders[1] as StaticCollider;
		expect(c2.position.x).toBe(48);
		expect(c2.position.y).toBe(48);
	});
});
