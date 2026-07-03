import { CollisionShape, Scene, Shape, StaticCollider } from "quintus2";
import { Coin } from "../entities/coin.js";
import { Player } from "../entities/player.js";
import { HUD } from "../hud/hud.js";

/** Immovable ground the player lands on. */
class Floor extends StaticCollider {
	override collisionGroup = "world";

	override build() {
		return <CollisionShape shape={Shape.rect(320, 16)} />;
	}
}

/** The one scene: a floor, the player above it, a coin to collect, and the HUD. */
export class Level1 extends Scene {
	override build() {
		return (
			<>
				<Floor position={[160, 216]} />
				<Player position={[80, 100]} />
				<Coin position={[200, 200]} />
				<HUD />
			</>
		);
	}
}
