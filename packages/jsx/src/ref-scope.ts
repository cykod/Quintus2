import type { Node } from "@quintus/core";

/** @internal Symbol for the dollar-ref resolver registered by @quintus/jsx. */
const RESOLVE_BUILD_REFS = Symbol.for("quintus:resolveBuildRefs");

/** Per-build string ref registry: name → node. Cleared after each build(). */
const _stringRefs = new Map<string, Node>();

/** Deferred dollar ref queue: resolved after build() returns. */
const _pendingDollarRefs: Array<{ node: object; key: string; refName: string }> = [];

/** Register a string ref for later $ resolution. Called by _createElement for ref="name". */
export function registerStringRef(name: string, node: Node): void {
	_stringRefs.set(name, node);
}

/** Queue a $-prefixed prop value for deferred resolution after build(). */
export function queueDollarRef(node: object, key: string, refName: string): void {
	_pendingDollarRefs.push({ node, key, refName });
}

/**
 * Resolve all pending $ refs against the current string ref registry.
 * Throws on unresolved refs with an actionable error listing available refs.
 * Clears both maps after resolution.
 */
export function resolveDollarRefs(): void {
	let error: Error | null = null;

	for (const pending of _pendingDollarRefs) {
		const target = _stringRefs.get(pending.refName);
		if (!target) {
			const available = [..._stringRefs.keys()];
			error = new Error(
				`Unresolved dollar ref "$${pending.refName}" on "${pending.key}". ` +
					`Available refs in this build(): [${available.map((r) => `"${r}"`).join(", ")}]`,
			);
			break;
		}
		(pending.node as Record<string, unknown>)[pending.key] = target;
	}

	// Always clear state, even on error
	_pendingDollarRefs.length = 0;
	_stringRefs.clear();

	if (error) throw error;
}

// Register resolver at module load time so @quintus/core can call it via Symbol.for
(globalThis as Record<symbol, unknown>)[RESOLVE_BUILD_REFS] = resolveDollarRefs;
