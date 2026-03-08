/**
 * Re-export result types from @quintus/core for convenience.
 */
export type {
	JumpAnalysisResult,
	MoveToOptions,
	MoveToResult,
	NearbyNode,
	NearbyResult,
	TrackFrame,
	TrackResult,
} from "@quintus/core";

// ── Command Result ──────────────────────────────────────────────────────────

export interface CommandResult {
	ok: boolean;
	output: string;
}
