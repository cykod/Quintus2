import { afterEach, describe, expect, it, vi } from "vitest";
import {
	exitFullscreen,
	isFullscreen,
	onFullscreenChange,
	requestFullscreen,
} from "./fullscreen.js";

describe("requestFullscreen", () => {
	it("calls native requestFullscreen on the element", async () => {
		const el = document.createElement("div");
		el.requestFullscreen = vi.fn().mockResolvedValue(undefined);
		await requestFullscreen(el);
		expect(el.requestFullscreen).toHaveBeenCalled();
	});

	it("falls back to webkitRequestFullscreen", async () => {
		const el = document.createElement("div") as HTMLElement & {
			webkitRequestFullscreen?: () => Promise<void>;
		};
		// Remove standard API
		Object.defineProperty(el, "requestFullscreen", {
			value: undefined,
			configurable: true,
		});
		el.webkitRequestFullscreen = vi.fn().mockResolvedValue(undefined);
		await requestFullscreen(el);
		expect(el.webkitRequestFullscreen).toHaveBeenCalled();
	});

	it("resolves when no fullscreen API is available", async () => {
		const el = document.createElement("div");
		Object.defineProperty(el, "requestFullscreen", {
			value: undefined,
			configurable: true,
		});
		// Should not throw
		await requestFullscreen(el);
	});
});

describe("exitFullscreen", () => {
	it("calls document.exitFullscreen when available", async () => {
		// jsdom may not have exitFullscreen — define it
		const mockExit = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(document, "exitFullscreen", {
			value: mockExit,
			configurable: true,
		});
		await exitFullscreen();
		expect(mockExit).toHaveBeenCalled();
	});
});

describe("isFullscreen", () => {
	afterEach(() => {
		Object.defineProperty(document, "fullscreenElement", {
			value: null,
			configurable: true,
		});
	});

	it("returns false when no fullscreen element", () => {
		expect(isFullscreen()).toBe(false);
	});

	it("returns true when fullscreenElement is set", () => {
		Object.defineProperty(document, "fullscreenElement", {
			value: document.documentElement,
			configurable: true,
		});
		expect(isFullscreen()).toBe(true);
	});
});

describe("onFullscreenChange", () => {
	afterEach(() => {
		Object.defineProperty(document, "fullscreenElement", {
			value: null,
			configurable: true,
		});
	});

	it("calls callback on fullscreenchange event", () => {
		const callback = vi.fn();
		const cleanup = onFullscreenChange(callback);

		document.dispatchEvent(new Event("fullscreenchange"));
		expect(callback).toHaveBeenCalledWith(false);

		cleanup();
	});

	it("cleanup removes listener", () => {
		const callback = vi.fn();
		const cleanup = onFullscreenChange(callback);
		cleanup();

		document.dispatchEvent(new Event("fullscreenchange"));
		expect(callback).not.toHaveBeenCalled();
	});
});
