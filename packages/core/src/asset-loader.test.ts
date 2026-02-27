import { beforeEach, describe, expect, it, vi } from "vitest";
import { AssetLoader } from "./asset-loader.js";

// Mock fetch and createImageBitmap
const mockImageBitmap = { width: 32, height: 32, close: () => {} };

beforeEach(() => {
	vi.restoreAllMocks();
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

	it("loads XML as text", async () => {
		const xmlContent =
			'<TextureAtlas imagePath="sprites.png"><SubTexture name="ball" /></TextureAtlas>';
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			statusText: "OK",
			text: () => Promise.resolve(xmlContent),
		}) as typeof fetch;
		const loader = new AssetLoader();
		await loader.load({ xml: ["sprites.xml"] });
		expect(loader.get<string>("sprites")).toBe(xmlContent);
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

	it("non-Error exception is wrapped in Error", async () => {
		globalThis.fetch = vi.fn().mockRejectedValue("string error") as typeof fetch;
		const loader = new AssetLoader();
		const errorFn = vi.fn();
		loader.error.connect(errorFn);
		await loader.load({ images: ["hero.png"] });
		expect(errorFn).toHaveBeenCalledTimes(1);
		const emitted = errorFn.mock.calls[0]?.[0];
		expect(emitted.error).toBeInstanceOf(Error);
		expect(emitted.error.message).toBe("string error");
	});

	it("nameFromPath handles filename without extension", async () => {
		const jsonData = { key: "value" };
		globalThis.fetch = mockFetchSuccess(jsonData, "application/json") as typeof fetch;
		const loader = new AssetLoader();
		await loader.load({ json: ["assets/noextension"] });
		// Name should be the full filename when no dot is found
		expect(loader.getJSON("noextension")).toEqual(jsonData);
	});

	it("load with empty manifest is a no-op", async () => {
		const loader = new AssetLoader();
		const completeFn = vi.fn();
		loader.complete.connect(completeFn);
		await loader.load({});
		expect(completeFn).toHaveBeenCalled();
	});

	// === Custom Loaders ===
	describe("custom loaders", () => {
		it("registerLoader + load custom asset type", async () => {
			const loader = new AssetLoader();
			loader.registerLoader("audio", async (_name, path) => {
				return { mockBuffer: true, path };
			});

			await loader.load({ audio: ["music/bgm.ogg"] });

			const result = loader.get<{ mockBuffer: boolean; path: string }>("bgm");
			expect(result).not.toBeNull();
			expect(result?.mockBuffer).toBe(true);
			expect(result?.path).toBe("music/bgm.ogg");
		});

		it("custom loader receives correct name and path", async () => {
			const loader = new AssetLoader();
			const loaderFn = vi.fn().mockResolvedValue("loaded");
			loader.registerLoader("shader", loaderFn);

			await loader.load({ shader: ["assets/shaders/blur.glsl"] });

			expect(loaderFn).toHaveBeenCalledWith("blur", "assets/shaders/blur.glsl");
		});

		it("warns and skips unregistered custom asset type", async () => {
			const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
			const loader = new AssetLoader();

			await loader.load({ unknown: ["file.dat"] });

			expect(warnSpy).toHaveBeenCalledWith(
				expect.stringContaining('No loader registered for asset type "unknown"'),
			);
			warnSpy.mockRestore();
		});

		it("custom loader error is caught and emitted", async () => {
			const loader = new AssetLoader();
			loader.registerLoader("audio", async () => {
				throw new Error("decode failed");
			});

			const errorFn = vi.fn();
			loader.error.connect(errorFn);

			await loader.load({ audio: ["bad.ogg"] });

			expect(errorFn).toHaveBeenCalledTimes(1);
			expect(errorFn.mock.calls[0][0].error.message).toBe("decode failed");
			expect(loader.failedAssets).toContain("bad.ogg");
		});

		it("multiple custom types in one manifest", async () => {
			const loader = new AssetLoader();
			loader.registerLoader("audio", async () => ({ type: "audio" }));
			loader.registerLoader("csv", async () => "a,b,c");

			await loader.load({
				audio: ["bgm.ogg"],
				csv: ["data.csv"],
			});

			expect(loader.get("bgm")).toEqual({ type: "audio" });
			expect(loader.get("data")).toBe("a,b,c");
		});
	});

	// === _storeJSON / _storeCustom ===
	describe("test helpers", () => {
		it("_storeJSON stores retrievable data", () => {
			const loader = new AssetLoader();
			const data = { tiles: [1, 2, 3] };
			loader._storeJSON("map", data);
			expect(loader.getJSON("map")).toEqual(data);
			expect(loader.isLoaded("map")).toBe(true);
		});

		it("_storeCustom stores retrievable data", () => {
			const loader = new AssetLoader();
			const buf = new ArrayBuffer(16);
			loader._storeCustom("sound", buf);
			expect(loader.get("sound")).toBe(buf);
			expect(loader.isLoaded("sound")).toBe(true);
		});
	});

	// === Progress tracking ===
	describe("progress tracking", () => {
		it("progress reports correct loaded/total for mixed manifest", async () => {
			const jsonData = { key: "value" };
			globalThis.fetch = mockFetchSuccess(jsonData, "image/png") as typeof fetch;
			const loader = new AssetLoader();
			loader.registerLoader("audio", async () => "audio-data");

			const progressCalls: Array<{ loaded: number; total: number }> = [];
			loader.progress.connect((p) => progressCalls.push({ loaded: p.loaded, total: p.total }));

			await loader.load({
				images: ["a.png"],
				json: ["b.json"],
				audio: ["c.ogg"],
			});

			expect(progressCalls.length).toBe(3);
			expect(progressCalls[progressCalls.length - 1]?.total).toBe(3);
		});
	});
});
