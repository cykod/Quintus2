import type { NodeSnapshot } from "@quintus/core";

/**
 * A complete snapshot of game state at a point in time.
 * Captures the scene tree plus engine metadata for replay/comparison.
 */
export interface StateSnapshot {
	/** Frame number when this snapshot was taken. */
	frame: number;
	/** Game time in seconds. */
	time: number;
	/** RNG seed used for this game run. */
	seed: number;
	/** Current RNG state (for resuming deterministic replay from this point). */
	rngState: number;
	/** The complete scene tree. */
	tree: NodeSnapshot;
}

/**
 * Capture a StateSnapshot from a running game.
 */
export function captureState(game: {
	fixedFrame: number;
	elapsed: number;
	random: { seed: number; state: number };
	currentScene: { serialize(): NodeSnapshot } | null;
}): StateSnapshot | null {
	const scene = game.currentScene;
	if (!scene) return null;
	return {
		frame: game.fixedFrame,
		time: game.elapsed,
		seed: game.random.seed,
		rngState: game.random.state,
		tree: scene.serialize(),
	};
}
