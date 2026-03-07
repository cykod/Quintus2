import * as THREE from "three";

export interface ThreePluginConfig {
	/** Enable antialiasing. Default: true. */
	antialias?: boolean;
	/** Pixel ratio. Default: window.devicePixelRatio. */
	pixelRatio?: number;
	/** Background color. Default: null (transparent). */
	background?: THREE.ColorRepresentation | null;
	/** Enable shadow maps. Default: false. */
	shadows?: boolean;
	/** Tone mapping. Default: THREE.NoToneMapping. */
	toneMapping?: THREE.ToneMapping;
}

export class ThreeContext {
	readonly scene: THREE.Scene;
	readonly webglRenderer: THREE.WebGLRenderer;

	/** The currently active 3D camera. Set by Camera3D nodes. */
	activeCamera: THREE.Camera | null = null;

	/** Whether this context is in hybrid mode (offscreen canvas for compositing). */
	readonly hybridMode: boolean;

	private _disposed = false;

	constructor(
		canvas: HTMLCanvasElement,
		width: number,
		height: number,
		config: ThreePluginConfig = {},
		hybridMode = false,
	) {
		this.scene = new THREE.Scene();
		this.hybridMode = hybridMode;

		this.webglRenderer = new THREE.WebGLRenderer({
			canvas,
			antialias: config.antialias ?? true,
			alpha: config.background === null || config.background === undefined,
			preserveDrawingBuffer: hybridMode,
		});
		this.webglRenderer.setSize(width, height, false);
		this.webglRenderer.setPixelRatio(
			config.pixelRatio ?? (typeof window !== "undefined" ? window.devicePixelRatio : 1),
		);

		if (config.background != null) {
			this.scene.background = new THREE.Color(config.background);
		}

		if (config.shadows) {
			this.webglRenderer.shadowMap.enabled = true;
			this.webglRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
		}

		if (config.toneMapping) {
			this.webglRenderer.toneMapping = config.toneMapping;
		}
	}

	dispose(): void {
		if (this._disposed) return;
		this._disposed = true;
		this.webglRenderer.dispose();
	}
}
