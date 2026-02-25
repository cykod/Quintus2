/** Configuration for a single collision group. */
export interface GroupConfig {
	/** Names of groups this group collides with. */
	readonly collidesWith: readonly string[];
}

/** Full collision groups configuration. */
export interface CollisionGroupsConfig {
	readonly [groupName: string]: GroupConfig;
}

/**
 * Compiled collision groups. Maps group names to bitmasks for O(1) collision checks.
 * Created from CollisionGroupsConfig at plugin install time.
 */
export class CollisionGroups {
	private readonly layerMap: Map<string, number>;
	private readonly maskMap: Map<string, number>;

	/** The default group name for bodies without an explicit group. */
	static readonly DEFAULT = "default";

	constructor(config: CollisionGroupsConfig) {
		// Assign bit indices (max 32 groups — fits in a 32-bit integer)
		let bit = 0;
		this.layerMap = new Map();
		for (const name of Object.keys(config)) {
			this.layerMap.set(name, 1 << bit);
			bit++;
		}
		// Always include "default" group
		if (!this.layerMap.has("default")) {
			this.layerMap.set("default", 1 << bit);
			bit++;
		}
		if (bit > 32) {
			throw new Error(`Too many collision groups (${bit}). Maximum is 32.`);
		}

		// Compile collision masks
		this.maskMap = new Map();
		for (const [name, cfg] of Object.entries(config)) {
			let mask = 0;
			for (const target of cfg.collidesWith) {
				const targetBit = this.layerMap.get(target);
				if (targetBit === undefined) {
					throw new Error(`Collision group "${name}" references unknown group "${target}".`);
				}
				mask |= targetBit;
			}
			this.maskMap.set(name, mask);
		}
		// Default group collides with nothing if not explicitly configured.
		// Users should define explicit groups; "default" is a fallback placeholder.
		if (!this.maskMap.has("default")) {
			this.maskMap.set("default", 0);
		}
	}

	/** Get the layer bitmask for a group (what it IS). */
	getLayer(group: string): number {
		const layer = this.layerMap.get(group);
		if (layer === undefined) {
			throw new Error(`Unknown collision group "${group}".`);
		}
		return layer;
	}

	/** Get the collision mask for a group (what it SEES). */
	getMask(group: string): number {
		const mask = this.maskMap.get(group);
		if (mask === undefined) {
			throw new Error(`Unknown collision group "${group}".`);
		}
		return mask;
	}

	/** Check if group A should collide with group B. */
	shouldCollide(groupA: string, groupB: string): boolean {
		const layerB = this.layerMap.get(groupB) ?? 0;
		const maskA = this.maskMap.get(groupA) ?? 0;
		return (maskA & layerB) !== 0;
	}

	/** Validate that a group name exists. Throws if not. */
	validate(group: string): void {
		if (!this.layerMap.has(group)) {
			throw new Error(`Unknown collision group "${group}".`);
		}
	}
}
