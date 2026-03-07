import type { DrawContext, Node } from "@quintus/core";
import { Node2D } from "@quintus/core";
import * as THREE from "three";
import { Node3D } from "./node3d.js";
import { getThreeContext } from "./three-plugin.js";

export class ThreeLayer extends Node2D {
	/** The Three.js scene for this layer's 3D content. */
	readonly threeScene: THREE.Scene;

	/** The camera for this layer. Set by a child Camera3D or manually. */
	camera: THREE.Camera | null = null;

	private _clearColor: THREE.Color;
	private _clearAlpha: number;
	/** Cached last setSize values to avoid calling setSize every frame. */
	private _lastSetW = 0;
	private _lastSetH = 0;

	constructor() {
		super();
		this.threeScene = new THREE.Scene();
		this._clearColor = new THREE.Color(0x000000);
		this._clearAlpha = 0;
	}

	override onUpdate(_dt: number): void {
		this._syncChildren();
	}

	override onDraw(ctx: DrawContext): void {
		const threeCtx = this.gameOrNull ? getThreeContext(this.game) : null;
		if (!threeCtx) return;

		const camera = this.camera ?? this._findChildCamera();
		if (!camera) return;

		const renderer = threeCtx.webglRenderer;
		const w = this.game.width;
		const h = this.game.height;

		if (w !== this._lastSetW || h !== this._lastSetH) {
			renderer.setSize(w, h, false);
			this._lastSetW = w;
			this._lastSetH = h;
		}
		renderer.setClearColor(this._clearColor, this._clearAlpha);
		renderer.clear();
		renderer.render(this.threeScene, camera);

		ctx.drawCanvas?.(renderer.domElement, 0, 0);
	}

	override onDestroy(): void {
		this.threeScene.clear();
	}

	private _syncChildren(): void {
		for (const child of this.children) {
			this._syncNode(child, this.threeScene);
		}
	}

	private _syncNode(node: Node, parent: THREE.Object3D): void {
		if (node instanceof Node3D) {
			if (node.object3d.parent !== parent) {
				parent.add(node.object3d);
			}
			for (const child of node.children) {
				this._syncNode(child, node.object3d);
			}
		} else {
			for (const child of node.children) {
				this._syncNode(child, parent);
			}
		}
	}

	private _findChildCamera(): THREE.Camera | null {
		for (const child of this.children) {
			if (child instanceof Node3D && child.object3d instanceof THREE.Camera) {
				return child.object3d;
			}
		}
		return null;
	}
}
