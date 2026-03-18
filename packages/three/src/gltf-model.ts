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

	/** Y-axis rotation applied to the inner model root after load. Default: 0. */
	modelRotation = 0;

	/**
	 * Shorthand: when true, sets modelRotation = Math.PI so the model faces
	 * the opposite direction. Useful for GLTF models that face +Z by default.
	 */
	flipModel = false;

	private _mixer: THREE.AnimationMixer | null = null;
	private _animations: Map<string, THREE.AnimationClip> = new Map();
	private _currentAction: THREE.AnimationAction | null = null;
	private _model: THREE.Object3D | null = null;
	private _loaded = false;
	private _originalEmissives: Map<THREE.Material, { r: number; g: number; b: number }> = new Map();
	private _materialsCloned = false;

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
	playOneShot(name: string, onComplete?: () => void, timeScale = 1): void {
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
		action.timeScale = timeScale;
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

	/**
	 * Clone all materials in the model hierarchy so per-instance effects
	 * (emissive, opacity) don't affect other instances sharing the same asset.
	 * Safe to call multiple times — only clones once.
	 */
	cloneMaterials(): void {
		if (this._materialsCloned || !this._model) return;
		this._materialsCloned = true;
		this._model.traverse((child) => {
			if (child instanceof THREE.Mesh && child.material) {
				if (Array.isArray(child.material)) {
					child.material = child.material.map((m: THREE.Material) => {
						const cloned = m.clone();
						return cloned;
					});
				} else {
					child.material = child.material.clone();
				}
			}
		});
	}

	/**
	 * Set emissive color on all MeshStandardMaterial in the model.
	 * Auto-calls cloneMaterials() if needed to avoid affecting other instances.
	 */
	setEmissive(color: THREE.Color | { r: number; g: number; b: number }): void {
		if (!this._model) return;
		if (!this._materialsCloned) this.cloneMaterials();

		// Save originals on first call
		if (this._originalEmissives.size === 0) {
			for (const mat of this.getMaterials()) {
				const std = mat as THREE.MeshStandardMaterial;
				if (std.emissive) {
					this._originalEmissives.set(mat, {
						r: std.emissive.r,
						g: std.emissive.g,
						b: std.emissive.b,
					});
				}
			}
		}

		for (const [mat] of this._originalEmissives) {
			const std = mat as THREE.MeshStandardMaterial;
			std.emissive.r = color.r;
			std.emissive.g = color.g;
			std.emissive.b = color.b;
		}
	}

	/**
	 * Reset emissive to original values (before setEmissive was called).
	 */
	resetEmissive(): void {
		for (const [mat, original] of this._originalEmissives) {
			const std = mat as THREE.MeshStandardMaterial;
			std.emissive.r = original.r;
			std.emissive.g = original.g;
			std.emissive.b = original.b;
		}
	}

	/**
	 * Set opacity on all materials in the model.
	 */
	setOpacity(opacity: number): void {
		if (!this._model) return;
		if (!this._materialsCloned) this.cloneMaterials();

		for (const mat of this.getMaterials()) {
			(mat as THREE.MeshStandardMaterial).opacity = opacity;
			(mat as THREE.MeshStandardMaterial).transparent = opacity < 1;
		}
	}

	/**
	 * Get a flat array of all materials in the model hierarchy.
	 */
	getMaterials(): THREE.Material[] {
		const materials: THREE.Material[] = [];
		if (!this._model) return materials;
		this._model.traverse((child) => {
			if (child instanceof THREE.Mesh && child.material) {
				if (Array.isArray(child.material)) {
					for (const m of child.material) materials.push(m);
				} else {
					materials.push(child.material);
				}
			}
		});
		return materials;
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

		// Apply model orientation
		if (this.flipModel) {
			this.modelRotation = Math.PI;
		}
		if (this.modelRotation !== 0) {
			model.rotation.y = this.modelRotation;
		}

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
