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
	private _model: THREE.Object3D | null = null;
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

	/**
	 * Play a named animation once, then call onComplete.
	 * The animation crossfades in/out like `play()` but automatically
	 * stops when finished.
	 */
	playOneShot(name: string, onComplete?: () => void): void {
		const clip = this._animations.get(name);
		if (!clip || !this._mixer) {
			onComplete?.();
			return;
		}

		if (this._currentAction) {
			this._currentAction.fadeOut(0.3);
		}

		const action = this._mixer.clipAction(clip);
		action.setLoop(THREE.LoopOnce, 1);
		action.clampWhenFinished = true;
		action.reset().fadeIn(0.3).play();
		this._currentAction = action;

		if (onComplete) {
			const handler = (e: { action: THREE.AnimationAction }) => {
				if (e.action === action) {
					this._mixer?.removeEventListener("finished", handler);
					onComplete();
				}
			};
			this._mixer.addEventListener("finished", handler);
		}
	}

	/** Stop all animations. */
	stop(): void {
		this._mixer?.stopAllAction();
		this._currentAction = null;
	}

	/**
	 * Find a bone/joint in the loaded model by name.
	 * Returns the Object3D if found, or null.
	 */
	findBone(name: string): THREE.Object3D | null {
		return this._model?.getObjectByName(name) ?? null;
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
			this._mixer = null;
		}
		this._currentAction = null;
		this._model = null;
		this._animations.clear();

		// Remove the cloned scene from the 3D parent but do NOT dispose
		// geometry, materials, or textures — SkeletonUtils.clone shares
		// these with the original GLTF asset and other clones.
		// Disposing here would break all other instances of the same model.
		for (const child of [...this.object3d.children]) {
			this.object3d.remove(child);
		}
	}

	private _applyModel(gltf: GLTF): void {
		const model = SkeletonUtils.clone(gltf.scene);
		this._model = model;
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
