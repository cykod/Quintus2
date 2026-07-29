import type { CollisionObject } from "./collision-object.js";
import type { QueryOptions } from "./query-types.js";

/**
 * Returns true if the body passes all filters in QueryOptions.
 * Used by all query methods.
 *
 * Destroyed bodies are always excluded, mirroring the `Node` tree-query
 * guards: `destroy()` is deferred to end-of-frame cleanup, but a
 * same-tick `raycast`/`queryCircle`/`findNearest` must agree with
 * `findAll`/`findByType` about what is still in the game. This is scoped to
 * the *query* path only — the collision solver collects candidates straight
 * from the spatial hash and never calls this, so a body destroyed mid-frame
 * still resolves collisions for the remainder of that frame.
 */
export function matchesQuery(body: CollisionObject, options?: QueryOptions): boolean {
	// Destroyed-but-not-yet-cleaned-up bodies are invisible to queries
	if (body.isDestroyed) return false;

	// Sensor filtering (excluded by default, even when no options)
	if (body.bodyType === "sensor" && !options?.includeSensors) return false;

	if (!options) return true;

	// Collision group filtering (OR — body's single group must be in the list)
	// collisionGroup is guaranteed non-null for registered bodies (validated in register())
	const group = body.collisionGroup as string;
	if (options.groups && !options.groups.includes(group)) return false;
	if (options.excludeGroups?.includes(group)) return false;

	// Tag filtering (AND — body must have ALL specified tags)
	if (options.tags) {
		for (const tag of options.tags) {
			if (!body.hasTag(tag)) return false;
		}
	}

	// Instance exclusion
	if (options.exclude?.includes(body)) return false;

	// Custom predicate
	if (options.filter && !options.filter(body)) return false;

	return true;
}
