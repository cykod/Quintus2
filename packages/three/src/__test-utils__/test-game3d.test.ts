import { describe, expect, it, vi } from "vitest";

vi.mock("three", () => import("./three-mock.js"));
vi.mock("three/addons/loaders/GLTFLoader.js", () =>
	import("./gltf-mock.js").then((m) => m.GLTF_LOADER_MOCK),
);

import { Scene } from "@quintus/core";
import { getThreeContext } from "../three-plugin.js";
import { createTestGame3D } from "./test-game3d.js";

describe("createTestGame3D", () => {
	it("creates a game with ThreePlugin", () => {
		const game = createTestGame3D();
		const ctx = getThreeContext(game);
		expect(ctx).not.toBeNull();
	});

	it("starts with a scene if provided", () => {
		class TestScene extends Scene {
			onReady() {}
		}
		const game = createTestGame3D({ SceneClass: TestScene });
		expect(game.currentScene).toBeInstanceOf(TestScene);
	});

	it("accepts custom dimensions", () => {
		const game = createTestGame3D({ width: 1024, height: 768 });
		expect(game.width).toBe(1024);
		expect(game.height).toBe(768);
	});
});
