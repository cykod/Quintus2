/**
 * Debug formatters for NodeSnapshot data.
 *
 * Re-exports `formatTree` and `formatEvents` from @quintus/core, and adds
 * higher-level formatters: `formatLayout`, `formatPhysics`, `formatQueryResults`,
 * `formatTrack`, `formatJumpAnalysis`, `formatNearby`.
 */

export { formatEvents, formatTree } from "@quintus/core";

import type { NodeSnapshot } from "@quintus/core";
import type { JumpAnalysisResult, NearbyResult, TrackResult } from "./types.js";

// ── Duck-typed field accessors ──────────────────────────────────────────────

type Snap = NodeSnapshot & Record<string, unknown>;

function pos(s: Snap): { x: number; y: number; z?: number } | null {
	const p = s.position;
	if (p && typeof p === "object") return p as { x: number; y: number; z?: number };
	return null;
}

function fmtPos(p: { x: number; y: number; z?: number }): string {
	if (typeof p.z === "number") {
		return `pos=(${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)})`;
	}
	return `pos=(${p.x.toFixed(1)},${p.y.toFixed(1)})`;
}

function fmtPosParens(p: { x: number; y: number; z?: number }): string {
	if (typeof p.z === "number") {
		return `(${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)})`;
	}
	return `(${p.x.toFixed(2)}, ${p.y.toFixed(2)})`;
}

// ── formatLayout ────────────────────────────────────────────────────────────

/**
 * Spatial overview showing only nodes that have a position,
 * with physics info (velocity, contacts, collision group, shape).
 */
export function formatLayout(snapshot: NodeSnapshot): string {
	const lines: string[] = [];

	function walk(n: Snap, depth: number): void {
		const p = pos(n);
		if (p) {
			let line = "  ".repeat(depth) + n.type;
			if (n.name !== n.type) line += ` "${n.name}"`;
			line += `  ${fmtPos(p)}`;
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
				const r = n.rotation as { x: number; y: number; z: number; order: string };
				line += `  rot=(${((r.x * 180) / Math.PI).toFixed(0)},${((r.y * 180) / Math.PI).toFixed(0)},${((r.z * 180) / Math.PI).toFixed(0)})deg`;
			}
			lines.push(line);
		}
		for (const child of n.children) {
			walk(child as Snap, depth + 1);
		}
	}

	walk(snapshot as Snap, 0);
	return lines.length > 0 ? lines.join("\n") : "(no spatial nodes)";
}

// ── formatPhysics ───────────────────────────────────────────────────────────

/**
 * Physics summary for a single node snapshot.
 * Shows position, velocity, gravity, contacts, shape, tags.
 */
export function formatPhysics(snapshot: NodeSnapshot): string {
	const s = snapshot as Snap;
	const lines: string[] = [];
	lines.push(`Node: ${s.type} "${s.name}"`);

	const p = pos(s);
	if (p) lines.push(`Position: ${fmtPosParens(p)}`);

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

// ── formatQueryResults ──────────────────────────────────────────────────────

/**
 * Format an array of query result snapshots as compact one-liners.
 */
export function formatQueryResults(results: NodeSnapshot[], query: string): string {
	if (results.length === 0) return `No matches for: ${query}`;
	return results
		.map((n) => {
			const s = n as Snap;
			let line = s.type as string;
			if (s.name !== s.type) line += ` "${s.name}"`;
			const p = pos(s);
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

// ── formatTrack ─────────────────────────────────────────────────────────────

/**
 * Format tracking data as a tabular view.
 */
export function formatTrack(result: TrackResult): string {
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

// ── formatJumpAnalysis ──────────────────────────────────────────────────────

/**
 * Format jump analysis results.
 */
export function formatJumpAnalysis(result: JumpAnalysisResult, nodeName: string): string {
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

// ── formatNearby ────────────────────────────────────────────────────────────

/**
 * Format nearby node results.
 */
export function formatNearby(result: NearbyResult): string {
	if (result.nodes.length === 0) {
		return `No nodes within ${result.radius} of ${result.targetName} at ${result.targetPos}`;
	}

	const header = `Nearby ${result.targetName} ${result.targetPos} within ${result.radius}:`;
	const lines = result.nodes.map((n) => `  ${n.line}`);
	return `${header}\n${lines.join("\n")}`;
}
