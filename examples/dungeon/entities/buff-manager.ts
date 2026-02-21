import { Node } from "@quintus/core";
import { gameState } from "../state.js";

/**
 * Standalone node that ticks down active buff timers each frame.
 * Exposes multiplier getters for Player and other consumers.
 */
export class BuffManager extends Node {
	override onFixedUpdate(dt: number): void {
		if (gameState.activeBuff && gameState.buffTimeRemaining > 0) {
			gameState.buffTimeRemaining -= dt;
			if (gameState.buffTimeRemaining <= 0) {
				gameState.activeBuff = null;
				gameState.buffTimeRemaining = 0;
			}
		}
	}

	get speedMultiplier(): number {
		return gameState.activeBuff?.type === "speed" ? gameState.activeBuff.value : 1;
	}

	get damageMultiplier(): number {
		return gameState.activeBuff?.type === "attack" ? gameState.activeBuff.value : 1;
	}
}
