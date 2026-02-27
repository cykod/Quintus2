import { Node2D, Scene } from "@quintus/core";
import { describe, expect, test } from "vitest";
import { assertDeterministic } from "./assert-deterministic.js";
import { InputScript } from "./input-script.js";

class SimpleScene extends Scene {
	onReady(): void {
		const child = this.add(Node2D);
		child.name = "Mover";
		child.position.x = 0;
		child.position.y = 0;
	}
}

class DeterministicScene extends Scene {
	onReady(): void {
		const child = this.add(Node2D);
		child.name = "Mover";
		child.position.x = 0;
	}
	onFixedUpdate(dt: number): void {
		const mover = this.find("Mover");
		if (mover && mover instanceof Node2D) {
			mover.position.x += 100 * dt;
		}
	}
}

describe("assertDeterministic", () => {
	test("passes for deterministic scene (3 runs)", async () => {
		await expect(
			assertDeterministic({
				scene: DeterministicScene,
				seed: 42,
				duration: 1,
			}),
		).resolves.toBeUndefined();
	});

	test("passes with input script", async () => {
		await expect(
			assertDeterministic(
				{
					scene: SimpleScene,
					seed: 42,
					input: InputScript.create().wait(30),
				},
				3,
			),
		).resolves.toBeUndefined();
	});

	test("runs multiple times without errors", async () => {
		await assertDeterministic(
			{
				scene: SimpleScene,
				seed: 99,
				duration: 0.5,
			},
			5,
		);
	});

	test("throws and cleans up on determinism failure", async () => {
		class NonDeterministicScene extends Scene {
			onReady(): void {
				const child = this.add(Node2D);
				child.name = "Random";
				// Use Math.random() which is NOT seeded — different each run
				child.position.x = Math.random() * 1000;
			}
		}

		await expect(
			assertDeterministic(
				{
					scene: NonDeterministicScene,
					seed: 42,
					duration: 0.1,
				},
				3,
			),
		).rejects.toThrow("Determinism failure");
	});
});
