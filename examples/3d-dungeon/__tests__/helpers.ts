import { _resetNodeIdCounter } from "@quintus/core";
import { gameState } from "../state.js";

export const THREE_MOCK_PATH = "../../../packages/three/src/__test-utils__/three-mock.js";

export function resetState(): void {
	gameState.reset();
	_resetNodeIdCounter();
}
