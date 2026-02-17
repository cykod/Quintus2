# Tiled TMX/TSX Native Support — Detailed Design

> **Goal:** Add first-class support for reading and writing Tiled `.tmx`/`.tsx` (XML) files alongside the existing `.tmj`/`.tsj` (JSON) support, so levels can be authored in Tiled and round-tripped without data loss.
> **Outcome:** `TileMap` loads `.tmx` files transparently. A `TiledWriter` can serialize the internal representation back to `.tmx`/`.tsx`. The Quintus level editor (future) will interoperate with Tiled via this shared format.

## Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | TMX/TSX XML parser (read) | Pending |
| 2 | Base64 + compression decoding | Pending |
| 3 | TMX writer (export) | Pending |
| 4 | Asset loader integration | Pending |
| 5 | Round-trip tests + Tiled compatibility | Pending |
| 6 | Extended features (group layers, image layers, templates) | Pending |

---

## Background: Tiled File Formats

Tiled supports four file extensions across two serialization formats:

| Extension | Format | Purpose |
|-----------|--------|---------|
| `.tmx` | XML | Map files |
| `.tsx` | XML | External tileset files |
| `.tmj` | JSON | Map files (since Tiled 1.0) |
| `.tsj` | JSON | External tileset files |

Both formats are **feature-equivalent** — they represent identical data. The existing `@quintus/tilemap` package supports JSON only. This design adds XML support and write capability for both.

### Why Support TMX (XML) in Addition to JSON?

1. **TMX is Tiled's native save format** — JSON requires "Export As", creating friction
2. **Wider ecosystem** — C/C++, Java, Python tools all expect TMX
3. **Better VCS diffs** — XML with one-tile-per-line diffs cleanly
4. **Future Quintus editor** — must interoperate with Tiled, TMX is the canonical format
5. **Zero-config workflow** — users save in Tiled, load in Quintus, no export step

### TMX Format Quick Reference

```xml
<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" orientation="orthogonal" renderorder="right-down"
     width="100" height="50" tilewidth="16" tileheight="16" infinite="0">

  <tileset firstgid="1" source="terrain.tsx"/>

  <layer id="1" name="ground" width="100" height="50">
    <data encoding="csv">
      1,2,3,0,0,5,6,7,...
    </data>
  </layer>

  <objectgroup id="2" name="entities">
    <object id="1" name="player_start" type="Player" x="100" y="400">
      <point/>
    </object>
    <object id="2" name="coin1" type="Coin" x="200" y="300" width="16" height="16"/>
  </objectgroup>
</map>
```

### TSX Format Quick Reference

```xml
<?xml version="1.0" encoding="UTF-8"?>
<tileset name="terrain" tilewidth="16" tileheight="16"
         tilecount="256" columns="16" spacing="0" margin="0">
  <image source="terrain.png" width="256" height="256"/>

  <tile id="15" type="Water">
    <objectgroup draworder="index">
      <object id="1" x="0" y="0" width="16" height="16"/>
    </objectgroup>
    <animation>
      <frame tileid="15" duration="200"/>
      <frame tileid="16" duration="200"/>
    </animation>
  </tile>
</tileset>
```

### GID Encoding (Flip Flags)

The upper 4 bits of a 32-bit GID store transformation flags:

```
Bit 32 (0x80000000) = Flipped Horizontally
Bit 31 (0x40000000) = Flipped Vertically
Bit 30 (0x20000000) = Flipped Diagonally (anti-diagonal; rotation)
Bit 29 (0x10000000) = Rotated 120 degrees (hexagonal only)
```

These are already handled by the existing `TILE_GID_MASK = 0x1fffffff` in `tiled-types.ts`.

### Data Encoding Options

| Encoding | Compression | Description |
|----------|-------------|-------------|
| `csv` | — | Comma-separated GID values (most common) |
| `base64` | — | Base64-encoded little-endian uint32 array |
| `base64` | `zlib` | Base64 + zlib compressed |
| `base64` | `gzip` | Base64 + gzip compressed |
| `base64` | `zstd` | Base64 + Zstandard (rare, skip for now) |

---

## Architecture

### Design Principle: Single Internal Representation

Both TMX (XML) and TMJ (JSON) parse into the **same** `ParsedMap` / `TiledMap` types. The `TileMap` class doesn't know or care which format was used. This means:

```
                    ┌─────────────────┐
  .tmx ──parse──►   │                 │
                    │   TiledMap       │   ──parseTiledMap()──►  ParsedMap
  .tmj ──parse──►   │   (shared type) │
                    └─────────────────┘
                            │
                    ┌───────┴───────┐
                    ▼               ▼
              writeTmx()      writeTmj()
                    │               │
                 .tmx file      .tmj file
```

### File Structure (New/Modified)

```
packages/tilemap/src/
├── index.ts                    # Add new exports
├── tiled-types.ts              # MODIFY: add animation, group layer, image layer types
├── tiled-parser.ts             # MODIFY: handle group/image layers in ParsedMap
├── tmx-parser.ts               # NEW: TMX XML → TiledMap
├── tmx-parser.test.ts          # NEW: TMX parsing tests
├── tsx-parser.ts               # NEW: TSX XML → TiledTileset
├── tsx-parser.test.ts          # NEW: TSX parsing tests
├── tmx-writer.ts               # NEW: TiledMap → TMX XML string
├── tmx-writer.test.ts          # NEW: TMX writing tests
├── tile-data-codec.ts          # NEW: base64/CSV encode/decode + zlib/gzip
├── tile-data-codec.test.ts     # NEW: codec tests
├── tilemap.ts                  # MODIFY: detect format, load .tmx transparently
└── tile-collision.ts           # NO CHANGE (operates on ParsedMap)
```

---

## Phase 1: TMX/TSX XML Parser (Read)

Parse `.tmx` and `.tsx` XML into the existing `TiledMap` / `TiledTileset` interfaces, so the downstream `parseTiledMap()` pipeline works unchanged.

### 1.0 Prerequisite Type Changes to `tiled-types.ts`

Before implementing the parser, these types must be added/modified so the parser output is correctly typed:

```typescript
// --- Add to TiledObject ---
/** Polyline vertices (relative to x, y). */
polyline?: Array<{ x: number; y: number }>;
/** Global tile ID (for tile objects placed in object layers). */
gid?: number;

// --- Add to TiledTileLayer and TiledObjectGroup ---
/** Tiled layer ID (for round-trip fidelity). */
id?: number;

// --- Add to TiledObjectGroup ---
/** Pixel offsets for parallax/decoration. */
offsetx?: number;
offsety?: number;
opacity?: number;

// --- Add to TiledTileset ---
/** Path to external .tsx file (if loaded externally). */
source?: string;

// --- Add to TiledTileDefinition ---
/** Tile type/class string (e.g. "Water", "Solid"). */
type?: string;
/** Animation frames for animated tiles. */
animation?: TiledAnimationFrame[];

// --- New interface ---
/** Tile animation frame. */
export interface TiledAnimationFrame {
	/** Local tile ID to display. */
	tileid: number;
	/** Frame duration in milliseconds. */
	duration: number;
}
```

These must land in Phase 1 (not Phase 6) because the TMX/TSX parser produces data for all of these fields. Without them the parser output would silently drop data or fail to compile. `ParsedObject` in `tiled-parser.ts` must also be updated to include `polyline` and `gid`, and `parseObjectLayer` must map them through.

### 1.1 XML Parsing Strategy

**Browser:** Use the built-in `DOMParser` (zero dependencies).
**Node.js / Vitest (jsdom):** jsdom includes `DOMParser` — no extra dependency needed.

```typescript
function parseXml(xml: string): Document {
	const parser = new DOMParser();
	const doc = parser.parseFromString(xml, "text/xml");
	const err = doc.querySelector("parsererror");
	if (err) {
		throw new Error(`TMX parse error: ${err.textContent}`);
	}
	return doc;
}
```

### 1.2 `tmx-parser.ts` — TMX → TiledMap

```typescript
// packages/tilemap/src/tmx-parser.ts

/**
 * Parse a TMX XML string into a TiledMap object (same shape as Tiled JSON).
 * External tilesets (.tsx) must be resolved separately via parseTsx().
 *
 * @param xml The TMX file content as a string.
 * @param resolveTileset Callback to load external .tsx files by path.
 *        Returns the parsed TiledTileset (without firstgid, which comes from the TMX).
 * @returns TiledMap object compatible with parseTiledMap().
 */
export function parseTmx(
	xml: string,
	resolveTileset?: (source: string) => Omit<TiledTileset, "firstgid">,
): TiledMap;
```

The `resolveTileset` callback returns a tileset **without** `firstgid` (matching `parseTsx()` output). The `parseTmx` function reads `firstgid` from the `<tileset>` element in the TMX and merges it internally. If a TMX references an external tileset but no `resolveTileset` callback is provided, `parseTmx` must throw: `"External tileset 'terrain.tsx' referenced but no resolveTileset callback provided."`

**Parsing logic:**

1. Parse XML via `DOMParser`
2. Read `<map>` attributes → `TiledMap` fields
3. For each `<tileset>`:
   - If `source` attribute present: call `resolveTileset(source)` and merge with `firstgid`
   - If inline: parse `<tileset>` element directly
4. For each `<layer>`: parse `<data>` element (CSV or base64) → `number[]`
5. For each `<objectgroup>`: parse `<object>` elements → `TiledObject[]`
6. For each `<group>`: flatten recursively (see Phase 6 for proper group support)
7. Parse `<properties>` on all elements → `TiledProperty[]`

**Key helper — XML attribute extraction:**

```typescript
/** Read a required attribute, throw if missing. */
function reqAttr(el: Element, name: string): string {
	const val = el.getAttribute(name);
	if (val === null) throw new Error(`Missing required attribute '${name}' on <${el.tagName}>`);
	return val;
}

/** Read an optional attribute with a typed default. */
function optInt(el: Element, name: string, def: number): number {
	const val = el.getAttribute(name);
	return val !== null ? Number.parseInt(val, 10) : def;
}

function optFloat(el: Element, name: string, def: number): number {
	const val = el.getAttribute(name);
	return val !== null ? Number.parseFloat(val) : def;
}

function optBool(el: Element, name: string, def: boolean): boolean {
	const val = el.getAttribute(name);
	return val !== null ? val !== "0" && val !== "false" : def;
}
```

**CSV data parsing:**

CSV data in TMX is a flat list of comma-separated GIDs. Tiled outputs newlines for readability (one row per line) but the newlines are **not significant** — the data is just a single flat sequence of `width × height` values. The layer's `width` and `height` attributes determine the grid structure, not the line breaks. Trailing commas after the last row are common in some Tiled versions and must be handled.

```typescript
/**
 * Parse CSV tile data from a <data encoding="csv"> element.
 * Strips all whitespace, splits on commas, filters empty tokens
 * (handles trailing commas), and validates length.
 */
function parseCsvData(text: string, width: number, height: number): number[] {
	// Strip all whitespace (newlines, spaces, tabs) — they are not significant
	const stripped = text.replace(/\s/g, "");
	if (stripped === "") {
		// Empty data → fill with zeros matching layer dimensions
		return new Array(width * height).fill(0);
	}

	const tokens = stripped.split(",").filter((s) => s.length > 0);
	const expected = width * height;
	if (tokens.length !== expected) {
		throw new Error(
			`CSV tile data has ${tokens.length} values but layer is ${width}×${height} (expected ${expected}).`,
		);
	}

	return tokens.map((s) => {
		const n = Number.parseInt(s, 10);
		if (Number.isNaN(n)) throw new Error(`Invalid tile GID in CSV data: '${s}'`);
		return n;
	});
}
```

### 1.3 `tsx-parser.ts` — TSX → TiledTileset

```typescript
// packages/tilemap/src/tsx-parser.ts

/**
 * Parse a TSX XML string into a TiledTileset object.
 * Note: firstgid is NOT included (it's map-specific, stored in the TMX).
 */
export function parseTsx(xml: string): Omit<TiledTileset, "firstgid">;
```

Parses:
- Tileset attributes (name, tilewidth, tileheight, tilecount, columns, spacing, margin)
- `<image>` element → `image`, `imagewidth`, `imageheight`
- `<tile>` elements → `TiledTileDefinition[]` (including properties, collision shapes, animations)
- `<tileoffset>` → stored as tileset property

### 1.4 Property Parsing

```typescript
function parsePropertiesXml(el: Element): TiledProperty[] | undefined {
	const propsEl = el.querySelector(":scope > properties");
	if (!propsEl) return undefined;

	const result: TiledProperty[] = [];
	for (const prop of propsEl.querySelectorAll(":scope > property")) {
		const name = reqAttr(prop, "name");
		const type = (prop.getAttribute("type") ?? "string") as TiledProperty["type"];
		const rawValue = prop.getAttribute("value") ?? prop.textContent ?? "";

		let value: boolean | number | string;
		switch (type) {
			case "bool":
				value = rawValue === "true";
				break;
			case "int":
				value = Number.parseInt(rawValue, 10);
				break;
			case "float":
				value = Number.parseFloat(rawValue);
				break;
			case "object":
				value = Number.parseInt(rawValue, 10);
				break;
			default:
				value = rawValue;
		}

		result.push({ name, type, value });
	}
	return result.length > 0 ? result : undefined;
}
```

### 1.5 Object Parsing

```typescript
function parseObject(objEl: Element): TiledObject {
	const obj: TiledObject = {
		id: optInt(objEl, "id", 0),
		name: objEl.getAttribute("name") ?? "",
		// Tiled 1.9 renamed "type" to "class" in TMX; later versions reverted.
		// Support both: prefer "type", fall back to "class".
		type: objEl.getAttribute("type") ?? objEl.getAttribute("class") ?? "",
		x: optFloat(objEl, "x", 0),
		y: optFloat(objEl, "y", 0),
		width: optFloat(objEl, "width", 0),
		height: optFloat(objEl, "height", 0),
		rotation: optFloat(objEl, "rotation", 0),
		visible: optBool(objEl, "visible", true),
		properties: parsePropertiesXml(objEl),
	};

	// Tile object: an object that references a tile via its GID
	const gidAttr = objEl.getAttribute("gid");
	if (gidAttr !== null) {
		obj.gid = Number.parseInt(gidAttr, 10);
	}

	// Shape detection via child elements
	if (objEl.querySelector(":scope > point")) {
		obj.point = true;
	}
	if (objEl.querySelector(":scope > ellipse")) {
		obj.ellipse = true;
	}
	const polygonEl = objEl.querySelector(":scope > polygon");
	if (polygonEl) {
		obj.polygon = parsePoints(reqAttr(polygonEl, "points"));
	}
	const polylineEl = objEl.querySelector(":scope > polyline");
	if (polylineEl) {
		obj.polyline = parsePoints(reqAttr(polylineEl, "points"));
	}

	return obj;
}

function parsePoints(pointsStr: string): Array<{ x: number; y: number }> {
	return pointsStr
		.trim()
		.split(/\s+/)
		.map((pair) => {
			const [x, y] = pair.split(",");
			return { x: Number.parseFloat(x), y: Number.parseFloat(y) };
		});
}
```

### Deliverables

- [ ] Prerequisite type changes to `tiled-types.ts` (polyline, gid, id, source, type, animation, TiledAnimationFrame)
- [ ] Update `ParsedObject` and `parseObjectLayer` in `tiled-parser.ts` (add polyline, gid)
- [ ] `parseTmx(xml, resolveTileset?)` → `TiledMap`
- [ ] `parseTsx(xml)` → `Omit<TiledTileset, "firstgid">`
- [ ] CSV `<data>` parsing (flat comma-separated, whitespace-stripped, length-validated)
- [ ] XML `<properties>` parsing (string, int, float, bool, color, file, object)
- [ ] Object shapes: rectangle, point, ellipse, polygon, polyline
- [ ] Object `gid` for tile objects
- [ ] Tiled 1.9+ `class` → `type` attribute fallback on objects and tiles
- [ ] Per-tile collision shapes from `<tile><objectgroup>`
- [ ] Per-tile animations from `<tile><animation>`
- [ ] Layer `id` parsing on `<layer>` and `<objectgroup>` elements
- [ ] External tileset resolution via callback (error if callback missing but external tileset referenced)
- [ ] Error messages with element context (line numbers where possible)

### Tests (`tmx-parser.test.ts`, `tsx-parser.test.ts`)

**Unit: TMX parsing**
- Parse minimal valid TMX (1 layer, 1 tileset) → correct `TiledMap`
- Parse TMX with multiple tile layers → all layers present with correct data
- Parse TMX with object layer → objects have correct positions, types, properties
- Parse TMX with CSV data → `number[]` matches expected tile IDs
- Parse TMX with CSV data containing trailing comma → correct length (no spurious zero)
- Parse TMX with CSV data containing newlines/whitespace between values → parsed correctly
- CSV data length mismatch (too few/many values for width×height) → throws with counts
- Parse TMX with inline tileset → tileset fields populated
- Parse TMX with external tileset reference → `resolveTileset` called with correct path
- Parse TMX with external tileset but no `resolveTileset` callback → throws descriptive error
- Parse TMX with custom properties (all types) → correct types and values
- Parse TMX with flip flags in GIDs → flags preserved in data array
- Parse TMX with layer `id` attributes → `id` preserved on parsed layers
- Parse TMX with tile objects (`gid` attribute) → `gid` preserved on parsed objects
- Parse TMX with Tiled 1.9+ `class` attribute on objects → maps to `type` field
- Invalid TMX (missing width) → throws descriptive error
- Malformed XML → throws parsererror with context
- Empty `<data>` → tile array of `width × height` zeros
- Parse TMX with tilesets in non-firstgid order → correct GID resolution

**Unit: TSX parsing**
- Parse TSX with image → correct image source, dimensions
- Parse TSX with per-tile collision shapes → `objectgroup` populated
- Parse TSX with tile animation → `animation` array with correct frames
- Parse TSX with tile `type`/`class` attribute → `type` field populated
- Parse TSX with spacing/margin → values preserved
- Parse TSX with tile properties → per-tile properties accessible

**Integration:**
- `parseTmx()` output fed to `parseTiledMap()` → identical `ParsedMap` as JSON equivalent
- TMX with multiple tilesets → GID resolution works correctly across tileset boundaries

---

## Phase 2: Base64 + Compression Decoding

Support `<data encoding="base64">` with optional `compression="zlib|gzip"`.

### 2.1 `tile-data-codec.ts`

```typescript
// packages/tilemap/src/tile-data-codec.ts

/**
 * Decode tile layer data from various Tiled encodings.
 */

/** Decode a base64 string to a Uint8Array. */
export function decodeBase64(base64: string): Uint8Array;

/**
 * Decompress a Uint8Array using the specified algorithm.
 * Uses DecompressionStream (Web Streams API) when available,
 * falls back to manual inflate for environments without it.
 */
export function decompress(
	data: Uint8Array,
	compression: "zlib" | "gzip",
): Promise<Uint8Array>;

/**
 * Synchronous decompression using pako (optional peer dep) or
 * a minimal built-in inflate for zlib/gzip.
 * Preferred for Vitest/Node.js where DecompressionStream may not exist.
 */
export function decompressSync(
	data: Uint8Array,
	compression: "zlib" | "gzip",
): Uint8Array;

/**
 * Interpret a byte array as little-endian uint32 GIDs.
 * @param bytes Raw bytes (length must be multiple of 4).
 * @returns Array of 32-bit GIDs (with flip flags in high bits).
 */
export function bytesToGids(bytes: Uint8Array): number[];

/**
 * Full decode pipeline: base64 string → GID array.
 * Handles optional compression.
 */
export function decodeTileData(
	encoded: string,
	encoding: "csv" | "base64",
	compression?: "zlib" | "gzip" | "",
): number[] | Promise<number[]>;

// === Encoding (for TMX writer) ===

/** Encode a GID array as CSV string. */
export function encodeCsv(gids: number[], width: number): string;

/** Encode a GID array as base64 (little-endian uint32). */
export function encodeBase64(gids: number[]): string;

/** Encode a GID array as compressed base64. */
export function encodeCompressedBase64(
	gids: number[],
	compression: "zlib" | "gzip",
): Promise<string>;
```

### 2.2 Base64 Decode Implementation

```typescript
export function decodeBase64(base64: string): Uint8Array {
	// Clean whitespace (TMX base64 data often has newlines)
	const clean = base64.replace(/\s/g, "");

	// Browser: atob → charCodeAt
	if (typeof atob === "function") {
		const binary = atob(clean);
		const bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) {
			bytes[i] = binary.charCodeAt(i);
		}
		return bytes;
	}

	// Node.js: Buffer
	return new Uint8Array(Buffer.from(clean, "base64"));
}
```

### 2.3 Decompression Strategy

**Preferred: `DecompressionStream` (Web Streams API)**
- Available in Chrome 80+, Firefox 113+, Safari 16.4+, Node 18+
- Zero dependencies, standard API

```typescript
export async function decompress(
	data: Uint8Array,
	compression: "zlib" | "gzip",
): Promise<Uint8Array> {
	// DecompressionStream uses "deflate" for zlib, "gzip" for gzip
	const format = compression === "zlib" ? "deflate" : "gzip";

	if (typeof DecompressionStream !== "undefined") {
		const ds = new DecompressionStream(format);
		const writer = ds.writable.getWriter();
		const reader = ds.readable.getReader();

		writer.write(data);
		writer.close();

		const chunks: Uint8Array[] = [];
		let done = false;
		while (!done) {
			const result = await reader.read();
			if (result.value) chunks.push(result.value);
			done = result.done;
		}

		// Concatenate chunks
		const totalLen = chunks.reduce((sum, c) => sum + c.length, 0);
		const out = new Uint8Array(totalLen);
		let offset = 0;
		for (const chunk of chunks) {
			out.set(chunk, offset);
			offset += chunk.length;
		}
		return out;
	}

	// Node.js fallback: use zlib module
	if (typeof globalThis.process !== "undefined") {
		const zlib = await import("node:zlib");
		const { promisify } = await import("node:util");
		const fn = compression === "zlib" ? zlib.inflate : zlib.gunzip;
		const result = await promisify(fn)(Buffer.from(data));
		return new Uint8Array(result);
	}

	throw new Error(
		`No decompression available for '${compression}'. ` +
		`DecompressionStream API not found and not running in Node.js.`,
	);
}
```

### 2.4 Bytes to GIDs

```typescript
export function bytesToGids(bytes: Uint8Array): number[] {
	if (bytes.length % 4 !== 0) {
		throw new Error(
			`Tile data byte length ${bytes.length} is not a multiple of 4.`,
		);
	}

	const count = bytes.length / 4;
	const gids = new Array<number>(count);
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

	for (let i = 0; i < count; i++) {
		// Read as unsigned 32-bit little-endian
		// Use bitwise OR with 0 to handle the sign bit correctly for flip flags
		gids[i] = view.getUint32(i * 4, true);
	}

	return gids;
}
```

### 2.5 Updating `parseTmx` for Base64 Data

Since decompression may be async, `parseTmx` needs two variants:

```typescript
/**
 * Parse TMX synchronously. Only supports CSV-encoded data.
 * Throws if base64-compressed data is encountered.
 */
export function parseTmx(
	xml: string,
	resolveTileset?: (source: string) => Omit<TiledTileset, "firstgid">,
): TiledMap;

/**
 * Parse TMX with full encoding support (including async decompression).
 */
export async function parseTmxAsync(
	xml: string,
	resolveTileset?: (source: string) => Promise<Omit<TiledTileset, "firstgid">> | Omit<TiledTileset, "firstgid">,
): Promise<TiledMap>;
```

The sync version handles CSV (by far the most common for web). The async version handles all encodings. The `TileMap` class will use the async path when loading from assets.

### Deliverables

- [ ] `decodeBase64(base64)` → `Uint8Array`
- [ ] `decompress(data, compression)` → `Promise<Uint8Array>` (zlib + gzip)
- [ ] `bytesToGids(bytes)` → `number[]`
- [ ] `decodeTileData(encoded, encoding, compression?)` → `number[] | Promise<number[]>`
- [ ] `encodeCsv(gids, width)` → CSV string
- [ ] `encodeBase64(gids)` → base64 string
- [ ] `parseTmx` handles CSV data inline
- [ ] `parseTmxAsync` handles base64 + compressed data

### Tests (`tile-data-codec.test.ts`)

**Unit:**
- `decodeBase64` with known input → correct byte array
- `decodeBase64` with whitespace/newlines → handles gracefully
- `bytesToGids` with 8 bytes → 2 correct GIDs (little-endian)
- `bytesToGids` with flip flags set → flags preserved in GID values
- `bytesToGids` with odd byte count → throws
- `encodeCsv` → proper comma-separated format with newlines per row
- `encodeBase64` → round-trips with `decodeBase64` + `bytesToGids`
- `decompress("zlib", ...)` → correct decompressed output
- `decompress("gzip", ...)` → correct decompressed output
- Full round-trip: `number[]` → `encodeBase64` → `decodeBase64` → `bytesToGids` → same `number[]`

**Integration:**
- Parse TMX with `encoding="base64"` (uncompressed) → correct tile data
- Parse TMX with `encoding="base64" compression="zlib"` → correct tile data
- Parse TMX with `encoding="base64" compression="gzip"` → correct tile data

---

## Phase 3: TMX Writer (Export)

Serialize `TiledMap` back to TMX XML strings. This enables:
- Quintus level editor → save as `.tmx` → open in Tiled
- Round-trip testing (parse TMX → write TMX → parse again → identical)

### 3.1 `tmx-writer.ts`

```typescript
// packages/tilemap/src/tmx-writer.ts

export interface TmxWriteOptions {
	/** Data encoding for tile layers. Default: "csv" */
	encoding?: "csv" | "base64";
	/** Compression for base64 data. Default: none */
	compression?: "" | "zlib" | "gzip";
	/** Pretty-print with indentation. Default: true */
	pretty?: boolean;
	/** Indent string. Default: " " (single space, Tiled convention) */
	indent?: string;
	/** Write tilesets as external references (.tsx). Default: false (inline) */
	externalTilesets?: boolean;
}

/**
 * Serialize a TiledMap to a TMX XML string.
 */
export function writeTmx(map: TiledMap, options?: TmxWriteOptions): string;

/**
 * Serialize a TiledTileset to a TSX XML string.
 * Note: firstgid is omitted (it's map-specific).
 */
export function writeTsx(tileset: TiledTileset): string;
```

### 3.2 Implementation Approach

Use string building (not DOM serialization) for predictable, diff-friendly output:

```typescript
export function writeTmx(map: TiledMap, options?: TmxWriteOptions): string {
	const enc = options?.encoding ?? "csv";
	const indent = options?.indent ?? " ";
	const lines: string[] = [];

	lines.push('<?xml version="1.0" encoding="UTF-8"?>');
	lines.push(
		`<map version="1.10" tiledversion="1.11.0"` +
		` orientation="orthogonal" renderorder="right-down"` +
		` width="${map.width}" height="${map.height}"` +
		` tilewidth="${map.tilewidth}" tileheight="${map.tileheight}"` +
		` infinite="0"` +
		` nextlayerid="${nextLayerId(map)}"` +
		` nextobjectid="${nextObjectId(map)}">`,
	);

	// Properties
	if (map.properties?.length) {
		writeProperties(lines, map.properties, indent);
	}

	// Tilesets
	for (const ts of map.tilesets) {
		if (options?.externalTilesets && ts.source) {
			lines.push(`${indent}<tileset firstgid="${ts.firstgid}" source="${ts.source}"/>`);
		} else {
			writeTilesetInline(lines, ts, indent);
		}
	}

	// Layers
	for (const layer of map.layers) {
		if (layer.type === "tilelayer") {
			writeTileLayer(lines, layer, enc, indent);
		} else if (layer.type === "objectgroup") {
			writeObjectGroup(lines, layer, indent);
		}
	}

	lines.push("</map>");
	lines.push(""); // trailing newline

	return lines.join("\n");
}
```

### 3.3 CSV Data Serialization

```typescript
function writeCsvData(lines: string[], data: number[], width: number, indent: string): void {
	lines.push(`${indent}${indent}<data encoding="csv">`);
	for (let row = 0; row < data.length / width; row++) {
		const start = row * width;
		const end = start + width;
		const rowStr = data.slice(start, end).join(",");
		const isLast = end >= data.length;
		lines.push(isLast ? rowStr : `${rowStr},`);
	}
	lines.push(`${indent}${indent}</data>`);
}
```

### 3.4 Object Serialization

```typescript
function writeObject(lines: string[], obj: TiledObject, indent: string): void {
	let attrs = ` id="${obj.id}" name="${escapeXml(obj.name)}"`;
	if (obj.type) attrs += ` type="${escapeXml(obj.type)}"`;
	attrs += ` x="${obj.x}" y="${obj.y}"`;
	if (obj.width) attrs += ` width="${obj.width}"`;
	if (obj.height) attrs += ` height="${obj.height}"`;
	if (obj.rotation) attrs += ` rotation="${obj.rotation}"`;
	if (obj.visible === false) attrs += ` visible="0"`;

	const hasChildren = obj.point || obj.ellipse || obj.polygon || obj.polyline || obj.properties;

	if (!hasChildren) {
		lines.push(`${indent}<object${attrs}/>`);
	} else {
		lines.push(`${indent}<object${attrs}>`);
		if (obj.point) lines.push(`${indent}${indent}<point/>`);
		if (obj.ellipse) lines.push(`${indent}${indent}<ellipse/>`);
		if (obj.polygon) {
			const pts = obj.polygon.map((p) => `${p.x},${p.y}`).join(" ");
			lines.push(`${indent}${indent}<polygon points="${pts}"/>`);
		}
		if (obj.polyline) {
			const pts = obj.polyline.map((p) => `${p.x},${p.y}`).join(" ");
			lines.push(`${indent}${indent}<polyline points="${pts}"/>`);
		}
		if (obj.properties) {
			writeProperties(lines, obj.properties, indent + indent);
		}
		lines.push(`${indent}</object>`);
	}
}
```

### Deliverables

- [ ] `writeTmx(map, options?)` → TMX XML string
- [ ] `writeTsx(tileset)` → TSX XML string
- [ ] CSV data encoding (row-per-line, trailing comma matching Tiled)
- [ ] Base64 data encoding (optional, for large maps)
- [ ] Property serialization (all types: bool, int, float, string, color, file, object)
- [ ] Object serialization (rectangle, point, ellipse, polygon, polyline)
- [ ] Per-tile collision shapes and animations in TSX output
- [ ] XML escaping for string values (`&`, `<`, `>`, `"`, `'`)
- [ ] External tileset references (`source` attribute)
- [ ] `nextlayerid` and `nextobjectid` auto-computed

### Tests (`tmx-writer.test.ts`)

**Unit:**
- `writeTmx` with minimal map → valid XML structure
- `writeTmx` with CSV encoding → comma-separated rows
- `writeTmx` with properties → `<properties>` block with correct types
- `writeTmx` with object layer → `<objectgroup>` with objects
- `writeTsx` with collision shapes → per-tile `<objectgroup>`
- `writeTsx` with animation → `<animation>` frames
- XML special characters in names → properly escaped
- External tileset mode → `<tileset firstgid="..." source="..."/>`

**Round-trip:**
- Parse TMX → write TMX → parse again → `TiledMap` is structurally identical
- Parse TSX → write TSX → parse again → `TiledTileset` is structurally identical
- Round-trip preserves: properties, flip flags, object shapes, tile collision, animations

---

## Phase 4: Asset Loader Integration

Make `TileMap` load `.tmx` files transparently based on file extension.

### 4.1 Register TMX/TSX Asset Type

Add a `"tmx"` loader to the `AssetLoader` that handles XML parsing:

```typescript
// packages/tilemap/src/tilemap.ts (modified _loadMap)

private async _loadMap(): Promise<void> {
	const game = this.game;
	if (!game) {
		throw new Error("TileMap: Cannot load map — node is not in a scene tree.");
	}

	const ext = this._getAssetExtension();

	if (ext === "tmx") {
		await this._loadTmx();
	} else {
		// Existing JSON path
		this._loadJson();
	}
}
```

### 4.2 TMX Loading Pipeline

```typescript
private async _loadTmx(): Promise<void> {
	const game = this.game!;

	// TMX files are stored as text (loaded via custom loader or pre-stored)
	const tmxText = game.assets.get<string>(this._asset);
	if (!tmxText) {
		throw new Error(
			`TileMap: TMX asset '${this._asset}' not found. ` +
			`Load it via game.assets.load({ tmx: ['${this._asset}.tmx'] }).`,
		);
	}

	// Parse TMX, resolving external tilesets.
	// Note: nameFromPath() must be exported from @quintus/core (currently private on AssetLoader).
	const tiledMap = await parseTmxAsync(tmxText, (source) => {
		// Strip path to get asset key
		const tsxKey = nameFromPath(source);
		const tsxText = game.assets.get<string>(tsxKey);
		if (!tsxText) {
			throw new Error(
				`TileMap: External tileset '${source}' not found. ` +
				`Load it via game.assets.load({ tsx: ['${source}'] }).`,
			);
		}
		// parseTsx returns Omit<TiledTileset, "firstgid"> which matches
		// the resolveTileset callback signature. parseTmxAsync adds firstgid internally.
		return parseTsx(tsxText);
	});

	this._parsed = parseTiledMap(tiledMap);
}
```

### 4.3 Register Custom Loaders

The user needs to register TMX/TSX loaders once at game setup. We provide a convenience function:

```typescript
// packages/tilemap/src/tmx-loader.ts (NEW)

/**
 * Register TMX and TSX asset loaders on a game's AssetLoader.
 * Call this once during game setup.
 *
 * After registration, you can load TMX files via:
 *   game.assets.load({ tmx: ["level1.tmx"], tsx: ["terrain.tsx"] })
 */
export function registerTmxLoaders(assets: AssetLoader): void {
	// TMX loader: fetch as text
	assets.registerLoader("tmx", async (_name: string, path: string) => {
		const response = await fetch(path);
		if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		return response.text();
	});

	// TSX loader: fetch as text
	assets.registerLoader("tsx", async (_name: string, path: string) => {
		const response = await fetch(path);
		if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		return response.text();
	});
}
```

### 4.4 Usage Example

```typescript
import { Game } from "@quintus/core";
import { TileMap, registerTmxLoaders } from "@quintus/tilemap";

const game = new Game({ width: 800, height: 600 });

// Register TMX/TSX loaders (once)
registerTmxLoaders(game.assets);

// Load assets
await game.assets.load({
	tmx: ["levels/level1.tmx"],
	tsx: ["tilesets/terrain.tsx"],
	images: ["tilesets/terrain.png"],
});

// Use TileMap exactly as before — format is transparent
class Level1 extends Scene {
	onReady() {
		const map = this.add(TileMap);
		map.asset = "level1"; // auto-detects format
	}
}
```

### 4.5 Auto-Detection Strategy

The `TileMap` needs to know whether its asset is JSON or TMX. Options:

**Option A: Check asset store** (preferred)
- Try `game.assets.getJSON()` first (existing path)
- If null, try `game.assets.get()` for TMX text
- Format is determined by which store has the asset

**Option B: Explicit format property**
```typescript
map.format = "tmx"; // or "json" (default)
```

**Option A is preferred** because it's zero-config. The asset key alone determines the format.

### Deliverables

- [ ] Export `nameFromPath()` utility from `@quintus/core` (currently private on `AssetLoader`)
- [ ] `registerTmxLoaders(assets)` convenience function
- [ ] `TileMap._loadMap()` handles both JSON and TMX transparently
- [ ] External `.tsx` tileset resolution during TMX loading
- [ ] Auto-detect format based on which asset store contains the key
- [ ] Error messages guide user to correct `load()` call

### Tests

**Unit:**
- `registerTmxLoaders` registers "tmx" and "tsx" loader types
- `TileMap` with TMX asset → loads and parses correctly
- `TileMap` with TMX referencing external TSX → both resolved
- Missing TMX asset → descriptive error message
- Missing TSX dependency → descriptive error message

**Integration:**
- Full pipeline: load TMX+TSX+image → `TileMap.isLoaded === true`
- TMX-loaded map → `getTileAt()`, `getSpawnPoint()`, `generateCollision()` all work
- TMX-loaded map renders identically to same map saved as JSON

---

## Phase 5: Round-Trip Tests + Tiled Compatibility

Validate that Quintus can parse real Tiled-exported files and that the write → read round-trip is lossless.

### 5.1 Test Fixtures

Create test fixtures directory with real Tiled exports:

```
packages/tilemap/src/__fixtures__/
├── minimal.tmx          # 4x4 map, 1 tileset, 1 tile layer, CSV
├── minimal.tmj          # Same map, exported as JSON
├── minimal.tsx          # External tileset
├── objects.tmx          # Map with object layer (all shape types)
├── objects.tmj          # Same as JSON
├── compressed-zlib.tmx  # Map with base64+zlib data
├── compressed-gzip.tmx  # Map with base64+gzip data
├── multi-tileset.tmx    # Map referencing 2+ tilesets
├── collision.tsx        # Tileset with per-tile collision shapes
├── animation.tsx        # Tileset with animated tiles
├── properties.tmx       # Map exercising all property types
└── README.md            # How to regenerate fixtures from Tiled
```

### 5.2 Cross-Format Equivalence Tests

```typescript
describe("TMX ↔ JSON equivalence", () => {
	it("minimal map: TMX and JSON produce identical ParsedMap", () => {
		const tmxText = readFixture("minimal.tmx");
		const jsonData = readFixture("minimal.tmj");

		const fromTmx = parseTiledMap(parseTmx(tmxText));
		const fromJson = parseTiledMap(JSON.parse(jsonData));

		expectMapsEqual(fromTmx, fromJson);
	});

	it("object layers: TMX and JSON produce identical objects", () => {
		// Same test with objects.tmx / objects.tmj
	});
});
```

### 5.3 Round-Trip Tests

```typescript
describe("TMX round-trip", () => {
	it("parse → write → parse produces identical TiledMap", () => {
		const original = readFixture("minimal.tmx");
		const parsed = parseTmx(original);
		const written = writeTmx(parsed);
		const reparsed = parseTmx(written);

		expect(reparsed).toEqual(parsed);
	});

	it("TSX round-trip preserves collision shapes", () => {
		const original = readFixture("collision.tsx");
		const parsed = parseTsx(original);
		const written = writeTsx(parsed);
		const reparsed = parseTsx(written);

		expect(reparsed).toEqual(parsed);
	});
});
```

### 5.4 Real Tiled File Tests

Use actual `.tmx` files from the platformer example (converted from JSON):

```typescript
describe("real Tiled files", () => {
	it("parses the platformer level1.tmx", async () => {
		const tmx = readFixture("platformer-level1.tmx");
		const map = await parseTmxAsync(tmx, resolvePlatformerTilesets);

		expect(map.width).toBe(60);
		expect(map.layers.length).toBeGreaterThan(0);
		// Verify tile data is non-empty
		const groundLayer = map.layers.find(
			(l) => l.name === "ground" && l.type === "tilelayer",
		);
		expect(groundLayer).toBeDefined();
	});
});
```

### Deliverables

- [ ] Test fixtures: TMX + JSON pairs for cross-format validation
- [ ] TMX ↔ JSON equivalence tests (same map in both formats → identical ParsedMap)
- [ ] TMX round-trip tests (parse → write → parse → identical)
- [ ] TSX round-trip tests (parse → write → parse → identical)
- [ ] Real Tiled file compatibility tests
- [ ] Compressed data round-trip (base64+zlib)

---

## Phase 6: Extended Features

Add support for less common but important Tiled features needed for the future Quintus level editor.

### 6.1 Type Changes to `tiled-types.ts`

> **Note:** Several type additions originally planned for Phase 6 were moved to Phase 1 prerequisites
> because the TMX/TSX parser depends on them. The types already added in Phase 1 are:
> `TiledAnimationFrame`, `TiledTileDefinition.type`, `TiledTileDefinition.animation`,
> `TiledObject.polyline`, `TiledObject.gid`, `TiledTileset.source`,
> `TiledTileLayer.id`, `TiledObjectGroup.id`.
>
> Phase 6 adds only the types needed for group layers, image layers, and the expanded layer union.

```typescript
// === New types (Phase 6 only) ===

/** Image layer. */
export interface TiledImageLayer {
	name: string;
	type: "imagelayer";
	image: string;
	offsetx?: number;
	offsety?: number;
	opacity?: number;
	visible?: boolean;
	repeatx?: boolean;
	repeaty?: boolean;
	parallaxx?: number;
	parallaxy?: number;
	properties?: TiledProperty[];
}

/** Group layer (container for other layers). */
export interface TiledGroupLayer {
	name: string;
	type: "group";
	layers: TiledLayer[];
	offsetx?: number;
	offsety?: number;
	opacity?: number;
	visible?: boolean;
	properties?: TiledProperty[];
}

/** External tileset reference (no inline data). */
export interface TiledExternalTilesetRef {
	firstgid: number;
	source: string;
}

// === Modified types (Phase 6 only) ===

/** Updated layer union (adds image and group layers). */
export type TiledLayer =
	| TiledTileLayer
	| TiledObjectGroup
	| TiledImageLayer
	| TiledGroupLayer;
```

### 6.2 Group Layer Flattening

For the initial implementation, group layers are flattened into their children with composed offsets/opacity:

```typescript
function flattenGroupLayers(layers: TiledLayer[]): TiledLayer[] {
	const result: TiledLayer[] = [];
	for (const layer of layers) {
		if (layer.type === "group") {
			const children = flattenGroupLayers(layer.layers);
			for (const child of children) {
				// Compose offset
				if ("offsetx" in child) {
					child.offsetx = (child.offsetx ?? 0) + (layer.offsetx ?? 0);
					child.offsety = (child.offsety ?? 0) + (layer.offsety ?? 0);
				}
				// Compose opacity
				if ("opacity" in child) {
					child.opacity = (child.opacity ?? 1) * (layer.opacity ?? 1);
				}
				// Compose visibility
				if ("visible" in child && layer.visible === false) {
					child.visible = false;
				}
				result.push(child);
			}
		} else {
			result.push(layer);
		}
	}
	return result;
}
```

### 6.3 Tile Animations in ParsedMap

Add animation data to `ResolvedTile`:

```typescript
export interface ResolvedTile {
	localId: number;
	tileset: TiledTileset;
	flipH: boolean;
	flipV: boolean;
	flipD: boolean;
	/** Animation frames, if this tile is animated. */
	animation?: TiledAnimationFrame[];
}
```

The `TileMap.onDraw()` method can use the animation data to cycle tile frames based on elapsed time. This is a rendering concern that doesn't affect collision or physics.

### 6.4 Image Layers in ParsedMap

Add a new `ParsedImageLayer` type:

```typescript
export interface ParsedImageLayer {
	name: string;
	image: string;
	offsetX: number;
	offsetY: number;
	opacity: number;
	visible: boolean;
	repeatX: boolean;
	repeatY: boolean;
	parallaxX: number;
	parallaxY: number;
	properties: Map<string, boolean | number | string>;
}
```

And add to `ParsedMap`:

```typescript
export interface ParsedMap {
	// ... existing fields ...
	imageLayers: ParsedImageLayer[];
}
```

### 6.5 Infinite Maps (Chunks)

For infinite maps, tile data comes in `<chunk>` elements instead of a flat array:

```xml
<data encoding="csv">
  <chunk x="-16" y="0" width="16" height="16">
    1,2,3,...
  </chunk>
</data>
```

**Approach:** Convert chunks to a flat array by computing the bounding box of all chunks, then placing each chunk's data at the correct offset. This preserves the existing `ParsedTileLayer.tiles` flat array interface.

```typescript
function chunksToFlatArray(
	chunks: Array<{ x: number; y: number; width: number; height: number; data: number[] }>,
): { data: number[]; width: number; height: number; offsetX: number; offsetY: number } {
	// Compute bounding box
	let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
	for (const chunk of chunks) {
		minX = Math.min(minX, chunk.x);
		minY = Math.min(minY, chunk.y);
		maxX = Math.max(maxX, chunk.x + chunk.width);
		maxY = Math.max(maxY, chunk.y + chunk.height);
	}

	const width = maxX - minX;
	const height = maxY - minY;
	const data = new Array<number>(width * height).fill(0);

	for (const chunk of chunks) {
		for (let r = 0; r < chunk.height; r++) {
			for (let c = 0; c < chunk.width; c++) {
				const srcIdx = r * chunk.width + c;
				const dstCol = chunk.x - minX + c;
				const dstRow = chunk.y - minY + r;
				data[dstRow * width + dstCol] = chunk.data[srcIdx];
			}
		}
	}

	return { data, width, height, offsetX: minX, offsetY: minY };
}
```

### Deliverables

- [ ] `TiledImageLayer` type + parsing
- [ ] `TiledGroupLayer` type + recursive flattening
- [ ] `TiledExternalTilesetRef` type
- [ ] Expanded `TiledLayer` union (add image + group layer types)
- [ ] Infinite map chunk → flat array conversion
- [ ] Group layer offset/opacity/visibility composition
- [ ] Image layer rendering in `TileMap.onDraw()`

### Tests

**Unit:**
- Group layer flattening: 2-deep nesting → correct composed offsets/opacity
- Chunk → flat array: 4 chunks → correct bounding box and tile placement
- Animation parsing: TSX with 3-frame animation → correct frame array
- Image layer parsing: TMX with image layer → correct path and properties

---

## Supported Feature Matrix

Summary of what this design covers vs. the full Tiled spec:

| Feature | Read | Write | Priority |
|---------|------|-------|----------|
| Orthogonal maps | Phase 1 | Phase 3 | Must |
| CSV tile data | Phase 1 | Phase 3 | Must |
| Base64 tile data | Phase 2 | Phase 3 | Must |
| Base64 + zlib/gzip | Phase 2 | Phase 3 | Should |
| External tileset refs (.tsx) | Phase 1 | Phase 3 | Must |
| Inline tilesets | Phase 1 | Phase 3 | Must |
| Tile layers | Phase 1 | Phase 3 | Must |
| Object layers | Phase 1 | Phase 3 | Must |
| Custom properties (all types) | Phase 1 | Phase 3 | Must |
| Object shapes (rect, point, ellipse, polygon, polyline) | Phase 1 | Phase 3 | Must |
| Per-tile collision shapes | Phase 1 | Phase 3 | Must |
| Per-tile animations | Phase 1 (types+parse) | Phase 3 | Should |
| GID flip flags (H/V/D) | Phase 1 | Phase 3 | Must |
| Layer visibility/opacity/offset | Phase 1 | Phase 3 | Must |
| Group layers | Phase 6 | Phase 6 | Should |
| Image layers | Phase 6 | Phase 6 | Nice |
| Infinite maps (chunks) | Phase 6 | — | Nice |
| Tileset spacing/margin | Phase 1 | Phase 3 | Must |
| Isometric/hex orientations | — | — | Out of scope |
| Wang sets / terrain | — | — | Out of scope |
| Object templates | — | — | Out of scope |
| Text objects | — | — | Out of scope |
| Zstandard compression | — | — | Out of scope |
| Tile render size / fill mode | — | — | Out of scope |

### Out-of-Scope Rationale

- **Isometric/hex**: Quintus is focused on orthogonal 2D platformers and top-down games. Can be added later.
- **Wang sets**: Auto-tiling is an editor concern. The Quintus editor can add this independently.
- **Templates**: Low adoption, can be supported later by resolving templates to inline objects.
- **Text objects**: Rarely used in game maps. Text is better handled by UI nodes.
- **Zstandard**: Extremely rare in web contexts. No browser-native decompression.

---

## Future: Quintus Level Editor Interoperability

This design intentionally lays groundwork for a built-in Quintus level editor:

### Shared Subset

The Quintus editor will support a **subset** of the Tiled spec:
- Orthogonal maps
- Tile layers (CSV encoding)
- Object layers (all shape types)
- Custom properties
- External tilesets
- Per-tile collision shapes

By reading and writing standard `.tmx`/`.tsx` files, users can:
1. Start a level in Tiled → refine in Quintus editor (or vice versa)
2. Use Tiled for tileset editing → use Quintus for playtesting
3. Store all level data in a single portable format

### Editor-Specific Extensions

The Quintus editor may add custom properties (prefixed with `quintus:`) for engine-specific data:
- `quintus:scene_class` → which Scene subclass to use
- `quintus:physics_group` → collision group for generated colliders
- `quintus:one_way` → whether platforms are one-way

These properties are invisible to Tiled (just custom properties) but meaningful to Quintus.

---

## Definition of Done

- [ ] All phases marked Done in status table
- [ ] `pnpm build` succeeds with no errors
- [ ] `pnpm test` passes with no warnings
- [ ] `pnpm lint` clean
- [ ] TMX files load transparently in `TileMap` (same API as JSON)
- [ ] `writeTmx()` output opens correctly in Tiled
- [ ] Round-trip (TMX → TiledMap → TMX → TiledMap) is lossless for supported features
- [ ] Platformer example can load levels from `.tmx` instead of `.json`
- [ ] All new code has >90% test coverage
