import * as THREE from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import { Node3D } from "./node3d.js";

export class GLTFModel extends Node3D {
	/**
	 * Asset name — the key used in the asset system.
	 * AssetLoader strips directory prefix and file extension,
	 * so "models/character.glb" becomes "character".
	 */
	src = "";
	/** Auto-play the first animation. Default: false. */
	autoplay = false;
	/** Scale multiplier applied to the loaded model. Default: 1. */
	modelScale = 1;
	/** Cast shadows on all child meshes. Default: false. */
	castShadow = false;
	/** Receive shadows on all child meshes. Default: false. */
	receiveShadow = false;

	private _mixer: THREE.AnimationMixer | null = null;
	private _animations: Map<string, THREE.AnimationClip> = new Map();
	private _currentAction: THREE.AnimationAction | null = null;
	private _loaded = false;

	get loaded(): boolean {
		return this._loaded;
	}

	/** Available animation names after loading. */
	get animationNames(): string[] {
		return Array.from(this._animations.keys());
	}

	/** Play a named animation. */
	play(name: string, loop = true): void {
		const clip = this._animations.get(name);
		if (!clip || !this._mixer) return;

		if (this._currentAction) {
			this._currentAction.fadeOut(0.3);
		}

		const action = this._mixer.clipAction(clip);
		action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
		action.reset().fadeIn(0.3).play();
		this._currentAction = action;
	}

	/** Stop all animations. */
	stop(): void {
		this._mixer?.stopAllAction();
		this._currentAction = null;
	}

	override onReady(): void {
		if (!this.src) return;

		const gltf = this.game.assets.get<GLTF>(this.src);
		if (!gltf) {
			console.warn(
				`GLTFModel: asset "${this.src}" not found. ` +
					`Ensure asset was preloaded and src uses the stripped name ` +
					`(e.g., "character" for "models/character.glb").`,
			);
			return;
		}
		this._applyModel(gltf);
	}

	override onUpdate(dt: number): void {
		this._mixer?.update(dt);
	}

	override onDestroy(): void {
		if (this._mixer) {
			this._mixer.stopAllAction();
		}
		this._disposeRecursive(this.object3d);
	}

	private _disposeRecursive(obj: THREE.Object3D): void {
		for (const child of [...obj.children]) {
			this._disposeRecursive(child);
		}
		if (obj instanceof THREE.Mesh) {
			obj.geometry?.dispose();
			const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
			for (const mat of mats) {
				for (const value of Object.values(mat)) {
					if (value instanceof THREE.Texture) value.dispose();
				}
				mat.dispose();
			}
		}
	}

	private _applyModel(gltf: GLTF): void {
		const model = SkeletonUtils.clone(gltf.scene);
		if (this.modelScale !== 1) {
			model.scale.setScalar(this.modelScale);
		}
		this.object3d.add(model);

		model.traverse((child) => {
			if (child instanceof THREE.Mesh) {
				child.castShadow = this.castShadow;
				child.receiveShadow = this.receiveShadow;
			}
		});

		if (gltf.animations.length > 0) {
			this._mixer = new THREE.AnimationMixer(model);
			for (const clip of gltf.animations) {
				this._animations.set(clip.name, clip);
			}
			if (this.autoplay) {
				const first = gltf.animations[0];
				if (first) this.play(first.name);
			}
		}

		this._loaded = true;
	}
}
