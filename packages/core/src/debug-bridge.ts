import { formatEvents, formatTree } from "./debug-format.js";
import type { DebugEvent, EventFilter } from "./debug-log.js";
import type {
	JumpAnalysisResult,
	MoveToOptions,
	MoveToResult,
	NearbyResult,
	TrackResult,
} from "./debug-types.js";
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
	/** Dispatch a pointer click at game-space coordinates. */
	click(x: number, y: number): boolean;
	/** Find and click a UI button by node name or text label. */
	clickButton(nameOrText: string): boolean;
	/** Switch to a registered scene by name. */
	switchScene(name: string): void;
	/** List registered scene names. */
	listScenes(): string[];
	/** Destroy one or more nodes by name, id, type, or tag. Returns count of destroyed nodes. */
	destroy(nameOrId: string | number): number;
	/** Override the mouse/pointer position in game-space coordinates. */
	setMousePosition(x: number, y: number): void;
	/** Get the current mouse/pointer position. */
	getMousePosition(): { x: number; y: number };
	/** Track a node's position/velocity over N frames. */
	track(target: string, frames?: number): TrackResult;
	/** Perform a full jump analysis (press jump, measure arc). */
	jumpAnalysis(target: string): JumpAnalysisResult | string;
	/** Hold actions until node reaches a position threshold. */
	moveTo(options: MoveToOptions): MoveToResult | string;
	/** Find nodes near a target node within a radius. */
	nearby(target: string, radius?: number): NearbyResult | string;
	/** Get 3D transform details for a Node3D. */
	transform(nameOrId: string | number): Record<string, unknown> | string;
	/** Get active 3D camera info. */
	camera3d(): Record<string, unknown> | string;
	/** Get all lights in the 3D scene. */
	lights(): Record<string, unknown>[];
	/** Get material info for a node's 3D meshes. */
	material(nameOrId: string | number): Record<string, unknown>[] | string;
	/** Get Three.js renderer stats (draw calls, triangles, etc.). */
	stats3d(): Record<string, unknown> | string;
}

export interface DebugFormatters {
	formatTree: typeof formatTree;
	formatEvents: typeof formatEvents;
	formatLayout: (snapshot: NodeSnapshot) => string;
	formatPhysics: (snapshot: NodeSnapshot) => string;
	formatQueryResults: (results: NodeSnapshot[], query: string) => string;
	formatTrack: (result: TrackResult) => string;
	formatJumpAnalysis: (result: JumpAnalysisResult, nodeName: string) => string;
	formatNearby: (result: NearbyResult) => string;
	formatTransform: (data: Record<string, unknown>) => string;
	formatCamera3D: (data: Record<string, unknown>) => string;
	formatLights: (data: Record<string, unknown>[]) => string;
	formatMaterial: (data: Record<string, unknown>[]) => string;
	formatStats3D: (data: Record<string, unknown>) => string;
}

declare global {
	interface Window {
		__quintusDebug?: DebugBridge;
		__quintusFormatters?: DebugFormatters;
	}
}

interface InputLike {
	actionNames: string[];
	inject(action: string, pressed: boolean): void;
	_setMousePosition(x: number, y: number): void;
	mousePosition: { x: number; y: number };
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

		click(x: number, y: number): boolean {
			const scene = game.currentScene;
			if (!scene) return false;
			const nodes = collectClickableNodes(scene);

			// Find topmost interactive node at (x, y)
			let target: ClickableNode | null = null;
			let bestZ = -Infinity;
			for (const node of nodes) {
				if (node.containsPoint(x, y) && node.zIndex >= bestZ) {
					target = node;
					bestZ = node.zIndex;
				}
			}

			if (target) {
				target._onPointerDown(x, y);
				target._onPointerUp(x, y);
				return true;
			}
			return false;
		},

		clickButton(nameOrText: string): boolean {
			const scene = game.currentScene;
			if (!scene) return false;
			const nodes = collectClickableNodes(scene);

			for (const node of nodes) {
				const textProp = (node as unknown as { text?: string }).text;
				if (node.name === nameOrText || textProp === nameOrText) {
					const gp = node.globalPosition;
					const cx = gp.x + node.width / 2;
					const cy = gp.y + node.height / 2;
					node._onPointerDown(cx, cy);
					node._onPointerUp(cx, cy);
					return true;
				}
			}
			return false;
		},

		switchScene(name: string) {
			game._switchScene(name);
			// Render the new scene so the initial state is visible
			game.step();
		},

		listScenes(): string[] {
			return Array.from(
				(game as unknown as { _sceneRegistry: Map<string, unknown> })._sceneRegistry.keys(),
			);
		},

		destroy(nameOrId: string | number): number {
			const scene = game.currentScene;
			if (!scene) return 0;
			const nodes =
				typeof nameOrId === "number"
					? collectById(scene, nameOrId)
					: collectByNameOrTag(scene, nameOrId);
			for (const node of nodes) {
				node.destroy();
			}
			return nodes.length;
		},

		setMousePosition(x: number, y: number) {
			getGameInput(game)?._setMousePosition(x, y);
		},

		getMousePosition(): { x: number; y: number } {
			const input = getGameInput(game);
			if (!input) return { x: 0, y: 0 };
			return { x: input.mousePosition.x, y: input.mousePosition.y };
		},

		track(target: string, frames = 30): TrackResult {
			const trackFrames: TrackResult["frames"] = [];
			for (let i = 0; i < frames; i++) {
				bridge.step(1);
				const s = bridge.inspect(target) as (NodeSnapshot & Record<string, unknown>) | null;
				if (!s) {
					trackFrames.push({
						step: i + 1,
						frame: bridge.frame,
						x: 0,
						y: 0,
						vx: 0,
						vy: 0,
						onFloor: false,
						onWall: false,
						onCeiling: false,
						lost: true,
					});
					break;
				}
				const p = (s.position as { x: number; y: number } | undefined) ?? { x: 0, y: 0 };
				const v = (s.velocity as { x: number; y: number } | undefined) ?? { x: 0, y: 0 };
				trackFrames.push({
					step: i + 1,
					frame: bridge.frame,
					x: p.x,
					y: p.y,
					vx: v.x,
					vy: v.y,
					onFloor: !!s.isOnFloor,
					onWall: !!s.isOnWall,
					onCeiling: !!s.isOnCeiling,
					lost: false,
				});
			}
			return { target, frames: trackFrames };
		},

		jumpAnalysis(target: string): JumpAnalysisResult | string {
			const before = bridge.inspect(target) as (NodeSnapshot & Record<string, unknown>) | null;
			if (!before) return `Node not found: ${target}`;
			if (!before.isOnFloor) return `${target} is not on the floor. Land first, then retry.`;

			const startY = (before.position as { x: number; y: number }).y;
			const startFrame = bridge.frame;
			const gravity = (before.gravity as number) ?? 0;

			bridge.press("jump");
			bridge.step(1);
			bridge.release("jump");

			const afterJump = bridge.inspect(target) as (NodeSnapshot & Record<string, unknown>) | null;
			const jumpVy = afterJump ? (afterJump.velocity as { x: number; y: number }).y : 0;

			let minY = startY;
			let apexFrame = bridge.frame;
			let landFrame = 0;
			const maxFrames = 300;

			for (let i = 0; i < maxFrames; i++) {
				bridge.step(1);
				const s = bridge.inspect(target) as (NodeSnapshot & Record<string, unknown>) | null;
				if (!s) break;
				const py = (s.position as { x: number; y: number }).y;
				if (py < minY) {
					minY = py;
					apexFrame = bridge.frame;
				}
				if (s.isOnFloor && bridge.frame > startFrame + 2) {
					landFrame = bridge.frame;
					break;
				}
			}

			const jumpHeight = startY - minY;
			const totalFrames = landFrame > 0 ? landFrame - startFrame : bridge.frame - startFrame;
			const apexFrameRel = apexFrame - startFrame;
			const airTimeSec = totalFrames / 60;

			const absJumpForce = Math.abs(jumpVy);
			const theoreticalHeight = gravity > 0 ? (absJumpForce * absJumpForce) / (2 * gravity) : 0;
			const theoreticalAirFrames = gravity > 0 ? ((2 * absJumpForce) / gravity) * 60 : 0;

			return {
				startY,
				jumpVy,
				gravity,
				jumpHeight,
				apexFrame: apexFrameRel,
				totalFrames,
				airTimeSec,
				landed: landFrame > 0,
				landFrame,
				theoreticalHeight,
				theoreticalAirFrames,
			};
		},

		moveTo(options: MoveToOptions): MoveToResult | string {
			const { target, actions, targetX, targetY, maxFrames = 600 } = options;
			const snap = bridge.inspect(target) as (NodeSnapshot & Record<string, unknown>) | null;
			if (!snap) return `Node not found: ${target}`;
			if (!snap.position) return `Node has no position: ${target}`;
			if (targetX === null && targetY === null) {
				return 'Error: both x and y are "-". Specify at least one threshold.';
			}

			const startX = (snap.position as { x: number; y: number }).x;
			const startY = (snap.position as { x: number; y: number }).y;

			for (const action of actions) bridge.press(action.trim());

			let reached = false;
			let frames = 0;
			for (frames = 0; frames < maxFrames; frames++) {
				bridge.step(1);
				const s = bridge.inspect(target) as (NodeSnapshot & Record<string, unknown>) | null;
				if (!s) break;
				const px = (s.position as { x: number; y: number }).x;
				const py = (s.position as { x: number; y: number }).y;
				const xOk = targetX === null || (targetX >= startX ? px >= targetX : px <= targetX);
				const yOk = targetY === null || (targetY >= startY ? py >= targetY : py <= targetY);
				if (xOk && yOk) {
					reached = true;
					break;
				}
			}

			for (const action of actions) bridge.release(action.trim());

			const endSnap = bridge.inspect(target) as (NodeSnapshot & Record<string, unknown>) | null;
			const endPos = endSnap?.position as { x: number; y: number } | undefined;
			const endVel = endSnap?.velocity as { x: number; y: number } | undefined;

			return {
				reached,
				frames: reached ? frames + 1 : frames,
				endX: endPos?.x ?? 0,
				endY: endPos?.y ?? 0,
				endVx: endVel?.x ?? 0,
				endVy: endVel?.y ?? 0,
				onFloor: !!endSnap?.isOnFloor,
				bridgeFrame: bridge.frame,
			};
		},

		transform(nameOrId: string | number): Record<string, unknown> | string {
			const scene = game.currentScene;
			if (!scene) return "No scene";
			const node =
				typeof nameOrId === "number"
					? findNodeById(scene, nameOrId)
					: findNodeByName(scene, nameOrId);
			if (!node) return `Node not found: ${nameOrId}`;
			const snap = node.serialize() as Snap;
			const p = _snapPos(snap);
			if (!p) return `Node has no position: ${nameOrId}`;
			const result: Record<string, unknown> = {
				name: snap.name,
				type: snap.type,
				position: snap.position,
			};
			if (snap.rotation) result.rotation = snap.rotation;
			if (snap.scale) result.scale = snap.scale;
			if (snap.quaternion) result.quaternion = snap.quaternion;
			if (snap.visible !== undefined) result.visible = snap.visible;

			// Try to get world position via object3d if available
			const n3d = node as unknown as {
				object3d?: {
					getWorldPosition?: (v: { x: number; y: number; z: number }) => void;
				};
			};
			if (n3d.object3d?.getWorldPosition) {
				const wp = { x: 0, y: 0, z: 0 };
				n3d.object3d.getWorldPosition(wp as unknown as { x: number; y: number; z: number });
				result.worldPosition = wp;
			}
			return result;
		},

		camera3d(): Record<string, unknown> | string {
			// Try to find via ThreeContext
			const gameAny = game as unknown as Record<string, unknown>;
			const threeCtx = gameAny.three as
				| { activeCamera: unknown; webglRenderer?: unknown }
				| undefined;
			if (!threeCtx) return "ThreePlugin not installed";
			const cam = threeCtx.activeCamera as Record<string, unknown> | null;
			if (!cam) return "No active 3D camera";
			const result: Record<string, unknown> = { type: "Camera3D" };
			if (cam.fov !== undefined) result.fov = cam.fov;
			if (cam.aspect !== undefined) result.aspect = cam.aspect;
			if (cam.near !== undefined) result.near = cam.near;
			if (cam.far !== undefined) result.far = cam.far;
			const pos = cam.position as { x: number; y: number; z: number } | undefined;
			if (pos) result.position = { x: pos.x, y: pos.y, z: pos.z };
			const rot = cam.rotation as { x: number; y: number; z: number } | undefined;
			if (rot) result.rotation = { x: rot.x, y: rot.y, z: rot.z };
			return result;
		},

		lights(): Record<string, unknown>[] {
			const scene = game.currentScene;
			if (!scene) return [];
			const results: Record<string, unknown>[] = [];
			function walkLights(n: Node): void {
				const snap = n.serialize() as Snap;
				const type = snap.type as string;
				if (
					type.includes("Light") ||
					type === "AmbientLight" ||
					type === "DirectionalLight" ||
					type === "PointLight"
				) {
					const entry: Record<string, unknown> = { name: snap.name, type };
					const p = _snapPos(snap);
					if (p) entry.position = p;
					const n3d = n as unknown as {
						object3d?: { intensity?: number; color?: { r: number; g: number; b: number } };
					};
					if (n3d.object3d?.intensity !== undefined) entry.intensity = n3d.object3d.intensity;
					if (n3d.object3d?.color) {
						const c = n3d.object3d.color;
						entry.color = `rgb(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)})`;
					}
					results.push(entry);
				}
				for (const child of n.children) walkLights(child);
			}
			walkLights(scene);
			return results;
		},

		material(nameOrId: string | number): Record<string, unknown>[] | string {
			const scene = game.currentScene;
			if (!scene) return "No scene";
			const node =
				typeof nameOrId === "number"
					? findNodeById(scene, nameOrId)
					: findNodeByName(scene, nameOrId);
			if (!node) return `Node not found: ${nameOrId}`;
			const n3d = node as unknown as {
				object3d?: { traverse?: (fn: (obj: unknown) => void) => void };
			};
			if (!n3d.object3d?.traverse) return `Node has no object3d: ${nameOrId}`;
			const mats: Record<string, unknown>[] = [];
			n3d.object3d.traverse((obj: unknown) => {
				const mesh = obj as {
					material?: {
						type?: string;
						color?: { r: number; g: number; b: number };
						opacity?: number;
						transparent?: boolean;
						emissive?: { r: number; g: number; b: number };
					};
				};
				if (mesh.material) {
					const m = mesh.material;
					const entry: Record<string, unknown> = {};
					if (m.type) entry.type = m.type;
					if (m.color)
						entry.color = `rgb(${Math.round(m.color.r * 255)},${Math.round(m.color.g * 255)},${Math.round(m.color.b * 255)})`;
					if (m.opacity !== undefined) entry.opacity = m.opacity;
					if (m.transparent !== undefined) entry.transparent = m.transparent;
					if (m.emissive)
						entry.emissive = `rgb(${Math.round(m.emissive.r * 255)},${Math.round(m.emissive.g * 255)},${Math.round(m.emissive.b * 255)})`;
					mats.push(entry);
				}
			});
			return mats;
		},

		stats3d(): Record<string, unknown> | string {
			const gameAny = game as unknown as Record<string, unknown>;
			const threeCtx = gameAny.three as
				| {
						webglRenderer?: { info?: { render?: unknown; memory?: unknown; programs?: unknown[] } };
				  }
				| undefined;
			if (!threeCtx?.webglRenderer?.info) return "ThreePlugin not installed or no renderer info";
			const info = threeCtx.webglRenderer.info;
			return {
				render: info.render ?? {},
				memory: info.memory ?? {},
				programs: info.programs?.length ?? 0,
			};
		},

		nearby(target: string, radius = 100): NearbyResult | string {
			const snap = bridge.inspect(target) as (NodeSnapshot & Record<string, unknown>) | null;
			if (!snap) return `Node not found: ${target}`;
			if (!snap.position) return `Node has no position: ${target}`;

			const p = snap.position as { x: number; y: number; z?: number };
			const px = p.x;
			const py = p.y;
			const pz = typeof p.z === "number" ? p.z : null;
			const is3d = pz !== null;

			const tree = bridge.tree();
			if (!tree) return "(no scene)";

			const results: { dist: number; line: string }[] = [];

			function fmtPos(pos: { x: number; y: number; z?: number }): string {
				if (typeof pos.z === "number")
					return `pos=(${pos.x.toFixed(1)},${pos.y.toFixed(1)},${pos.z.toFixed(1)})`;
				return `pos=(${pos.x.toFixed(1)},${pos.y.toFixed(1)})`;
			}

			function walk(n: NodeSnapshot & Record<string, unknown>): void {
				const np = n.position as { x: number; y: number; z?: number } | undefined;
				if (!np) {
					for (const c of n.children) walk(c as NodeSnapshot & Record<string, unknown>);
					return;
				}
				if (n.id === snap?.id) {
					for (const c of n.children) walk(c as NodeSnapshot & Record<string, unknown>);
					return;
				}
				const dx = np.x - px;
				const dy = np.y - py;
				const dz = is3d && typeof np.z === "number" && pz !== null ? np.z - pz : 0;
				const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
				if (dist <= radius) {
					let line = n.type as string;
					if (n.name !== n.type) line += ` "${n.name}"`;
					line += `  ${fmtPos(np)}`;
					line += `  dist=${dist.toFixed(1)}`;
					if (is3d) line += `  delta=(${dx.toFixed(1)},${dy.toFixed(1)},${dz.toFixed(1)})`;
					else line += `  delta=(${dx.toFixed(1)},${dy.toFixed(1)})`;
					if (n.collisionGroup) line += `  group=${n.collisionGroup}`;
					const shapes = (n.children || []).filter(
						(c: NodeSnapshot) => (c as NodeSnapshot & Record<string, unknown>).shapeDesc,
					);
					if (shapes.length > 0)
						line += `  shape=${(shapes[0] as NodeSnapshot & Record<string, unknown>).shapeDesc}`;
					if (n.bodyType) line += `  [${n.bodyType}]`;
					if (n.tags && Array.isArray(n.tags) && (n.tags as string[]).length > 0) {
						line += `  tags=${(n.tags as string[]).join(",")}`;
					}
					results.push({ dist, line });
				}
				for (const c of n.children) walk(c as NodeSnapshot & Record<string, unknown>);
			}

			walk(tree as NodeSnapshot & Record<string, unknown>);

			results.sort((a, b) => a.dist - b.dist);
			const posStr = is3d
				? `(${px.toFixed(1)},${py.toFixed(1)},${pz?.toFixed(1)})`
				: `(${px.toFixed(1)},${py.toFixed(1)})`;

			return {
				targetName: target,
				targetPos: posStr,
				radius,
				nodes: results,
			};
		},
	};

	if (typeof window !== "undefined") {
		window.__quintusDebug = bridge;
		window.__quintusFormatters = {
			formatTree,
			formatEvents,
			formatLayout: _formatLayout,
			formatPhysics: _formatPhysics,
			formatQueryResults: _formatQueryResults,
			formatTrack: _formatTrack,
			formatJumpAnalysis: _formatJumpAnalysis,
			formatNearby: _formatNearby,
			formatTransform: _formatTransform,
			formatCamera3D: _formatCamera3D,
			formatLights: _formatLights,
			formatMaterial: _formatMaterial,
			formatStats3D: _formatStats3D,
		};
		// Expose game for debugging (debug mode only)
		(window as unknown as Record<string, unknown>).__quintusGame = game;
	}

	return bridge;
}

/** Duck-typed interface for UINode-like nodes that support pointer dispatch. */
interface ClickableNode extends Node {
	interactive: boolean;
	visible: boolean;
	width: number;
	height: number;
	zIndex: number;
	globalPosition: { x: number; y: number };
	containsPoint(x: number, y: number): boolean;
	_onPointerDown(x: number, y: number): void;
	_onPointerUp(x: number, y: number): void;
}

function isClickable(node: Node): node is ClickableNode {
	const n = node as unknown as Record<string, unknown>;
	return (
		typeof n.interactive === "boolean" &&
		n.interactive === true &&
		typeof n.visible === "boolean" &&
		n.visible === true &&
		typeof n.containsPoint === "function" &&
		typeof n._onPointerDown === "function" &&
		typeof n._onPointerUp === "function"
	);
}

function collectClickableNodes(root: Node): ClickableNode[] {
	const nodes: ClickableNode[] = [];
	walkClickable(root, nodes);
	return nodes;
}

function walkClickable(node: Node, out: ClickableNode[]): void {
	if (isClickable(node)) out.push(node);
	for (const child of node.children) walkClickable(child, out);
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

/** Collect a single node by numeric id (returns 0-or-1 element array). */
function collectById(root: Node, id: number): Node[] {
	const node = findNodeById(root, id);
	return node ? [node] : [];
}

/** Collect all nodes matching name, constructor name, or tag. */
function collectByNameOrTag(root: Node, q: string): Node[] {
	const results: Node[] = [];
	walkAndCollect(root, q, results);
	return results;
}

function walkAndCollect(node: Node, q: string, results: Node[]): void {
	if (node.constructor.name === q || node.name === q || node.hasTag(q)) {
		results.push(node);
	}
	for (const child of node.children) {
		walkAndCollect(child, q, results);
	}
}

// ── Inline formatters for window.__quintusFormatters ────────────────────────

type Snap = NodeSnapshot & Record<string, unknown>;

function _snapPos(s: Snap): { x: number; y: number; z?: number } | null {
	const p = s.position;
	if (p && typeof p === "object") return p as { x: number; y: number; z?: number };
	return null;
}

function _fmtPos(p: { x: number; y: number; z?: number }): string {
	if (typeof p.z === "number") return `pos=(${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)})`;
	return `pos=(${p.x.toFixed(1)},${p.y.toFixed(1)})`;
}

function _fmtPosParens(p: { x: number; y: number; z?: number }): string {
	if (typeof p.z === "number") return `(${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)})`;
	return `(${p.x.toFixed(2)}, ${p.y.toFixed(2)})`;
}

function _formatLayout(snapshot: NodeSnapshot): string {
	const lines: string[] = [];
	function walk(n: Snap, depth: number): void {
		const p = _snapPos(n);
		if (p) {
			let line = "  ".repeat(depth) + n.type;
			if (n.name !== n.type) line += ` "${n.name}"`;
			line += `  ${_fmtPos(p)}`;
			if (n.velocity && typeof n.velocity === "object") {
				const v = n.velocity as { x: number; y: number };
				line += `  vel=(${v.x.toFixed(1)},${v.y.toFixed(1)})`;
			}
			if (n.isOnFloor) line += "  [floor]";
			if (n.isOnWall) line += "  [wall]";
			if (n.isOnCeiling) line += "  [ceiling]";
			if (n.collisionGroup) line += `  group=${n.collisionGroup}`;
			if (n.shape) line += `  shape=${JSON.stringify(n.shape)}`;
			if (
				n.rotation &&
				typeof n.rotation === "object" &&
				typeof (n.rotation as Record<string, unknown>).order === "string"
			) {
				const r = n.rotation as { x: number; y: number; z: number };
				line += `  rot=(${((r.x * 180) / Math.PI).toFixed(0)},${((r.y * 180) / Math.PI).toFixed(0)},${((r.z * 180) / Math.PI).toFixed(0)})deg`;
			}
			lines.push(line);
		}
		for (const c of n.children) walk(c as Snap, depth + 1);
	}
	walk(snapshot as Snap, 0);
	return lines.length > 0 ? lines.join("\n") : "(no spatial nodes)";
}

function _formatPhysics(snapshot: NodeSnapshot): string {
	const s = snapshot as Snap;
	const lines: string[] = [];
	lines.push(`Node: ${s.type} "${s.name}"`);
	const p = _snapPos(s);
	if (p) lines.push(`Position: ${_fmtPosParens(p)}`);
	if (s.globalPosition && typeof s.globalPosition === "object") {
		const gp = s.globalPosition as { x: number; y: number };
		lines.push(`Global:   (${gp.x.toFixed(2)}, ${gp.y.toFixed(2)})`);
	}
	if (
		s.rotation &&
		typeof s.rotation === "object" &&
		typeof (s.rotation as Record<string, unknown>).order === "string"
	) {
		const r = s.rotation as { x: number; y: number; z: number; order: string };
		lines.push(
			`Rotation: (${((r.x * 180) / Math.PI).toFixed(1)}, ${((r.y * 180) / Math.PI).toFixed(1)}, ${((r.z * 180) / Math.PI).toFixed(1)}) deg ${r.order}`,
		);
	} else if (typeof s.rotation === "number") {
		lines.push(`Rotation: ${((s.rotation * 180) / Math.PI).toFixed(1)} deg`);
	}
	if (s.scale && typeof s.scale === "object") {
		const sc = s.scale as { x: number; y: number; z?: number };
		if (typeof sc.z === "number") {
			lines.push(`Scale:    (${sc.x.toFixed(2)}, ${sc.y.toFixed(2)}, ${sc.z.toFixed(2)})`);
		}
	}
	if (s.velocity && typeof s.velocity === "object") {
		const v = s.velocity as { x: number; y: number };
		lines.push(`Velocity: (${v.x.toFixed(2)}, ${v.y.toFixed(2)})`);
	}
	if (s.gravity !== undefined) lines.push(`Gravity:  ${s.gravity}`);
	if (s.isOnFloor !== undefined) lines.push(`OnFloor:  ${s.isOnFloor}`);
	if (s.isOnWall !== undefined) lines.push(`OnWall:   ${s.isOnWall}`);
	if (s.isOnCeiling !== undefined) lines.push(`OnCeil:   ${s.isOnCeiling}`);
	if (s.collisionGroup) lines.push(`Group:    ${s.collisionGroup}`);
	if (s.shape) lines.push(`Shape:    ${JSON.stringify(s.shape)}`);
	if (s.visible === false) lines.push("Visible:  false");
	if (s.tags && Array.isArray(s.tags) && s.tags.length > 0) {
		lines.push(`Tags:     ${(s.tags as string[]).join(", ")}`);
	}
	return lines.join("\n");
}

function _formatQueryResults(results: NodeSnapshot[], query: string): string {
	if (results.length === 0) return `No matches for: ${query}`;
	return results
		.map((n) => {
			const s = n as Snap;
			let line = s.type as string;
			if (s.name !== s.type) line += ` "${s.name}"`;
			const p = _snapPos(s);
			if (p) {
				if (typeof p.z === "number")
					line += ` (${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)})`;
				else line += ` (${p.x.toFixed(1)},${p.y.toFixed(1)})`;
			}
			if (s.tags && Array.isArray(s.tags) && (s.tags as string[]).length > 0) {
				line += ` [${(s.tags as string[]).join(",")}]`;
			}
			return line;
		})
		.join("\n");
}

function _formatTrack(result: TrackResult): string {
	const rows: string[] = [];
	rows.push("Frame  X         Y         Vx        Vy        Floor  Wall   Ceil");
	rows.push("---");
	for (const f of result.frames) {
		if (f.lost) {
			rows.push(`(node lost at step ${f.step})`);
			break;
		}
		rows.push(
			String(f.frame).padStart(5) +
				"  " +
				f.x.toFixed(2).padStart(8) +
				"  " +
				f.y.toFixed(2).padStart(8) +
				"  " +
				f.vx.toFixed(2).padStart(8) +
				"  " +
				f.vy.toFixed(2).padStart(8) +
				"  " +
				String(f.onFloor).padEnd(6) +
				" " +
				String(f.onWall).padEnd(6) +
				" " +
				String(f.onCeiling),
		);
	}
	return rows.join("\n");
}

function _formatJumpAnalysis(result: JumpAnalysisResult, nodeName: string): string {
	const lines: string[] = [];
	lines.push(`=== Jump Analysis: ${nodeName} ===`);
	lines.push(`Start Y:       ${result.startY.toFixed(2)}`);
	lines.push(`Jump Vy:       ${result.jumpVy.toFixed(2)}`);
	lines.push(`Gravity:       ${result.gravity}`);
	lines.push("");
	lines.push("--- Measured ---");
	lines.push(`Jump Height:   ${result.jumpHeight.toFixed(2)} px`);
	lines.push(`Apex Frame:    +${result.apexFrame} frames`);
	lines.push(`Air Time:      ${result.totalFrames} frames (${result.airTimeSec.toFixed(3)}s)`);
	lines.push(
		`Landed:        ${result.landed ? `yes (frame ${result.landFrame})` : "no (still airborne)"}`,
	);
	lines.push("");
	lines.push("--- Theoretical ---");
	lines.push(`Height:        ${result.theoreticalHeight.toFixed(2)} px`);
	lines.push(`Air Frames:    ${result.theoreticalAirFrames.toFixed(1)}`);
	if (result.theoreticalHeight > 0) {
		const pct = ((result.jumpHeight / result.theoreticalHeight) * 100).toFixed(1);
		lines.push(`Efficiency:    ${pct}%`);
	}
	return lines.join("\n");
}

function _formatNearby(result: NearbyResult): string {
	if (result.nodes.length === 0) {
		return `No nodes within ${result.radius} of ${result.targetName} at ${result.targetPos}`;
	}
	const header = `Nearby ${result.targetName} ${result.targetPos} within ${result.radius}:`;
	const lines = result.nodes.map((n) => `  ${n.line}`);
	return `${header}\n${lines.join("\n")}`;
}

function _formatTransform(data: Record<string, unknown>): string {
	const lines: string[] = [];
	lines.push(`Node: ${data.type} "${data.name}"`);
	const p = data.position as { x: number; y: number; z: number } | undefined;
	if (p) lines.push(`Position:  (${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)})`);
	const wp = data.worldPosition as { x: number; y: number; z: number } | undefined;
	if (wp) lines.push(`World:     (${wp.x.toFixed(2)}, ${wp.y.toFixed(2)}, ${wp.z.toFixed(2)})`);
	const r = data.rotation as { x: number; y: number; z: number; order?: string } | undefined;
	if (r) {
		lines.push(
			`Rotation:  (${((r.x * 180) / Math.PI).toFixed(1)}, ${((r.y * 180) / Math.PI).toFixed(1)}, ${((r.z * 180) / Math.PI).toFixed(1)}) deg${r.order ? ` ${r.order}` : ""}`,
		);
	}
	const s = data.scale as { x: number; y: number; z: number } | undefined;
	if (s) lines.push(`Scale:     (${s.x.toFixed(2)}, ${s.y.toFixed(2)}, ${s.z.toFixed(2)})`);
	if (data.visible === false) lines.push("Visible:   false");
	return lines.join("\n");
}

function _formatCamera3D(data: Record<string, unknown>): string {
	if (typeof data === "string") return data as string;
	const lines: string[] = [];
	lines.push("=== 3D Camera ===");
	if (data.fov !== undefined) lines.push(`FOV:       ${data.fov}`);
	if (data.aspect !== undefined) lines.push(`Aspect:    ${(data.aspect as number).toFixed(3)}`);
	if (data.near !== undefined) lines.push(`Near:      ${data.near}`);
	if (data.far !== undefined) lines.push(`Far:       ${data.far}`);
	const p = data.position as { x: number; y: number; z: number } | undefined;
	if (p) lines.push(`Position:  (${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)})`);
	const r = data.rotation as { x: number; y: number; z: number } | undefined;
	if (r) {
		lines.push(
			`Rotation:  (${((r.x * 180) / Math.PI).toFixed(1)}, ${((r.y * 180) / Math.PI).toFixed(1)}, ${((r.z * 180) / Math.PI).toFixed(1)}) deg`,
		);
	}
	return lines.join("\n");
}

function _formatLights(data: Record<string, unknown>[]): string {
	if (data.length === 0) return "(no lights found)";
	const lines: string[] = [];
	lines.push(`=== ${data.length} Light(s) ===`);
	for (const light of data) {
		let line = `${light.type}`;
		if (light.name && light.name !== light.type) line += ` "${light.name}"`;
		if (light.intensity !== undefined) line += `  intensity=${light.intensity}`;
		if (light.color) line += `  color=${light.color}`;
		const p = light.position as { x: number; y: number; z: number } | undefined;
		if (p) line += `  pos=(${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)})`;
		lines.push(`  ${line}`);
	}
	return lines.join("\n");
}

function _formatMaterial(data: Record<string, unknown>[]): string {
	if (data.length === 0) return "(no materials found)";
	const lines: string[] = [];
	lines.push(`=== ${data.length} Material(s) ===`);
	for (const mat of data) {
		let line = mat.type ? String(mat.type) : "Material";
		if (mat.color) line += `  color=${mat.color}`;
		if (mat.emissive) line += `  emissive=${mat.emissive}`;
		if (mat.opacity !== undefined && mat.opacity !== 1) line += `  opacity=${mat.opacity}`;
		if (mat.transparent) line += "  [transparent]";
		lines.push(`  ${line}`);
	}
	return lines.join("\n");
}

function _formatStats3D(data: Record<string, unknown>): string {
	if (typeof data === "string") return data as string;
	const lines: string[] = [];
	lines.push("=== Three.js Stats ===");
	const render = data.render as Record<string, unknown> | undefined;
	if (render) {
		if (render.calls !== undefined) lines.push(`Draw calls:  ${render.calls}`);
		if (render.triangles !== undefined) lines.push(`Triangles:   ${render.triangles}`);
		if (render.points !== undefined) lines.push(`Points:      ${render.points}`);
		if (render.lines !== undefined) lines.push(`Lines:       ${render.lines}`);
	}
	const memory = data.memory as Record<string, unknown> | undefined;
	if (memory) {
		if (memory.geometries !== undefined) lines.push(`Geometries:  ${memory.geometries}`);
		if (memory.textures !== undefined) lines.push(`Textures:    ${memory.textures}`);
	}
	if (data.programs !== undefined) lines.push(`Programs:    ${data.programs}`);
	return lines.join("\n");
}
