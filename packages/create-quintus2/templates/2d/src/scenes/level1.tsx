import { Scene } from "quintus2";
import { TOTAL_COINS } from "../config.js";
import { Block } from "../entities/block.js";
import { Coin } from "../entities/coin.js";
import { Enemy } from "../entities/enemy.js";
import { Player } from "../entities/player.js";
import { HUD } from "../hud/hud.js";
import { gameState } from "../state.js";

/**
 * The playable level: a bordered arena (floor + side walls so you can't fall off),
 * a staircase of platforms, three coins to collect, and a patrolling enemy. Collect
 * all three coins and the scene switches to the win screen.
 */
export class Level1 extends Scene {
	/** Set true once the last coin is collected; the switch happens in onUpdate. */
	private won = false;
	private leaving = false;

	override build() {
		return (
			<>
				{/* Floor + side walls — the arena border. */}
				<Block w={640} h={32} color="#4a3b2a" topColor="#6b5a3f" position={[320, 464]} />
				<Block w={24} h={480} color="#2c2340" position={[12, 240]} />
				<Block w={24} h={480} color="#2c2340" position={[628, 240]} />

				{/* Platform staircase (bottom-left → top-right). */}
				<Block w={120} h={20} color="#3a2e4d" topColor="#5a4a70" position={[230, 405]} />
				<Block w={120} h={20} color="#3a2e4d" topColor="#5a4a70" position={[360, 350]} />
				<Block w={120} h={20} color="#3a2e4d" topColor="#5a4a70" position={[490, 300]} />

				{/* Three coins: one on the floor, one on each of the upper platforms. */}
				<Coin position={[560, 440]} />
				<Coin position={[360, 332]} />
				<Coin position={[490, 282]} />

				<Enemy position={[300, 430]} />
				<Player position={[90, 400]} />
				<HUD />
			</>
		);
	}

	override onReady() {
		// Fresh start every time the level loads (also resets score/lives/coins for the HUD).
		gameState.reset();
		gameState.on("coins").connect(({ value }) => {
			if (value >= TOTAL_COINS) this.won = true;
		});
	}

	override onUpdate() {
		// Switch scenes here (variable-step, outside the physics walk) so we never tear
		// down the scene tree mid-collision.
		if (this.won && !this.leaving) {
			this.leaving = true;
			this.game.start("win");
		}
	}
}
