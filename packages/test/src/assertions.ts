import type { Node2DSnapshot, NodeSnapshot } from "@quintus/core";
import { countInSnapshot, findInSnapshot } from "@quintus/core";
import type { Timeline } from "./timeline.js";

// === Type Guards ===

/** Check if a snapshot has Node2D properties (position, rotation, etc.). */
export function isNode2DSnapshot(s: NodeSnapshot): s is Node2DSnapshot {
	return "position" in s && "rotation" in s;
}

/** Check if a snapshot has Actor properties (velocity, isOnFloor, etc.). */
export function isActorSnapshot(s: NodeSnapshot): s is NodeSnapshot & {
	velocity: { x: number; y: number };
	isOnFloor: boolean;
	isOnWall: boolean;
	isOnCeiling: boolean;
	bodyType: "actor";
} {
	return "bodyType" in s && (s as Record<string, unknown>).bodyType === "actor";
}

// === Spatial Assertions ===

/** Assert that a node's position.x is greater than a start value. */
export function assertMovedRight(node: NodeSnapshot, startX: number): void {
	if (!isNode2DSnapshot(node)) throw new Error(`Node "${node.name}" is not a Node2D`);
	if (node.position.x <= startX) {
		throw new Error(
			`Expected "${node.name}" to move right from x=${startX}, but x=${node.position.x}`,
		);
	}
}

/** Assert a node is on the floor (Actor only). */
export function assertOnFloor(node: NodeSnapshot): void {
	if (!isActorSnapshot(node)) throw new Error(`Node "${node.name}" is not an Actor`);
	if (!node.isOnFloor) {
		throw new Error(`Expected "${node.name}" to be on floor, but isOnFloor=false`);
	}
}

/** Assert a node is NOT on the floor (Actor only). */
export function assertNotOnFloor(node: NodeSnapshot): void {
	if (!isActorSnapshot(node)) throw new Error(`Node "${node.name}" is not an Actor`);
	if (node.isOnFloor) {
		throw new Error(`Expected "${node.name}" to not be on floor, but isOnFloor=true`);
	}
}

/** Assert a node has a specific tag. */
export function assertHasTag(node: NodeSnapshot, tag: string): void {
	if (!node.tags.includes(tag)) {
		throw new Error(
			`Expected "${node.name}" to have tag "${tag}", but tags are [${node.tags.join(", ")}]`,
		);
	}
}

/** Assert two nodes are within a given distance of each other. */
export function assertWithinDistance(a: NodeSnapshot, b: NodeSnapshot, maxDistance: number): void {
	if (!isNode2DSnapshot(a) || !isNode2DSnapshot(b)) {
		throw new Error("Both nodes must be Node2D for distance assertion");
	}
	const dx = a.position.x - b.position.x;
	const dy = a.position.y - b.position.y;
	const dist = Math.sqrt(dx * dx + dy * dy);
	if (dist > maxDistance) {
		throw new Error(
			`Expected "${a.name}" to be within ${maxDistance}px of "${b.name}", but distance is ${dist.toFixed(1)}px`,
		);
	}
}

// === Scene Assertions ===

/** Assert the scene tree contains at least one node matching a query. */
export function assertContains(root: NodeSnapshot, query: string): void {
	if (!findInSnapshot(root, query)) {
		throw new Error(`Expected scene to contain a node matching "${query}", but none found`);
	}
}

/** Assert the scene tree does NOT contain a node matching a query. */
export function assertNotContains(root: NodeSnapshot, query: string): void {
	if (findInSnapshot(root, query)) {
		throw new Error(`Expected scene to NOT contain a node matching "${query}", but one was found`);
	}
}

/** Assert the scene has exactly N nodes matching a query. */
export function assertNodeCount(root: NodeSnapshot, query: string, expected: number): void {
	const found = countInSnapshot(root, query);
	if (found !== expected) {
		throw new Error(`Expected ${expected} nodes matching "${query}", but found ${found}`);
	}
}

// === Timeline Assertions ===

/** Assert a node exists at a given frame in the timeline. */
export function assertExistsAtFrame(timeline: Timeline, frame: number, query: string): void {
	const node = timeline.findNode(frame, query);
	if (!node) {
		throw new Error(`Expected node matching "${query}" at frame ${frame}, but not found`);
	}
}

/** Assert a node is gone (destroyed) by a given frame. */
export function assertDestroyedByFrame(timeline: Timeline, frame: number, query: string): void {
	const node = timeline.findNode(frame, query);
	if (node) {
		throw new Error(
			`Expected node matching "${query}" to be destroyed by frame ${frame}, but it still exists`,
		);
	}
}

/** Assert a node count decreases between two frames. */
export function assertCountDecreased(
	timeline: Timeline,
	query: string,
	fromFrame: number,
	toFrame: number,
): void {
	const before = timeline.countNodes(fromFrame, query);
	const after = timeline.countNodes(toFrame, query);
	if (after >= before) {
		throw new Error(
			`Expected count of "${query}" to decrease between frames ${fromFrame} and ${toFrame}, but went from ${before} to ${after}`,
		);
	}
}
