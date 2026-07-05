import type { CollisionGroupsConfig } from "@quintus/physics";

// Dimensions
export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 500;

// Terrain (heightmap = surface Y per column; larger Y = lower on screen)
export const TERRAIN_BASE_Y = 320; // mean surface height
export const TERRAIN_AMPLITUDE = 140; // max deviation from base
export const TERRAIN_MIN_Y = 20; // highest the surface may reach (clamp floor)
export const TERRAIN_OCTAVES = [
	// sum-of-sines hills (seeded phases)
	{ amp: 70, freq: 0.006 },
	{ amp: 30, freq: 0.017 },
	{ amp: 12, freq: 0.045 },
];

// Ballistics
export const GRAVITY = 300; // px/s²
export const MAX_WIND = 120; // px/s² lateral, ±
export const SWEEP_STEP = 3; // terrain-sample increment (px) — < smallest terrain feature
export const PROJECTILE_RADIUS = 4;
export const OFFSCREEN_MARGIN = 50; // px slack past map bounds before a shell counts as missed

// Cannon placement & aiming — cannon sits on the LEFT, lobbing rightward.
// Angle is measured CCW from +x (0 = right/horizontal, π/2 = straight up).
// The arc is capped short of horizontal-left so shots can't fire off-map to the left.
export const CANNON_X = 70; // column the cannon stands on
export const CANNON_ELEVATION = 18; // px the pivot sits ABOVE the surface (clears muzzle from terrain)
export const MIN_ANGLE = 0.12; // ~7° above horizontal-right
export const MAX_ANGLE = 2.36; // ~135° (up and slightly left, for close high lobs)
export const DEFAULT_ANGLE = Math.PI / 4;
export const ANGLE_RATE = 0.9; // rad/s while held
export const MIN_POWER = 120;
export const MAX_POWER = 640; // muzzle speed px/s
export const DEFAULT_POWER = 380;
export const POWER_RATE = 260; // px/s per second while held
export const MUZZLE_LENGTH = 34; // barrel length (px) — muzzle offset from pivot

// Explosion / scoring
export const BLAST_RADIUS = 44; // terrain carve radius; also the queryCircle radius for hits
export const DIRECT_HIT_RADIUS = 14; // ≤ this from target center → double points
export const DIRECT_HIT_MULTIPLIER = 2; // score multiplier for a direct hit
export const TARGET_RADIUS = 12;
export const TARGET_POINTS = 100;
// Effective splash reach: a target is caught when its body (radius TARGET_RADIUS)
// overlaps the blast circle, so a crate is destroyed up to
// BLAST_RADIUS + TARGET_RADIUS = 56px from center — wider than the 44px terrain carve.
export const TARGET_COUNT = 6;
export const TARGET_MIN_X = 180; // targets spawn to the right of the cannon
export const TARGET_MAX_X = GAME_WIDTH - 40;
export const TARGET_MIN_SPACING = 70; // min px between target centers
export const MAX_PLACEMENT_ATTEMPTS = 30; // per target, before deterministic fallback
export const AMMO = TARGET_COUNT + 4; // a few misses allowed
export const AMMO_BONUS = 50; // points per unused shell at win
export const SHAKE_INTENSITY = 8;
export const SHAKE_DURATION = 0.3;
export const EXPLOSION_DURATION = 0.35; // seconds
export const SEED = 1337;

// Physics: only targets are engine bodies (found via queryCircle). Projectile
// is not a body; terrain is a custom surface. collidesWith is unused here.
export const COLLISION_GROUPS: CollisionGroupsConfig = {
	target: { collidesWith: [] },
};

// Controls: Left/Right aim the barrel (Left raises it toward up-left, Right lowers
// it toward the horizon — the muzzle tip follows the arrow). Hold Space to charge
// muzzle power, release to fire (longer hold = stronger shot).
export const INPUT_BINDINGS: Record<string, string[]> = {
	aim_raise: ["ArrowLeft", "KeyA", "gamepad:dpad-left"],
	aim_lower: ["ArrowRight", "KeyD", "gamepad:dpad-right"],
	fire: ["Space", "gamepad:a"],
	// mouse:left lets a touch/click advance the title & results screens (mobile menus).
	ui_confirm: ["Enter", "gamepad:start", "mouse:left"],
};
