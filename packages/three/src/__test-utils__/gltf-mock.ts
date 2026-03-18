import * as THREE from "three";

/** Mock GLTFLoader factory for vi.mock */
export const GLTF_LOADER_MOCK = {
	GLTFLoader: class {
		loadAsync() {
			return Promise.resolve({});
		}
	},
};

/** Mock SkeletonUtils factory for vi.mock */
export const SKELETON_UTILS_MOCK = {
	clone: (_scene: unknown) => {
		return new THREE.Object3D();
	},
};

/**
 * Create a mock GLTF asset suitable for game.assets._storeCustom().
 * @param animations - array of {name, duration} for AnimationClip mocks
 */
export function mockGLTFAsset(animations: Array<{ name: string; duration?: number }> = []): {
	scene: THREE.Object3D;
	animations: THREE.AnimationClip[];
} {
	return {
		scene: new THREE.Object3D(),
		animations: animations.map((a) => new THREE.AnimationClip(a.name, a.duration ?? 1)),
	};
}
