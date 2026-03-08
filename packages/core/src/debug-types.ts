/**
 * Result types for higher-level debug bridge commands.
 */

// ── Track ───────────────────────────────────────────────────────────────────

export interface TrackFrame {
	step: number;
	frame: number;
	x: number;
	y: number;
	vx: number;
	vy: number;
	onFloor: boolean;
	onWall: boolean;
	onCeiling: boolean;
	lost: boolean;
}

export interface TrackResult {
	target: string;
	frames: TrackFrame[];
}

// ── Jump Analysis ───────────────────────────────────────────────────────────

export interface JumpAnalysisResult {
	startY: number;
	jumpVy: number;
	gravity: number;
	jumpHeight: number;
	apexFrame: number;
	totalFrames: number;
	airTimeSec: number;
	landed: boolean;
	landFrame: number;
	theoreticalHeight: number;
	theoreticalAirFrames: number;
}

// ── Move To ─────────────────────────────────────────────────────────────────

export interface MoveToOptions {
	target: string;
	actions: string[];
	targetX: number | null;
	targetY: number | null;
	maxFrames?: number;
}

export interface MoveToResult {
	reached: boolean;
	frames: number;
	endX: number;
	endY: number;
	endVx: number;
	endVy: number;
	onFloor: boolean;
	bridgeFrame: number;
}

// ── Nearby ──────────────────────────────────────────────────────────────────

export interface NearbyNode {
	dist: number;
	line: string;
}

export interface NearbyResult {
	targetName: string;
	targetPos: string;
	radius: number;
	nodes: NearbyNode[];
}
