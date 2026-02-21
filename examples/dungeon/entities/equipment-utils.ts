import { Vec2 } from "@quintus/math";
import type { Direction } from "./player.js";

/** Convert a Vec2 direction to a cardinal Direction. */
export function vec2ToDirection(v: Vec2): Direction {
	if (Math.abs(v.x) >= Math.abs(v.y)) {
		return v.x >= 0 ? "right" : "left";
	}
	return v.y >= 0 ? "down" : "up";
}

/** Starting rotation for weapon swing based on facing direction. */
export function directionToSwingStart(dir: Direction): number {
	switch (dir) {
		case "right":
			return -Math.PI / 4;
		case "left":
			return Math.PI / 4;
		case "up":
			return -Math.PI / 2;
		case "down":
			return Math.PI / 2;
	}
}

/** Ending rotation for weapon swing based on facing direction. */
export function directionToSwingEnd(dir: Direction): number {
	switch (dir) {
		case "right":
			return Math.PI / 4;
		case "left":
			return -Math.PI / 4;
		case "up":
			return 0;
		case "down":
			return Math.PI;
	}
}

/** Shield raise offset based on facing direction. */
export function directionToShieldRaise(dir: Direction): { x: number; y: number } {
	switch (dir) {
		case "right":
			return { x: 4, y: 0 };
		case "left":
			return { x: -4, y: 0 };
		case "up":
			return { x: 0, y: -4 };
		case "down":
			return { x: 0, y: 4 };
	}
}

/** Unit vector for a facing direction (useful for hitbox positioning). */
export function directionToOffset(dir: Direction): Vec2 {
	switch (dir) {
		case "right":
			return new Vec2(1, 0);
		case "left":
			return new Vec2(-1, 0);
		case "up":
			return new Vec2(0, -1);
		case "down":
			return new Vec2(0, 1);
	}
}
