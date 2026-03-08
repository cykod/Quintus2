import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("three", () => import("../../../packages/three/src/__test-utils__/three-mock.js"));
vi.mock("three/addons/loaders/GLTFLoader.js", () => ({
	GLTFLoader: class {
		loadAsync() {
			return Promise.resolve({});
		}
	},
}));

import { PLAYER_HEALTH } from "../config.js";
import { gameState } from "../state.js";
import { resetState } from "./helpers.js";

describe("Game flow", () => {
	beforeEach(() => {
		resetState();
	});

	describe("gameState.reset()", () => {
		it("restores default values", () => {
			gameState.score = 500;
			gameState.health = 1;
			gameState.level = 3;

			gameState.reset();

			expect(gameState.score).toBe(0);
			expect(gameState.health).toBe(PLAYER_HEALTH);
			expect(gameState.maxHealth).toBe(PLAYER_HEALTH);
			expect(gameState.level).toBe(1);
		});
	});

	describe("reactive signals", () => {
		it("fires on score change", () => {
			const values: number[] = [];
			gameState.on("score").connect(({ value }) => values.push(value));
			gameState.score = 10;
			gameState.score = 20;
			expect(values).toEqual([10, 20]);
		});

		it("fires on health change", () => {
			const values: number[] = [];
			gameState.on("health").connect(({ value }) => values.push(value));
			gameState.health = 2;
			gameState.health = 1;
			expect(values).toEqual([2, 1]);
		});

		it("fires on level change", () => {
			const values: number[] = [];
			gameState.on("level").connect(({ value }) => values.push(value));
			gameState.level = 2;
			gameState.level = 3;
			expect(values).toEqual([2, 3]);
		});
	});
});
