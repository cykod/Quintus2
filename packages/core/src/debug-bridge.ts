import type { DebugEvent, EventFilter } from "./debug-log.js";
import type { Game } from "./game.js";
import type { Node } from "./node.js";
import type { NodeSnapshot } from "./snapshot-types.js";

/** A single step in a debug script. */
export type DebugAction =
	| { press: string; frames: number }
	| { wait: number }
	| { release: string };

export interface DebugBridge {
	readonly paused: boolean;
	readonly frame: number;
	readonly elapsed: number;
	pause(): void;
	resume(): void;
	step(frames?: number): NodeSnapshot | null;
	tree(): NodeSnapshot | null;
	query(q: string): NodeSnapshot[];
	inspect(nameOrId: string | number): NodeSnapshot | null;
	screenshot(): string;
	listActions(): string[];
	press(action: string): void;
	release(action: string): void;
	releaseAll(): void;
	pressAndStep(action: string, frames: number): NodeSnapshot | null;
	run(script: DebugAction[]): NodeSnapshot[];
	events(filter?: EventFilter): DebugEvent[];
	peekEvents(filter?: EventFilter): DebugEvent[];
	clearEvents(): void;
	log(category: string, message: string, data?: Record<string, unknown>): void;
}

declare global {
	interface Window {
		__quintusDebug?: DebugBridge;
	}
}

interface InputLike {
	actionNames: string[];
	inject(action: string, pressed: boolean): void;
}

/** Get the Input instance from game via module augmentation (if InputPlugin installed). */
function getGameInput(game: Game): InputLike | null {
	if (!game.hasPlugin("input")) return null;
	// InputPlugin adds game.input via module augmentation
	return (game as unknown as { input?: InputLike }).input ?? null;
}

/** Install the debug bridge on `window.__quintusDebug`. */
export function installDebugBridge(game: Game): DebugBridge {
	const heldActions = new Set<string>();

	const bridge: DebugBridge = {
		get paused() {
			return !game.running;
		},
		get frame() {
			return game.fixedFrame;
		},
		get elapsed() {
			return game.elapsed;
		},

		pause() {
			game.pause();
		},
		resume() {
			game.resume();
		},

		step(frames = 1) {
			for (let i = 0; i < frames; i++) game.step();
			return game.currentScene?.serialize() ?? null;
		},

		tree() {
			return game.currentScene?.serialize() ?? null;
		},

		query(q: string): NodeSnapshot[] {
			const scene = game.currentScene;
			if (!scene) return [];
			return collectMatchingNodes(scene, q);
		},

		inspect(nameOrId: string | number): NodeSnapshot | null {
			const scene = game.currentScene;
			if (!scene) return null;
			const node =
				typeof nameOrId === "number"
					? findNodeById(scene, nameOrId)
					: findNodeByName(scene, nameOrId);
			return node?.serialize() ?? null;
		},

		screenshot() {
			return game.screenshot();
		},

		listActions(): string[] {
			const input = getGameInput(game);
			return input?.actionNames ?? [];
		},

		press(action: string) {
			heldActions.add(action);
			getGameInput(game)?.inject(action, true);
		},

		release(action: string) {
			heldActions.delete(action);
			getGameInput(game)?.inject(action, false);
		},

		releaseAll() {
			const input = getGameInput(game);
			if (!input) return;
			for (const action of heldActions) {
				input.inject(action, false);
			}
			heldActions.clear();
		},

		pressAndStep(action: string, frames: number) {
			bridge.press(action);
			const result = bridge.step(frames);
			bridge.release(action);
			return result;
		},

		run(script: DebugAction[]): NodeSnapshot[] {
			const snapshots: NodeSnapshot[] = [];
			for (const action of script) {
				if ("press" in action) {
					bridge.press(action.press);
					bridge.step(action.frames);
					bridge.release(action.press);
				} else if ("wait" in action) {
					bridge.step(action.wait);
				} else if ("release" in action) {
					bridge.release(action.release);
					bridge.step(1);
				}
				const snap = bridge.tree();
				if (snap) snapshots.push(snap);
			}
			return snapshots;
		},

		events(filter?: EventFilter) {
			return game.debugLog.drain(filter);
		},

		peekEvents(filter?: EventFilter) {
			return game.debugLog.peek(filter);
		},

		clearEvents() {
			game.debugLog.clear();
		},

		log(category: string, message: string, data?: Record<string, unknown>) {
			game.debugLog.write({ category, message, data }, game.fixedFrame, game.elapsed);
		},
	};

	if (typeof window !== "undefined") {
		window.__quintusDebug = bridge;
	}

	return bridge;
}

/** Walk the tree to find a node by numeric id. */
function findNodeById(node: Node, id: number): Node | null {
	if (node.id === id) return node;
	for (const child of node.children) {
		const found = findNodeById(child, id);
		if (found) return found;
	}
	return null;
}

/** Walk the tree to find a node by name. */
function findNodeByName(node: Node, name: string): Node | null {
	if (node.name === name) return node;
	for (const child of node.children) {
		const found = findNodeByName(child, name);
		if (found) return found;
	}
	return null;
}

/** Collect all nodes matching a query by constructor name, node name, or tag. */
function collectMatchingNodes(root: Node, q: string): NodeSnapshot[] {
	const results: NodeSnapshot[] = [];
	walkAndMatch(root, q, results);
	return results;
}

function walkAndMatch(node: Node, q: string, results: NodeSnapshot[]): void {
	if (node.constructor.name === q || node.name === q || node.hasTag(q)) {
		results.push(node.serialize());
	}
	for (const child of node.children) {
		walkAndMatch(child, q, results);
	}
}
