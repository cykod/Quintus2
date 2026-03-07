import type { Node, Renderer, Scene } from "@quintus/core";
import { Canvas2DDrawContext, Node2D } from "@quintus/core";
import * as THREE from "three";
import { Node3D } from "./node3d.js";
import type { ThreeContext } from "./three-context.js";

export class ThreeRenderer implements Renderer {
	private readonly ctx: ThreeContext;

	/**
	 * Maps Quintus Node3D → parent THREE.Object3D in the Three.js scene.
	 * Used to detect reparenting and manage the Three.js scene graph.
	 */
	private readonly parentMap = new WeakMap<Node3D, THREE.Object3D>();

	/**
	 * Optional Canvas2D overlay for renderFixed Node2D nodes (HUD, etc.).
	 */
	private overlayCanvas: HTMLCanvasElement | null = null;
	private overlayDrawContext: Canvas2DDrawContext | null = null;
	private _fallbackCamera: THREE.PerspectiveCamera | null = null;

	constructor(ctx: ThreeContext) {
		this.ctx = ctx;
	}

	markRenderDirty(): void {
		// No-op: ThreeRenderer re-syncs and renders every frame.
		// Required by the Renderer interface contract.
	}

	render(scene: Scene): void {
		// 1. Sync Quintus node tree → Three.js scene graph
		this._walkSync(scene, this.ctx.scene);

		// 2. Determine active camera
		const camera = this.ctx.activeCamera ?? this._getDefaultCamera();

		// 3. Render the Three.js scene
		this.ctx.webglRenderer.render(this.ctx.scene, camera);

		// 4. Render 2D overlay (renderFixed Node2D nodes)
		this._renderOverlay(scene);
	}

	resize(width: number, height: number): void {
		this.ctx.webglRenderer.setSize(width, height, false);
		if (this.overlayCanvas) {
			this.overlayCanvas.width = width;
			this.overlayCanvas.height = height;
		}
	}

	dispose(): void {
		if (this.overlayCanvas?.parentElement) {
			this.overlayCanvas.remove();
		}
	}

	// === Internal: Tree Sync ===

	private _walkSync(node: Node, threeParent: THREE.Object3D): void {
		if (node instanceof Node3D) {
			const prevParent = this.parentMap.get(node);
			if (prevParent !== threeParent) {
				if (prevParent) prevParent.remove(node.object3d);
				threeParent.add(node.object3d);
				this.parentMap.set(node, threeParent);
			}

			for (const child of node.children) {
				this._walkSync(child, node.object3d);
			}
		} else {
			for (const child of node.children) {
				this._walkSync(child, threeParent);
			}
		}
	}

	private _getDefaultCamera(): THREE.Camera {
		if (!this._fallbackCamera) {
			this._fallbackCamera = new THREE.PerspectiveCamera(
				75,
				this.ctx.webglRenderer.domElement.width / this.ctx.webglRenderer.domElement.height,
				0.1,
				1000,
			);
			this._fallbackCamera.position.set(0, 5, 10);
			this._fallbackCamera.lookAt(0, 0, 0);
		}
		return this._fallbackCamera;
	}

	// === Internal: 2D Overlay ===

	private _renderOverlay(scene: Scene): void {
		const overlayNodes: Node2D[] = [];
		this._collectOverlayNodes(scene, overlayNodes);

		if (overlayNodes.length === 0) {
			if (this.overlayCanvas) this.overlayCanvas.style.display = "none";
			return;
		}

		if (!this.overlayCanvas) {
			this.overlayCanvas = document.createElement("canvas");
			const webglCanvas = this.ctx.webglRenderer.domElement;
			this.overlayCanvas.width = webglCanvas.width;
			this.overlayCanvas.height = webglCanvas.height;

			let container = webglCanvas.parentElement;
			if (!container?.dataset.threeOverlayContainer) {
				container = document.createElement("div");
				container.dataset.threeOverlayContainer = "1";
				container.style.cssText = "position: relative; width: 100%; height: 100%;";
				webglCanvas.parentElement?.insertBefore(container, webglCanvas);
				container.appendChild(webglCanvas);
			}
			this.overlayCanvas.style.cssText =
				"position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;";
			container.appendChild(this.overlayCanvas);
			const ctx2d = this.overlayCanvas.getContext("2d");
			if (!ctx2d) return;
			this.overlayDrawContext = new Canvas2DDrawContext(ctx2d, scene.game.assets);
		}

		this.overlayCanvas.style.display = "";
		const drawCtx = this.overlayDrawContext;
		if (!drawCtx) return;

		const ctx2d = drawCtx.ctx;
		ctx2d.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);

		overlayNodes.sort((a, b) => a.zIndex - b.zIndex);
		for (const node of overlayNodes) {
			ctx2d.save();
			const t = node.globalTransform;
			ctx2d.setTransform(t.a, t.b, t.c, t.d, t.e, t.f);
			if (node.alpha < 1) ctx2d.globalAlpha = node.alpha;
			node.onDraw(drawCtx);
			ctx2d.restore();
		}
	}

	private _warnedNode2DIds = new Set<number>();

	private _collectOverlayNodes(node: Node, list: Node2D[]): void {
		if (node instanceof Node2D && node.visible) {
			if (node.renderFixed) {
				list.push(node);
			} else if (!this._warnedNode2DIds.has(node.id)) {
				this._warnedNode2DIds.add(node.id);
				console.warn(
					`Node2D "${node.name || node.constructor.name}" will not render in full-3D mode. ` +
						`Set renderFixed=true for HUD/overlay elements, or use Node3D for 3D content.`,
				);
			}
		}
		for (const child of node.children) {
			this._collectOverlayNodes(child, list);
		}
	}
}
