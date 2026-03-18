import { _resetNodeIdCounter } from "@quintus/core";

export {
	createTestGame3D,
	GLTF_LOADER_MOCK,
	mockGLTFAsset,
	SKELETON_UTILS_MOCK,
} from "@quintus/three/test-utils";

import { gameState } from "../state.js";

export const THREE_MOCK_PATH = "../../../packages/three/src/__test-utils__/three-mock.js";

export function resetState(): void {
	gameState.reset();
	_resetNodeIdCounter();
}
