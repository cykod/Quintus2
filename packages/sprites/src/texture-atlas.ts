import { Rect } from "@quintus/math";

/** A single named frame in a texture atlas. */
export interface TextureAtlasFrame {
	readonly name: string;
	readonly rect: Rect;
}

/**
 * A texture atlas that maps sprite names to variable-sized source rectangles.
 *
 * Typically loaded from Kenney-style XML atlas files where each `<SubTexture>`
 * defines a named region within a shared sprite sheet image.
 */
export class TextureAtlas {
	/** The texture asset name (image file). */
	readonly texture: string;

	private readonly _frames: Map<string, Rect>;

	constructor(texture: string, frames: Map<string, Rect>) {
		this.texture = texture;
		this._frames = frames;
	}

	/** Get the source rectangle for a named frame. Returns undefined if not found. */
	getFrame(name: string): Rect | undefined {
		return this._frames.get(name);
	}

	/** Get the source rectangle for a named frame. Throws if not found. */
	getFrameOrThrow(name: string): Rect {
		const rect = this._frames.get(name);
		if (!rect) {
			throw new Error(`Frame "${name}" not found in texture atlas.`);
		}
		return rect;
	}

	/** Check if a frame exists. */
	hasFrame(name: string): boolean {
		return this._frames.has(name);
	}

	/** Get all frames whose names start with the given prefix. */
	getFramesByPrefix(prefix: string): TextureAtlasFrame[] {
		const results: TextureAtlasFrame[] = [];
		for (const [name, rect] of this._frames) {
			if (name.startsWith(prefix)) {
				results.push({ name, rect });
			}
		}
		return results;
	}

	/** All frame names in insertion order. */
	get frameNames(): string[] {
		return [...this._frames.keys()];
	}

	/** Total number of frames. */
	get frameCount(): number {
		return this._frames.size;
	}

	/**
	 * Parse a Kenney-style XML texture atlas.
	 *
	 * ```xml
	 * <TextureAtlas imagePath="sprites.png">
	 *   <SubTexture name="paddle_01.png" x="0" y="794" width="520" height="140"/>
	 * </TextureAtlas>
	 * ```
	 *
	 * @param xml - The XML string to parse.
	 * @param texture - Optional texture name override. If omitted, uses the `imagePath` attribute.
	 */
	static fromXml(xml: string, texture?: string): TextureAtlas {
		const doc = parseXml(xml);
		const root = doc.documentElement;

		if (root.tagName !== "TextureAtlas") {
			throw new Error(`Expected root <TextureAtlas> element, got <${root.tagName}>.`);
		}

		const textureName = texture ?? root.getAttribute("imagePath") ?? "unknown";
		const frames = new Map<string, Rect>();

		// Manual iteration to avoid jsdom :scope selector bug
		for (let i = 0; i < root.children.length; i++) {
			const child = root.children[i] as Element;
			if (child.tagName !== "SubTexture") continue;

			const name = child.getAttribute("name");
			if (!name) continue;

			const x = Number.parseInt(child.getAttribute("x") ?? "0", 10);
			const y = Number.parseInt(child.getAttribute("y") ?? "0", 10);
			const w = Number.parseInt(child.getAttribute("width") ?? "0", 10);
			const h = Number.parseInt(child.getAttribute("height") ?? "0", 10);

			frames.set(name, new Rect(x, y, w, h));
		}

		return new TextureAtlas(textureName, frames);
	}
}

// ─── Private Helpers ────────────────────────────────────────────

function parseXml(xml: string): Document {
	const parser = new DOMParser();
	const doc = parser.parseFromString(xml, "text/xml");
	const err = doc.querySelector("parsererror");
	if (err) {
		throw new Error(`XML parse error: ${err.textContent}`);
	}
	return doc;
}
