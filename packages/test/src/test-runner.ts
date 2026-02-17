import type { Game, NodeSnapshot, Plugin, SceneConstructor } from "@quintus/core";
import { createHeadlessGame, type HeadlessGame } from "@quintus/headless";
import type { InputScript } from "./input-script.js";
import { InputScriptPlayer } from "./input-script-player.js";
import { Timeline } from "./timeline.js";

export interface TestRunOptions {
	/** Scene class to start. */
	scene: SceneConstructor;
	/** RNG seed for deterministic replay. */
	seed: number;
	/** Game width in pixels. Default: 320. */
	width?: number;
	/** Game height in pixels. Default: 240. */
	height?: number;
	/** Fixed timestep in seconds. Default: 1/60. */
	fixedDeltaTime?: number;
	/** Plugins to install (physics, input, tween, etc.). */
	plugins?: Plugin[];
	/** Input script to execute. If omitted, must provide duration. */
	input?: InputScript;
	/** Total duration in seconds. If omitted, uses input script length. */
	duration?: number;
	/**
	 * Snapshot capture interval in frames. Default: 0 (disabled; only final state captured).
	 * Set to 1 for every frame, 60 for every second, etc.
	 */
	snapshotInterval?: number;
	/** Enable debug mode (event logging). Default: false. */
	debug?: boolean;
	/** Async setup callback — called after game creation but before game.start(). */
	setup?: (game: HeadlessGame) => Promise<void> | void;
	/** Synchronous callback called before setup — for global state resets. */
	beforeRun?: () => void;
}

export interface TestResult {
	/** The game instance (still alive — caller can inspect further). */
	game: HeadlessGame;
	/** Total frames stepped. */
	totalFrames: number;
	/** Total elapsed game time in seconds. */
	totalTime: number;
	/** The RNG seed used. */
	seed: number;
	/** Final scene tree snapshot. */
	finalState: NodeSnapshot;
	/** Timeline of recorded snapshots (if snapshotInterval > 0). */
	timeline: Timeline;
}

// biome-ignore lint/complexity/noStaticOnlyClass: Intentional class-based API for consistency
export class TestRunner {
	/**
	 * Run a complete test scenario.
	 *
	 * @example
	 * const result = await TestRunner.run({
	 *   scene: Level1,
	 *   seed: 42,
	 *   plugins: [PhysicsPlugin({ gravity: new Vec2(0, 800) })],
	 *   input: InputScript.create().press("right", 120).tap("jump"),
	 * });
	 */
	static async run(options: TestRunOptions): Promise<TestResult> {
		const {
			scene,
			seed,
			width = 320,
			height = 240,
			fixedDeltaTime = 1 / 60,
			plugins = [],
			input,
			duration,
			snapshotInterval = 0,
			debug = false,
			setup,
			beforeRun,
		} = options;

		// Require at least input or duration
		if (!input && duration == null) {
			throw new Error("TestRunner.run() requires at least `input` or `duration`.");
		}

		// Global state reset
		beforeRun?.();

		// Create game
		const game = createHeadlessGame({
			width,
			height,
			seed,
			fixedDeltaTime,
			plugins,
			debug,
		});

		// Async setup (e.g., asset loading)
		if (setup) await setup(game);

		// Start scene
		game.start(scene);

		// Calculate total frames
		const scriptFrames = input?.totalFrames ?? 0;
		const durationFrames = duration != null ? Math.round(duration / fixedDeltaTime) : 0;
		const totalFrames = Math.max(scriptFrames, durationFrames);

		// Timeline recording
		const timeline = new Timeline();
		const recordSnapshot = (frame: number): void => {
			if (snapshotInterval > 0 && frame % snapshotInterval === 0) {
				const snapshot = game.currentScene?.serialize() ?? null;
				if (snapshot) {
					timeline.record(frame, frame * fixedDeltaTime, snapshot);
				}
			}
		};

		// Record initial state (frame 0)
		recordSnapshot(0);

		// Get input system (duck-typed, no hard dep on @quintus/input)
		const inputSystem = _getInput(game);

		if (input && inputSystem) {
			const player = new InputScriptPlayer();
			player.execute(game, inputSystem, input.steps, recordSnapshot);

			// Run remaining frames if duration extends past the script
			const remaining = totalFrames - player.frame;
			for (let i = 0; i < remaining; i++) {
				game.step();
				recordSnapshot(player.frame + i + 1);
			}
		} else {
			// No input — just step for the duration
			for (let i = 1; i <= totalFrames; i++) {
				game.step();
				recordSnapshot(i);
			}
		}

		// Capture final state
		const finalState = game.currentScene?.serialize() ?? {
			id: -1,
			type: "Empty",
			name: "",
			tags: [],
			children: [],
		};

		return {
			game,
			totalFrames,
			totalTime: totalFrames * fixedDeltaTime,
			seed,
			finalState,
			timeline,
		};
	}
}

/** Duck-typed input accessor — avoids hard dependency on @quintus/input. */
function _getInput(game: Game): {
	inject: (a: string, p: boolean) => void;
	injectAnalog: (a: string, v: number) => void;
} | null {
	if (!game.hasPlugin("input")) return null;
	return (
		(
			game as unknown as {
				input?: {
					inject: (a: string, p: boolean) => void;
					injectAnalog: (a: string, v: number) => void;
				};
			}
		).input ?? null
	);
}
