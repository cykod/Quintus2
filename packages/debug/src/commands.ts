/**
 * Programmatic command executor for the debug bridge.
 * Maps command strings to bridge calls + formatters.
 */

import type { DebugBridge } from "@quintus/core";
import {
	formatEvents,
	formatJumpAnalysis,
	formatLayout,
	formatNearby,
	formatPhysics,
	formatQueryResults,
	formatTrack,
	formatTree,
} from "./formatters.js";
import type { CommandResult } from "./types.js";

function ok(output: string): CommandResult {
	return { ok: true, output };
}

function err(output: string): CommandResult {
	return { ok: false, output };
}

/**
 * Execute a debug command against a bridge instance.
 *
 * @param bridge - The debug bridge to execute against
 * @param command - Command name (e.g. "tree", "step", "physics")
 * @param args - Command arguments as string array
 * @returns CommandResult with ok status and formatted output
 */
export function executeCommand(
	bridge: DebugBridge,
	command: string,
	args: string[] = [],
): CommandResult {
	switch (command) {
		case "status":
			return ok(
				`Frame: ${bridge.frame}  Elapsed: ${bridge.elapsed.toFixed(3)}s  Paused: ${bridge.paused}`,
			);

		case "tree": {
			const snap = bridge.tree();
			if (!snap) return ok("(no scene)");
			return ok(formatTree(snap));
		}

		case "layout": {
			const snap = bridge.tree();
			if (!snap) return ok("(no scene)");
			return ok(formatLayout(snap));
		}

		case "inspect": {
			const target = args[0];
			if (!target) return err("Usage: inspect <name|id>");
			let snap = bridge.inspect(target);
			if (!snap) {
				const numId = Number(target);
				if (!Number.isNaN(numId)) snap = bridge.inspect(numId);
			}
			if (!snap) return err(`Node not found: ${target}`);
			return ok(JSON.stringify(snap, null, 2));
		}

		case "query": {
			const q = args[0];
			if (!q) return err("Usage: query <type|name|tag>");
			const results = bridge.query(q);
			return ok(formatQueryResults(results, q));
		}

		case "physics": {
			const target = args[0];
			if (!target) return err("Usage: physics <name>");
			const snap = bridge.inspect(target);
			if (!snap) return err(`Node not found: ${target}`);
			return ok(formatPhysics(snap));
		}

		case "step": {
			const n = args[0] ? parseInt(args[0], 10) : 1;
			bridge.step(n);
			return ok(
				`Stepped ${n} frame(s). Now at frame ${bridge.frame}  Elapsed: ${bridge.elapsed.toFixed(3)}s`,
			);
		}

		case "pause":
			bridge.pause();
			return ok(`Paused at frame ${bridge.frame}`);

		case "resume":
			bridge.resume();
			return ok(`Resumed from frame ${bridge.frame}`);

		case "scenes": {
			const names = bridge.listScenes();
			if (names.length === 0) return ok("(no scenes registered)");
			return ok(`Registered scenes:\n${names.map((n) => `  - ${n}`).join("\n")}`);
		}

		case "scene": {
			const name = args[0];
			if (!name) return err("Usage: scene <name>");
			bridge.switchScene(name);
			return ok(`Switched to scene: ${name}. Frame: ${bridge.frame}`);
		}

		case "actions": {
			const actions = bridge.listActions();
			if (actions.length === 0) return ok("(no input actions registered)");
			return ok(`Available actions:\n${actions.map((a) => `  - ${a}`).join("\n")}`);
		}

		case "press": {
			const action = args[0];
			if (!action) return err("Usage: press <action>");
			bridge.press(action);
			return ok(`Pressed: ${action}`);
		}

		case "release": {
			const action = args[0];
			if (!action) return err("Usage: release <action>");
			bridge.release(action);
			return ok(`Released: ${action}`);
		}

		case "release-all":
			bridge.releaseAll();
			return ok("All actions released.");

		case "tap": {
			const action = args[0];
			if (!action) return err("Usage: tap <action> [frames]");
			const frames = args[1] ? parseInt(args[1], 10) : 1;
			bridge.pressAndStep(action, frames);
			return ok(`Tapped ${action} for ${frames} frame(s). Now at frame ${bridge.frame}`);
		}

		case "click": {
			const x = args[0] ? parseFloat(args[0]) : NaN;
			const y = args[1] ? parseFloat(args[1]) : NaN;
			if (Number.isNaN(x) || Number.isNaN(y)) return err("Usage: click <x> <y>");
			const hit = bridge.click(x, y);
			return ok(hit ? `Clicked at (${x}, ${y})` : `No interactive node at (${x}, ${y})`);
		}

		case "click-button": {
			const name = args[0];
			if (!name) return err("Usage: click-button <name|text>");
			const found = bridge.clickButton(name);
			return ok(found ? `Clicked button: ${name}` : `Button not found: ${name}`);
		}

		case "destroy": {
			const target = args[0];
			if (!target) return err("Usage: destroy <name|id|type|tag>");
			const numKey = Number(target);
			const count = Number.isNaN(numKey) ? bridge.destroy(target) : bridge.destroy(numKey);
			if (count === 0) return ok(`No nodes matched: ${target}`);
			return ok(`Destroyed ${count} node(s) matching: ${target}`);
		}

		case "run": {
			const json = args[0];
			if (!json) return err("Usage: run '<json>'");
			try {
				const script = JSON.parse(json) as import("@quintus/core").DebugAction[];
				const snaps = bridge.run(script);
				return ok(
					`Ran ${script.length} action(s), ${snaps.length} snapshot(s). Frame: ${bridge.frame}`,
				);
			} catch (e) {
				return err(`Invalid JSON: ${(e as Error).message}`);
			}
		}

		case "events": {
			const filter = parseEventFilter(args);
			const events = bridge.events(Object.keys(filter).length > 0 ? filter : undefined);
			return ok(formatEvents(events));
		}

		case "peek": {
			const filter = parseEventFilter(args);
			const events = bridge.peekEvents(Object.keys(filter).length > 0 ? filter : undefined);
			return ok(formatEvents(events));
		}

		case "clear-events":
			bridge.clearEvents();
			return ok("Events cleared.");

		case "track": {
			const target = args[0];
			if (!target) return err("Usage: track <name> [frames]");
			const frames = args[1] ? parseInt(args[1], 10) : 30;
			const result = bridge.track(target, frames);
			return ok(formatTrack(result));
		}

		case "jump-analysis": {
			const target = args[0];
			if (!target) return err("Usage: jump-analysis <name>");
			const result = bridge.jumpAnalysis(target);
			if (typeof result === "string") return err(result);
			return ok(formatJumpAnalysis(result, target));
		}

		case "move-to": {
			const target = args[0];
			const actionsStr = args[1];
			const txStr = args[2];
			const tyStr = args[3];
			if (!target || !actionsStr || !txStr || !tyStr) {
				return err("Usage: move-to <node> <actions> <x> <y> [--max=N]");
			}
			const actions = actionsStr.split(",");
			const targetX = txStr === "-" ? null : parseFloat(txStr);
			const targetY = tyStr === "-" ? null : parseFloat(tyStr);
			let maxFrames = 600;
			for (const a of args.slice(4)) {
				if (a.startsWith("--max=")) maxFrames = parseInt(a.slice(6), 10);
			}
			const result = bridge.moveTo({ target, actions, targetX, targetY, maxFrames });
			if (typeof result === "string") return err(result);
			const floor = result.onFloor ? " [floor]" : "";
			if (result.reached) {
				return ok(
					`Reached (${result.endX.toFixed(2)}, ${result.endY.toFixed(2)}) in ${result.frames} frames. vel=(${result.endVx.toFixed(2)}, ${result.endVy.toFixed(2)})${floor}  Frame: ${result.bridgeFrame}`,
				);
			}
			return ok(
				`Stopped at (${result.endX.toFixed(2)}, ${result.endY.toFixed(2)}) after ${result.frames} frames (limit). vel=(${result.endVx.toFixed(2)}, ${result.endVy.toFixed(2)})${floor}  Frame: ${result.bridgeFrame}`,
			);
		}

		case "nearby": {
			const target = args[0];
			if (!target) return err("Usage: nearby <name> [radius]");
			const radius = args[1] ? parseFloat(args[1]) : 100;
			const result = bridge.nearby(target, radius);
			if (typeof result === "string") return err(result);
			return ok(formatNearby(result));
		}

		case "mouse": {
			const x = args[0] ? parseFloat(args[0]) : NaN;
			const y = args[1] ? parseFloat(args[1]) : NaN;
			if (Number.isNaN(x) || Number.isNaN(y)) return err("Usage: mouse <x> <y>");
			bridge.setMousePosition(x, y);
			return ok(`Mouse position set to (${x}, ${y})`);
		}

		case "mouse-get": {
			const pos = bridge.getMousePosition();
			return ok(`Mouse position: (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)})`);
		}

		default:
			return err(`Unknown command: ${command}`);
	}
}

function parseEventFilter(args: string[]): import("@quintus/core").EventFilter {
	const filter: import("@quintus/core").EventFilter = {};
	for (const arg of args) {
		if (arg.startsWith("--category=")) filter.category = arg.slice(11);
		else if (arg.startsWith("--search=")) filter.search = arg.slice(9);
		else if (arg.startsWith("--limit=")) filter.limit = parseInt(arg.slice(8), 10);
		else if (arg.startsWith("--from=")) filter.fromFrame = parseInt(arg.slice(7), 10);
		else if (arg.startsWith("--to=")) filter.toFrame = parseInt(arg.slice(5), 10);
	}
	return filter;
}
