import { describe, expect, it } from "vitest";
import { CardinalDirection, Direction } from "../direction.js";

describe("Direction", () => {
	it("dx/dz arrays match cardinal directions", () => {
		// North: -Z
		expect(Direction.dx[CardinalDirection.North]).toBe(0);
		expect(Direction.dz[CardinalDirection.North]).toBe(-1);

		// East: +X
		expect(Direction.dx[CardinalDirection.East]).toBe(1);
		expect(Direction.dz[CardinalDirection.East]).toBe(0);

		// South: +Z
		expect(Direction.dx[CardinalDirection.South]).toBe(0);
		expect(Direction.dz[CardinalDirection.South]).toBe(1);

		// West: -X
		expect(Direction.dx[CardinalDirection.West]).toBe(-1);
		expect(Direction.dz[CardinalDirection.West]).toBe(0);
	});

	it("angles match Three.js convention", () => {
		expect(Direction.angle[CardinalDirection.North]).toBe(0);
		expect(Direction.angle[CardinalDirection.East]).toBe(-Math.PI / 2);
		expect(Direction.angle[CardinalDirection.South]).toBe(Math.PI);
		expect(Direction.angle[CardinalDirection.West]).toBe(Math.PI / 2);
	});

	it("fromDelta finds correct direction", () => {
		expect(Direction.fromDelta(0, -1)).toBe(CardinalDirection.North);
		expect(Direction.fromDelta(1, 0)).toBe(CardinalDirection.East);
		expect(Direction.fromDelta(0, 1)).toBe(CardinalDirection.South);
		expect(Direction.fromDelta(-1, 0)).toBe(CardinalDirection.West);
	});

	it("fromDelta returns -1 for non-cardinal", () => {
		expect(Direction.fromDelta(1, 1)).toBe(-1);
		expect(Direction.fromDelta(0, 0)).toBe(-1);
	});

	it("rotate clockwise", () => {
		expect(Direction.rotate(CardinalDirection.North, 1)).toBe(CardinalDirection.East);
		expect(Direction.rotate(CardinalDirection.East, 1)).toBe(CardinalDirection.South);
		expect(Direction.rotate(CardinalDirection.West, 1)).toBe(CardinalDirection.North);
	});

	it("rotate counter-clockwise", () => {
		expect(Direction.rotate(CardinalDirection.North, -1)).toBe(CardinalDirection.West);
		expect(Direction.rotate(CardinalDirection.East, -1)).toBe(CardinalDirection.North);
	});

	it("rotate wraps around", () => {
		expect(Direction.rotate(CardinalDirection.North, 4)).toBe(CardinalDirection.North);
		expect(Direction.rotate(CardinalDirection.North, -4)).toBe(CardinalDirection.North);
	});

	it("opposite returns opposite direction", () => {
		expect(Direction.opposite(CardinalDirection.North)).toBe(CardinalDirection.South);
		expect(Direction.opposite(CardinalDirection.East)).toBe(CardinalDirection.West);
		expect(Direction.opposite(CardinalDirection.South)).toBe(CardinalDirection.North);
		expect(Direction.opposite(CardinalDirection.West)).toBe(CardinalDirection.East);
	});

	it("toAngle returns angle for direction", () => {
		expect(Direction.toAngle(CardinalDirection.North)).toBe(0);
		expect(Direction.toAngle(CardinalDirection.South)).toBe(Math.PI);
	});
});
