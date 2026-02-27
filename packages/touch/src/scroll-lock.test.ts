import { describe, expect, it } from "vitest";
import { lockScroll } from "./scroll-lock.js";

describe("lockScroll", () => {
	it("sets touch-action: none on the canvas", () => {
		const canvas = document.createElement("canvas");
		const cleanup = lockScroll(canvas);
		expect(canvas.style.touchAction).toBe("none");
		cleanup();
	});

	it("sets overflow, position, width, height on body", () => {
		const canvas = document.createElement("canvas");
		const cleanup = lockScroll(canvas);
		expect(document.body.style.overflow).toBe("hidden");
		expect(document.body.style.position).toBe("fixed");
		expect(document.body.style.width).toBe("100%");
		expect(document.body.style.height).toBe("100%");
		cleanup();
	});

	it("cleanup restores original body styles", () => {
		const canvas = document.createElement("canvas");
		document.body.style.overflow = "auto";
		document.body.style.position = "relative";
		document.body.style.width = "500px";
		document.body.style.height = "300px";

		const cleanup = lockScroll(canvas);
		cleanup();

		expect(document.body.style.overflow).toBe("auto");
		expect(document.body.style.position).toBe("relative");
		expect(document.body.style.width).toBe("500px");
		expect(document.body.style.height).toBe("300px");
	});

	it("cleanup restores canvas touch-action", () => {
		const canvas = document.createElement("canvas");
		canvas.style.touchAction = "auto";
		const cleanup = lockScroll(canvas);
		expect(canvas.style.touchAction).toBe("none");
		cleanup();
		expect(canvas.style.touchAction).toBe("");
	});
});
