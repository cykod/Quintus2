import type { Scene } from "./scene.js";

export interface Renderer {
	/** Render the current scene. Called once per frame. */
	render(scene: Scene): void;
	/** Notify the renderer that the scene tree structure changed. */
	markRenderDirty(): void;
	/** Handle canvas/viewport resize. */
	resize?(width: number, height: number): void;
	/** Clean up GPU resources. */
	dispose?(): void;
}
