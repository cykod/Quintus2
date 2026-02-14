import { beforeEach, describe, expect, it, vi } from "vitest";
import { AssetLoader } from "./asset-loader.js";

// Mock fetch and createImageBitmap
const mockImageBitmap = { width: 32, height: 32, close: () => {} };

beforeEach(() => {
	vi.restoreAllMocks();
	// @ts-expect-error - mocking global
	globalThis.createImageBitmap = vi.fn().mockResolvedValue(mockImageBitmap);
});

function mockFetchSuccess(data: unknown, contentType: string) {
	return vi.fn().mockResolvedValue({
		ok: true,
		status: 200,
		statusText: "OK",
		blob: () => Promise.resolve(new Blob([JSON.stringify(data)], { type: contentType })),
		json: () => Promise.resolve(data),
	});
}

function mockFetchFailure(status: number) {
	return vi.fn().mockResolvedValue({
		ok: false,
		status,
		statusText: "Not Found",
	});
}

describe("AssetLoader", () => {
	it("loads images", async () => {
		globalThis.fetch = mockFetchSuccess({}, "image/png") as typeof fetch;
		const loader = new AssetLoader();
		await loader.load({ images: ["hero.png"] });
		expect(loader.getImage("hero")).toBe(mockImageBitmap);
	});

	it("loads JSON", async () => {
		const jsonData = { name: "test", value: 42 };
		globalThis.fetch = mockFetchSuccess(jsonData, "application/json") as typeof fetch;
		const loader = new AssetLoader();
		await loader.load({ json: ["data.json"] });
		expect(loader.getJSON("data")).toEqual(jsonData);
	});

	it("progress signal fires with correct counts", async () => {
		globalThis.fetch = mockFetchSuccess({}, "image/png") as typeof fetch;
		const loader = new AssetLoader();
		const progressFn = vi.fn();
		loader.progress.connect(progressFn);
		await loader.load({ images: ["a.png", "b.png"] });
		expect(progressFn).toHaveBeenCalledTimes(2);
	});

	it("complete signal fires after all settled", async () => {
		globalThis.fetch = mockFetchSuccess({}, "image/png") as typeof fetch;
		const loader = new AssetLoader();
		const completeFn = vi.fn();
		loader.complete.connect(completeFn);
		await loader.load({ images: ["a.png"] });
		expect(completeFn).toHaveBeenCalled();
	});

	it("error signal fires per failed asset", async () => {
		globalThis.fetch = mockFetchFailure(404) as typeof fetch;
		const loader = new AssetLoader();
		const errorFn = vi.fn();
		loader.error.connect(errorFn);
		await loader.load({ images: ["missing.png"] });
		expect(errorFn).toHaveBeenCalledTimes(1);
		expect(errorFn.mock.calls[0]?.[0].asset).toBe("missing.png");
	});

	it("failed fetch does not reject the load promise", async () => {
		globalThis.fetch = mockFetchFailure(404) as typeof fetch;
		const loader = new AssetLoader();
		// Should not throw
		await loader.load({ images: ["missing.png"] });
	});

	it("getImage returns null for unknown", () => {
		const loader = new AssetLoader();
		expect(loader.getImage("unknown")).toBeNull();
	});

	it("getJSON returns null for unknown", () => {
		const loader = new AssetLoader();
		expect(loader.getJSON("unknown")).toBeNull();
	});

	it("isLoaded correctness", async () => {
		globalThis.fetch = mockFetchSuccess({}, "image/png") as typeof fetch;
		const loader = new AssetLoader();
		expect(loader.isLoaded("hero")).toBe(false);
		await loader.load({ images: ["hero.png"] });
		expect(loader.isLoaded("hero")).toBe(true);
	});

	it("failedAssets lists failed paths", async () => {
		globalThis.fetch = mockFetchFailure(404) as typeof fetch;
		const loader = new AssetLoader();
		await loader.load({ images: ["missing.png"] });
		expect(loader.failedAssets).toContain("missing.png");
	});

	it("complete signal fires even with failures", async () => {
		globalThis.fetch = mockFetchFailure(404) as typeof fetch;
		const loader = new AssetLoader();
		const completeFn = vi.fn();
		loader.complete.connect(completeFn);
		await loader.load({ images: ["missing.png"] });
		expect(completeFn).toHaveBeenCalled();
	});

	// === T4c: Edge Cases ===
	it("allLoaded returns true when no failures", async () => {
		globalThis.fetch = mockFetchSuccess({}, "image/png") as typeof fetch;
		const loader = new AssetLoader();
		expect(loader.allLoaded).toBe(true);
		await loader.load({ images: ["hero.png"] });
		expect(loader.allLoaded).toBe(true);
	});

	it("allLoaded returns false when failures exist", async () => {
		globalThis.fetch = mockFetchFailure(404) as typeof fetch;
		const loader = new AssetLoader();
		await loader.load({ images: ["missing.png"] });
		expect(loader.allLoaded).toBe(false);
	});

	it("retry() with image extension re-loads as image", async () => {
		// First fail
		globalThis.fetch = mockFetchFailure(404) as typeof fetch;
		const loader = new AssetLoader();
		await loader.load({ images: ["hero.png"] });
		expect(loader.failedAssets).toContain("hero.png");

		// Now succeed on retry
		globalThis.fetch = mockFetchSuccess({}, "image/png") as typeof fetch;
		await loader.retry("hero.png");
		expect(loader.getImage("hero")).toBe(mockImageBitmap);
		expect(loader.failedAssets).not.toContain("hero.png");
	});

	it("retry() with JSON extension re-loads as JSON", async () => {
		globalThis.fetch = mockFetchFailure(404) as typeof fetch;
		const loader = new AssetLoader();
		await loader.load({ json: ["data.json"] });
		expect(loader.failedAssets).toContain("data.json");

		const jsonData = { key: "value" };
		globalThis.fetch = mockFetchSuccess(jsonData, "application/json") as typeof fetch;
		await loader.retry("data.json");
		expect(loader.getJSON("data")).toEqual(jsonData);
		expect(loader.failedAssets).not.toContain("data.json");
	});

	it("network error (fetch throws) is handled gracefully", async () => {
		globalThis.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch")) as typeof fetch;
		const loader = new AssetLoader();
		const errorFn = vi.fn();
		loader.error.connect(errorFn);
		await loader.load({ images: ["hero.png"] });
		expect(errorFn).toHaveBeenCalledTimes(1);
		expect(loader.failedAssets).toContain("hero.png");
	});
});
