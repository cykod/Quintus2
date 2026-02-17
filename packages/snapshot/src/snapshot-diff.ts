import type { NodeSnapshot } from "@quintus/core";

/** A single difference between two snapshots. */
export interface SnapshotDifference {
	/** Dot-notation path to the differing property. */
	path: string;
	/** Value in snapshot A. */
	a: unknown;
	/** Value in snapshot B. */
	b: unknown;
}

export interface DiffOptions {
	/** Floating-point tolerance for numeric comparisons. Default: 0 (exact). */
	positionTolerance?: number;
	/** Paths to ignore in comparison. */
	ignorePaths?: string[];
	/** Stop after this many diffs. Default: 100. */
	maxDiffs?: number;
}

/** Known Vec2-like property names that should use position tolerance. */
const VEC2_KEYS = new Set(["position", "velocity", "scale", "globalPosition", "constantVelocity"]);

/**
 * Compare two node tree snapshots and return all differences.
 * Uses full recursive comparison of all enumerable properties.
 */
export function diffSnapshots(
	a: NodeSnapshot,
	b: NodeSnapshot,
	options?: DiffOptions,
): SnapshotDifference[] {
	const diffs: SnapshotDifference[] = [];
	const opts: Required<DiffOptions> = {
		positionTolerance: options?.positionTolerance ?? 0,
		ignorePaths: options?.ignorePaths ?? [],
		maxDiffs: options?.maxDiffs ?? 100,
	};
	const ignoreSet = new Set(opts.ignorePaths);
	_diffValue(a, b, "root", diffs, opts.positionTolerance, ignoreSet, opts.maxDiffs, false);
	return diffs;
}

/**
 * Format diffs as a human-readable string.
 */
export function formatDiffs(diffs: SnapshotDifference[]): string {
	if (diffs.length === 0) return "Snapshots are identical.";
	const lines = diffs.map((d) => {
		const aStr = JSON.stringify(d.a);
		const bStr = JSON.stringify(d.b);
		return `  ${d.path}: ${aStr} → ${bStr}`;
	});
	return `${diffs.length} difference(s):\n${lines.join("\n")}`;
}

function _diffValue(
	a: unknown,
	b: unknown,
	path: string,
	diffs: SnapshotDifference[],
	tolerance: number,
	ignorePaths: Set<string>,
	maxDiffs: number,
	useTolerance: boolean,
): void {
	if (diffs.length >= maxDiffs) return;
	if (ignorePaths.has(path)) return;

	// Identical references or both null/undefined
	if (a === b) return;
	if (a == null && b == null) return;

	// One is null/undefined but not both
	if (a == null || b == null) {
		diffs.push({ path, a, b });
		return;
	}

	// Both are numbers
	if (typeof a === "number" && typeof b === "number") {
		if (useTolerance && tolerance > 0) {
			if (Math.abs(a - b) > tolerance) {
				diffs.push({ path, a, b });
			}
		} else if (a !== b) {
			diffs.push({ path, a, b });
		}
		return;
	}

	// Different types
	if (typeof a !== typeof b) {
		diffs.push({ path, a, b });
		return;
	}

	// Both are strings, booleans, etc.
	if (typeof a !== "object") {
		if (a !== b) diffs.push({ path, a, b });
		return;
	}

	// Both are arrays
	if (Array.isArray(a) && Array.isArray(b)) {
		const key = path.split(".").pop() ?? "";
		// Children arrays are handled specially — recurse into each child node
		if (key === "children") {
			const maxLen = Math.max(a.length, b.length);
			for (let i = 0; i < maxLen; i++) {
				if (diffs.length >= maxDiffs) return;
				const ac = a[i] as NodeSnapshot | undefined;
				const bc = b[i] as NodeSnapshot | undefined;
				if (!ac && bc) {
					diffs.push({
						path: `${path}[${i}]`,
						a: undefined,
						b: { type: (bc as NodeSnapshot).type, name: (bc as NodeSnapshot).name },
					});
				} else if (ac && !bc) {
					diffs.push({
						path: `${path}[${i}]`,
						a: { type: (ac as NodeSnapshot).type, name: (ac as NodeSnapshot).name },
						b: undefined,
					});
				} else if (ac && bc) {
					_diffValue(ac, bc, `${path}[${i}]`, diffs, tolerance, ignorePaths, maxDiffs, false);
				}
			}
		} else {
			// Other arrays (e.g., tags): compare as sorted strings
			const aStr = [...(a as string[])].sort().join(",");
			const bStr = [...(b as string[])].sort().join(",");
			if (aStr !== bStr) {
				diffs.push({ path, a, b });
			}
		}
		return;
	}

	// Both are objects — recurse into all keys
	const aObj = a as Record<string, unknown>;
	const bObj = b as Record<string, unknown>;
	const allKeys = new Set([...Object.keys(aObj), ...Object.keys(bObj)]);

	for (const key of allKeys) {
		if (diffs.length >= maxDiffs) return;
		// Skip children key — it's handled via the array path above
		if (key === "children") {
			_diffValue(
				aObj.children,
				bObj.children,
				`${path}.children`,
				diffs,
				tolerance,
				ignorePaths,
				maxDiffs,
				false,
			);
			continue;
		}
		const childUseTolerance = VEC2_KEYS.has(key) || useTolerance;
		_diffValue(
			aObj[key],
			bObj[key],
			`${path}.${key}`,
			diffs,
			tolerance,
			ignorePaths,
			maxDiffs,
			childUseTolerance,
		);
	}
}
