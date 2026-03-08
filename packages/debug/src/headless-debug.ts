/**
 * Attach the debug bridge to a HeadlessGame and return a command executor.
 */

import { type Game, installDebugBridge } from "@quintus/core";
import { executeCommand } from "./commands.js";
import type { CommandResult } from "./types.js";

/**
 * Install the debug bridge on a game and return a simple command function.
 *
 * @param game - A Game instance (typically HeadlessGame)
 * @returns A function that takes a command string and returns formatted output.
 *
 * @example
 * ```ts
 * const game = new HeadlessGame({ width: 320, height: 240, seed: 42 });
 * game.start(MyScene);
 * const cmd = attachDebug(game);
 * console.log(cmd("tree"));
 * console.log(cmd("step 30"));
 * console.log(cmd("physics Player"));
 * ```
 */
export function attachDebug(game: Game): (command: string) => CommandResult {
	const bridge = installDebugBridge(game);
	return (input: string) => {
		const parts = input.trim().split(/\s+/);
		const command = parts[0] ?? "";
		const args = parts.slice(1);
		return executeCommand(bridge, command, args);
	};
}
