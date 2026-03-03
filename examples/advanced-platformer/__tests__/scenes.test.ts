import { describe, expect, it } from "vitest";
import { GameOverScene } from "../scenes/game-over-scene.js";
import { Level1Scene } from "../scenes/test-scene.js";
import { TitleScene } from "../scenes/title-scene.js";
import { VictoryScene } from "../scenes/victory-scene.js";

describe("Scenes", () => {
	it("Level1Scene class exists and is a function", () => {
		expect(typeof Level1Scene).toBe("function");
	});

	it("TitleScene class exists and is a function", () => {
		expect(typeof TitleScene).toBe("function");
	});

	it("GameOverScene class exists and is a function", () => {
		expect(typeof GameOverScene).toBe("function");
	});

	it("VictoryScene class exists and is a function", () => {
		expect(typeof VictoryScene).toBe("function");
	});

	it("TestScene alias exists for backward compatibility", async () => {
		const { TestScene } = await import("../scenes/test-scene.js");
		expect(TestScene).toBe(Level1Scene);
	});
});
