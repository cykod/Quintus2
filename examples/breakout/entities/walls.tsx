import { Node } from "@quintus/core";
import { CollisionShape, Shape, StaticCollider } from "@quintus/physics";
import { GAME_HEIGHT, GAME_WIDTH } from "../config.js";

/**
 * Invisible boundary walls (top, left, right). No bottom wall — the ball
 * falls off the screen when missed by the paddle.
 */
export class Walls extends Node {
	override build() {
		return (
			<>
				{/* Left wall */}
				<StaticCollider collisionGroup="walls" position={[-5, GAME_HEIGHT / 2]}>
					<CollisionShape shape={Shape.rect(10, GAME_HEIGHT + 20)} />
				</StaticCollider>

				{/* Right wall */}
				<StaticCollider collisionGroup="walls" position={[GAME_WIDTH + 5, GAME_HEIGHT / 2]}>
					<CollisionShape shape={Shape.rect(10, GAME_HEIGHT + 20)} />
				</StaticCollider>

				{/* Top wall */}
				<StaticCollider collisionGroup="walls" position={[GAME_WIDTH / 2, -5]}>
					<CollisionShape shape={Shape.rect(GAME_WIDTH + 20, 10)} />
				</StaticCollider>
			</>
		);
	}
}
