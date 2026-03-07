import { describe, expect, it, vi } from "vitest";

vi.mock("three", () => import("./__test-utils__/three-mock.js"));

import * as THREE from "three";
import { AmbientLight, DirectionalLight, PointLight } from "./lights.js";

describe("AmbientLight", () => {
	it("creates light with default values", () => {
		const node = new AmbientLight();
		expect(node.light).toBeInstanceOf(THREE.AmbientLight);
		expect(node.light.intensity).toBe(0.5);
	});

	it("creates light with custom intensity", () => {
		const node = new AmbientLight();
		node.intensity = 0.4;
		expect(node.light.intensity).toBe(0.4);
	});
});

describe("DirectionalLight", () => {
	it("creates light with defaults", () => {
		const node = new DirectionalLight();
		expect(node.light).toBeInstanceOf(THREE.DirectionalLight);
		expect(node.light.intensity).toBe(1);
	});

	it("creates light with shadow config", () => {
		const node = new DirectionalLight();
		node.castShadow = true;
		node.shadowMapSize = 2048;
		const light = node.light;
		expect(light.castShadow).toBe(true);
	});

	it("disposes shadow map on destroy", () => {
		const node = new DirectionalLight();
		node.castShadow = true;
		const light = node.light;
		const mockMap = { dispose: vi.fn() };
		light.shadow.map = mockMap;

		node.onDestroy();
		expect(mockMap.dispose).toHaveBeenCalled();
	});
});

describe("PointLight", () => {
	it("creates light with custom props", () => {
		const node = new PointLight();
		node.intensity = 2;
		node.distance = 10;
		node.decay = 1;
		const light = node.light;
		expect(light).toBeInstanceOf(THREE.PointLight);
		expect(light.intensity).toBe(2);
		expect(light.distance).toBe(10);
		expect(light.decay).toBe(1);
	});

	it("disposes shadow map on destroy", () => {
		const node = new PointLight();
		node.castShadow = true;
		const light = node.light;
		const mockMap = { dispose: vi.fn() };
		light.shadow.map = mockMap;

		node.onDestroy();
		expect(mockMap.dispose).toHaveBeenCalled();
	});
});
