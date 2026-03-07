import { describe, expect, it, vi } from "vitest";

vi.mock("three", () => import("./__test-utils__/three-mock.js"));
vi.mock("three/addons/loaders/GLTFLoader.js", () => ({
	GLTFLoader: class {
		loadAsync() {
			return Promise.resolve({});
		}
	},
}));

import * as THREE from "three";
import { Billboard } from "./billboard.js";

describe("Billboard", () => {
	it("creates Sprite lazily", () => {
		const node = new Billboard();
		expect(node.sprite).toBeInstanceOf(THREE.Sprite);
	});

	it("applies width/height to scale", () => {
		const node = new Billboard();
		node.width = 2;
		node.height = 3;
		const sprite = node.sprite;
		expect(sprite.scale.x).toBe(2);
		expect(sprite.scale.y).toBe(3);
	});

	it("applies opacity to material", () => {
		const node = new Billboard();
		node.opacity = 0.5;
		const sprite = node.sprite;
		const mat = sprite.material as THREE.SpriteMaterial;
		expect(mat.opacity).toBe(0.5);
	});

	it("setTexture updates material", () => {
		const node = new Billboard();
		const tex = new THREE.Texture();
		node.setTexture(tex);
		const mat = node.sprite.material as THREE.SpriteMaterial;
		expect(mat.map).toBe(tex);
		expect(mat.needsUpdate).toBe(true);
	});

	it("disposes material on destroy", () => {
		const node = new Billboard();
		const _sprite = node.sprite;
		const mat = node.sprite.material as THREE.SpriteMaterial;
		const matDispose = vi.spyOn(mat, "dispose");

		node.onDestroy();
		expect(matDispose).toHaveBeenCalled();
	});

	it("disposes texture on destroy if set", () => {
		const node = new Billboard();
		const tex = new THREE.Texture();
		node.setTexture(tex);
		const texDispose = vi.spyOn(tex, "dispose");

		node.onDestroy();
		expect(texDispose).toHaveBeenCalled();
	});
});
