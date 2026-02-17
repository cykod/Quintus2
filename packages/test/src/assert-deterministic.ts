import { _resetNodeIdCounter } from "@quintus/core";
import { diffSnapshots, formatDiffs } from "@quintus/snapshot";
import type { TestResult, TestRunOptions } from "./test-runner.js";
import { TestRunner } from "./test-runner.js";

/**
 * Run the same test N times and verify all runs produce identical final state.
 *
 * Resets node ID counter before each run for consistent IDs.
 * Uses diffSnapshots() for clear error reporting on failure.
 *
 * @param options - TestRunner options (seed is required for determinism)
 * @param runs - Number of times to run. Default: 3.
 * @throws Error if any run produces a different final state.
 */
export async function assertDeterministic(options: TestRunOptions, runs = 3): Promise<void> {
	const results: TestResult[] = [];

	for (let i = 0; i < runs; i++) {
		_resetNodeIdCounter();
		results.push(await TestRunner.run(options));
	}

	// biome-ignore lint/style/noNonNullAssertion: guaranteed by loop above
	const baseline = results[0]!;
	for (let i = 1; i < results.length; i++) {
		// biome-ignore lint/style/noNonNullAssertion: loop bounds ensure index is valid
		const current = results[i]!;
		const diffs = diffSnapshots(baseline.finalState, current.finalState);
		if (diffs.length > 0) {
			// Clean up all game instances before throwing
			for (const result of results) {
				result.game.stop();
			}
			throw new Error(
				`Determinism failure: run ${i + 1} differs from run 1.\n` +
					`${formatDiffs(diffs)}\n` +
					`Seed: ${options.seed}, Duration: ${options.duration ?? "script-length"}`,
			);
		}
	}

	// Clean up game instances
	for (const result of results) {
		result.game.stop();
	}
}
