import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Rect } from "@quintus/math";
import { describe, expect, it } from "vitest";
import { TextureAtlas } from "./texture-atlas.js";

const SAMPLE_XML = `<TextureAtlas imagePath="sprites.png">
	<SubTexture name="paddle_01.png" x="0" y="794" width="520" height="140"/>
	<SubTexture name="paddle_02.png" x="0" y="0" width="640" height="140"/>
	<SubTexture name="ball_blue.png" x="100" y="200" width="32" height="32"/>
	<SubTexture name="ball_red.png" x="140" y="200" width="32" height="32"/>
</TextureAtlas>`;

describe("TextureAtlas", () => {
	it("parses XML with SubTexture entries", () => {
		const atlas = TextureAtlas.fromXml(SAMPLE_XML);

		expect(atlas.texture).toBe("sprites.png");
		expect(atlas.frameCount).toBe(4);
		expect(atlas.getFrame("paddle_01.png")).toEqual(new Rect(0, 794, 520, 140));
		expect(atlas.getFrame("paddle_02.png")).toEqual(new Rect(0, 0, 640, 140));
		expect(atlas.getFrame("ball_blue.png")).toEqual(new Rect(100, 200, 32, 32));
	});

	it("texture override takes precedence over imagePath", () => {
		const atlas = TextureAtlas.fromXml(SAMPLE_XML, "custom.png");
		expect(atlas.texture).toBe("custom.png");
	});

	it("getFrameOrThrow throws for missing frame", () => {
		const atlas = TextureAtlas.fromXml(SAMPLE_XML);
		expect(() => atlas.getFrameOrThrow("nonexistent")).toThrow(
			'Frame "nonexistent" not found in texture atlas.',
		);
	});

	it("getFrame returns undefined for missing frame", () => {
		const atlas = TextureAtlas.fromXml(SAMPLE_XML);
		expect(atlas.getFrame("nonexistent")).toBeUndefined();
	});

	it("getFramesByPrefix groups related sprites", () => {
		const atlas = TextureAtlas.fromXml(SAMPLE_XML);
		const balls = atlas.getFramesByPrefix("ball_");

		expect(balls).toHaveLength(2);
		expect(balls[0]?.name).toBe("ball_blue.png");
		expect(balls[0]?.rect).toEqual(new Rect(100, 200, 32, 32));
		expect(balls[1]?.name).toBe("ball_red.png");
		expect(balls[1]?.rect).toEqual(new Rect(140, 200, 32, 32));
	});

	it("frameNames returns all names in insertion order", () => {
		const atlas = TextureAtlas.fromXml(SAMPLE_XML);
		expect(atlas.frameNames).toEqual([
			"paddle_01.png",
			"paddle_02.png",
			"ball_blue.png",
			"ball_red.png",
		]);
	});

	it("hasFrame returns correct boolean", () => {
		const atlas = TextureAtlas.fromXml(SAMPLE_XML);
		expect(atlas.hasFrame("paddle_01.png")).toBe(true);
		expect(atlas.hasFrame("missing")).toBe(false);
	});

	it("throws on invalid root element", () => {
		const badXml = `<SpriteSheet imagePath="test.png"></SpriteSheet>`;
		expect(() => TextureAtlas.fromXml(badXml)).toThrow(
			"Expected root <TextureAtlas> element, got <SpriteSheet>.",
		);
	});

	it("uses 'unknown' texture when imagePath is missing and no override", () => {
		const xml = `<TextureAtlas><SubTexture name="a" x="0" y="0" width="10" height="10"/></TextureAtlas>`;
		const atlas = TextureAtlas.fromXml(xml);
		expect(atlas.texture).toBe("unknown");
		expect(atlas.frameCount).toBe(1);
	});

	it("parses real Kenney atlas file", async () => {
		const xmlPath = resolve(__dirname, "../../../examples/breakout/assets/paddles.xml");
		const xml = await readFile(xmlPath, "utf-8");
		const atlas = TextureAtlas.fromXml(xml);

		expect(atlas.texture).toBe("sprites.png");
		expect(atlas.frameCount).toBe(12);
		expect(atlas.hasFrame("paddle_01.png")).toBe(true);
		expect(atlas.getFrameOrThrow("paddle_01.png")).toEqual(new Rect(0, 794, 520, 140));
	});
});
