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
		// Update active camera aspect ratio immediately on resize
		if (this.ctx.activeCamera && "aspect" in this.ctx.activeCamera) {
			const cam = this.ctx.activeCamera as THREE.PerspectiveCamera;
			cam.aspect = width / height;
			cam.updateProjectionMatrix();
		}
	}

	dispose(): void {
		if (this.overlayCanvas?.parentElement) {
			this.overlayCanvas.remove();
		}
		// Remove the wrapper div if we created one, restoring the webgl canvas to its original parent
		const webglCanvas = this.ctx.webglRenderer.domElement;
		const container = webglCanvas.parentElement;
		if (container?.dataset.threeOverlayContainer) {
			container.parentElement?.insertBefore(webglCanvas, container);
			container.remove();
		}
	}

	// === Internal: Tree Sync ===

	private _walkSync(node: Node, threeParent: THREE.Object3D): void {
		if (node instanceof Node3D) {
			if (!node._boneParented) {
				// Frozen nodes parent to the scene root regardless of Quintus parent
				const target = node._worldFreeze ? this.ctx.scene : threeParent;
				const prevParent = this.parentMap.get(node);
				if (prevParent !== target) {
					if (prevParent) prevParent.remove(node.object3d);
					target.add(node.object3d);
					this.parentMap.set(node, target);
				}
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

		const webglCanvas = this.ctx.webglRenderer.domElement;

		if (!this.overlayCanvas) {
			this.overlayCanvas = document.createElement("canvas");
			// Use game logical dimensions, not webgl physical pixels (which include devicePixelRatio)
			this.overlayCanvas.width = scene.game.width;
			this.overlayCanvas.height = scene.game.height;
			this.overlayCanvas.style.pointerEvents = "none";
			// Place as sibling right after the webgl canvas (no wrapper div needed)
			webglCanvas.after(this.overlayCanvas);
			const ctx2d = this.overlayCanvas.getContext("2d");
			if (!ctx2d) return;
			this.overlayDrawContext = new Canvas2DDrawContext(ctx2d, scene.game.assets);
		}

		// Sync overlay CSS to match the webgl canvas position and size each frame.
		// The Game's scaling system (fit/fill) sets inline styles on the webgl canvas;
		// we mirror them so the overlay lines up exactly.
		const ws = webglCanvas.style;
		const os = this.overlayCanvas.style;
		os.position = ws.position;
		os.left = ws.left;
		os.top = ws.top;
		os.width = ws.width;
		os.height = ws.height;

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
		if (node instanceof Node2D) {
			if (!node.visible) return; // Skip invisible subtrees (matches Canvas2DRenderer)
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
