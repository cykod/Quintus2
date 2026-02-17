import type { NodeSnapshot } from "./snapshot-types.js";

/**
 * Find the first node in a snapshot tree matching a query.
 * Matches against type, name, or tag.
 */
export function findInSnapshot(root: NodeSnapshot, query: string): NodeSnapshot | null {
	if (root.type === query || root.name === query || root.tags.includes(query)) {
		return root;
	}
	for (const child of root.children) {
		const found = findInSnapshot(child, query);
		if (found) return found;
	}
	return null;
}

/**
 * Find all nodes in a snapshot tree matching a query.
 * Matches against type, name, or tag.
 */
export function findAllInSnapshot(root: NodeSnapshot, query: string): NodeSnapshot[] {
	const results: NodeSnapshot[] = [];
	_walkFindAll(root, query, results);
	return results;
}

/**
 * Count nodes in a snapshot tree matching a query.
 * Matches against type, name, or tag.
 */
export function countInSnapshot(root: NodeSnapshot, query: string): number {
	let count = 0;
	if (root.type === query || root.name === query || root.tags.includes(query)) count++;
	for (const child of root.children) count += countInSnapshot(child, query);
	return count;
}

function _walkFindAll(node: NodeSnapshot, query: string, results: NodeSnapshot[]): void {
	if (node.type === query || node.name === query || node.tags.includes(query)) {
		results.push(node);
	}
	for (const child of node.children) {
		_walkFindAll(child, query, results);
	}
}
