import type { DebugEvent } from "./debug-log.js";
import type { NodeSnapshot } from "./snapshot-types.js";

/** Format a node snapshot tree as a compact text tree with connectors. */
export function formatTree(snapshot: NodeSnapshot, indent = ""): string {
	const lines: string[] = [];
	lines.push(formatNodeLine(snapshot));

	const children = snapshot.children;
	for (let i = 0; i < children.length; i++) {
		const child = children[i];
		if (!child) continue;
		const isLast = i === children.length - 1;
		const connector = isLast ? "└── " : "├── ";
		const childIndent = indent + (isLast ? "    " : "│   ");

		lines.push(indent + connector + formatNodeLine(child));

		// Recurse into grandchildren
		const grandchildren = child.children;
		for (let j = 0; j < grandchildren.length; j++) {
			const gc = grandchildren[j];
			if (!gc) continue;
			const gcIsLast = j === grandchildren.length - 1;
			lines.push(
				formatTree(gc, childIndent)
					.split("\n")
					.map((line, idx) => {
						if (idx === 0) {
							return childIndent + (gcIsLast ? "└── " : "├── ") + line;
						}
						return line;
					})
					.join("\n"),
			);
		}
	}

	return lines.join("\n");
}

/** Format a single node as a compact one-liner. */
function formatNodeLine(snap: NodeSnapshot): string {
	const parts: string[] = [`[${snap.id}]`, snap.type];

	// Show name if different from type
	if (snap.name !== snap.type) {
		parts.push(`"${snap.name}"`);
	}

	// Show position if it's a Node2D+ snapshot
	const s = snap as unknown as Record<string, unknown>;
	if (s.position && typeof s.position === "object") {
		const pos = s.position as { x: number; y: number };
		parts.push(`(${pos.x.toFixed(0)}, ${pos.y.toFixed(0)})`);
	}

	// Show shape description if present (CollisionShape)
	if (typeof s.shapeDesc === "string" && s.shapeDesc !== "none") {
		parts.push(`<${s.shapeDesc}>`);
	}
	if (typeof s.disabled === "boolean" && s.disabled) {
		parts.push("DISABLED");
	}

	// Show velocity if present (Actor)
	if (s.velocity && typeof s.velocity === "object") {
		const vel = s.velocity as { x: number; y: number };
		parts.push(`vel=(${vel.x.toFixed(0)},${vel.y.toFixed(0)})`);
	}

	// Show onFloor if present
	if (typeof s.isOnFloor === "boolean" && s.isOnFloor) {
		parts.push("onFloor");
	}

	// Show camera info
	if (typeof s.zoom === "number" && typeof s.followTarget === "string") {
		parts.push(`zoom=${s.zoom}`);
	}
	if (typeof s.followTarget === "string") {
		parts.push(`follow=${s.followTarget}`);
	}
	if (typeof s.smoothing === "number" && s.smoothing > 0) {
		parts.push(`smooth=${s.smoothing}`);
	}
	if (typeof s.isShaking === "boolean" && s.isShaking) {
		parts.push("SHAKING");
	}
	if (s.bounds && typeof s.bounds === "object") {
		const b = s.bounds as { x: number; y: number; width: number; height: number };
		parts.push(`bounds=${b.width}x${b.height}`);
	}

	// Show tags
	if (snap.tags.length > 0) {
		parts.push(`[${snap.tags.join(",")}]`);
	}

	return parts.join(" ");
}

/** Format debug events as scannable text lines. */
export function formatEvents(events: DebugEvent[]): string {
	if (events.length === 0) return "(no events)";

	const lines: string[] = [];
	// Compute max widths for alignment
	const maxFrame = Math.max(...events.map((e) => String(e.frame).length));
	const maxCat = Math.max(...events.map((e) => e.category.length));

	for (const event of events) {
		const frame = String(event.frame).padStart(maxFrame);
		const time = event.time.toFixed(3);
		const cat = event.category.padEnd(maxCat);
		let line = `[f:${frame} t:${time}s] ${cat}  ${event.message}`;

		// Append data as key=value pairs
		if (event.data) {
			const pairs = Object.entries(event.data)
				.map(([k, v]) => `${k}=${formatValue(v)}`)
				.join(" ");
			if (pairs) line += `  ${pairs}`;
		}

		lines.push(line);
	}

	return lines.join("\n");
}

function formatValue(v: unknown): string {
	if (v === null || v === undefined) return String(v);
	if (typeof v === "object") {
		if ("x" in v && "y" in v) {
			const obj = v as { x: number; y: number };
			return `(${obj.x},${obj.y})`;
		}
		return JSON.stringify(v);
	}
	return String(v);
}
