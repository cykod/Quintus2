import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { AudioPlugin } from "@quintus/audio";
import { Camera } from "@quintus/camera";
import { _resetNodeIdCounter, type Plugin, Scene } from "@quintus/core";
import type { HeadlessGame } from "@quintus/headless";
import { InputPlugin } from "@quintus/input";
import { Vec2 } from "@quintus/math";
import { CollisionShape, PhysicsPlugin, Shape, StaticCollider } from "@quintus/physics";
import type { InputScript } from "@quintus/test";
import { TestRunner } from "@quintus/test";
import { TweenPlugin } from "@quintus/tween";
import { COLLISION_GROUPS, INPUT_BINDINGS } from "../config.js";
import { BrickBlock, CoinBlock, ExclamationBlock } from "../entities/breakable-block.js";
import type { BaseEnemy } from "../entities/enemies/base-enemy.js";
import { Snail } from "../entities/enemies/snail.js";
import { FallAwayPlatform } from "../entities/fall-away-platform.js";
import { LadderZone } from "../entities/ladder-zone.js";
import { Player } from "../entities/player.js";
import { Spring } from "../entities/spring.js";
import { loadAtlases } from "../sprites.js";
import { gameState } from "../state.js";

const ASSETS_DIR = resolve(import.meta.dirname, "..", "assets");

const XML_FILES = ["characters", "enemies", "tiles"];

export function advancedPlatformerPlugins(): Plugin[] {
	return [
		PhysicsPlugin({
			gravity: new Vec2(0, 800),
			collisionGroups: COLLISION_GROUPS,
		}),
		InputPlugin({ actions: INPUT_BINDINGS }),
		TweenPlugin(),
		AudioPlugin(),
	];
}

/**
 * Load XML atlas assets from disk and store them in the game's asset loader.
 * Images are not needed since renderer is null in headless mode.
 */
export async function loadAdvancedPlatformerAssets(game: HeadlessGame): Promise<void> {
	for (const name of XML_FILES) {
		const xml = await readFile(resolve(ASSETS_DIR, `${name}.xml`), "utf-8");
		game.assets._storeCustom(name, xml);
	}
	loadAtlases(game);
}

export function resetState(): void {
	gameState.reset();
	_resetNodeIdCounter();
}

const PLUGINS = advancedPlatformerPlugins();

/** Floor collider with collisionGroup pre-set to "world". */
class Floor extends StaticCollider {
	override collisionGroup = "world";

	override build() {
		return <CollisionShape shape={Shape.rect(640, 16)} />;
	}
}

/** Wall collider with collisionGroup pre-set to "world". */
export class Wall extends StaticCollider {
	override collisionGroup = "world";

	override build() {
		return <CollisionShape shape={Shape.rect(16, 240)} />;
	}
}

/**
 * A minimal test scene with a flat floor and a player.
 * Player starts at (320, 280), floor at (320, 308).
 */
export class TestArena extends Scene {
	player!: Player;
	camera!: Camera;

	override build() {
		return (
			<>
				<Player ref="player" />
				<Camera ref="camera" follow="$player" zoom={1} />
				<Floor position={[320, 308]} />
			</>
		);
	}

	override onReady() {
		this.player.position = new Vec2(320, 280);
	}
}

/** Generic helper to run any scene in the test harness. */
export function runScene(
	scene: typeof Scene,
	input?: InputScript,
	duration?: number,
	afterReset?: () => void,
) {
	return TestRunner.run({
		scene,
		seed: 42,
		width: 640,
		height: 360,
		plugins: PLUGINS,
		input,
		duration,
		snapshotInterval: 0,
		setup: loadAdvancedPlatformerAssets,
		beforeRun: () => {
			resetState();
			afterReset?.();
		},
	});
}

/** Run the minimal TestArena scene for controlled entity testing. */
export function runArena(input?: InputScript, duration?: number, afterReset?: () => void) {
	return runScene(TestArena, input, duration, afterReset);
}

// ── Slope collider helpers ──────────────────────────────────────────

/** Right-ascending 45° slope (64×64 triangle). */
class Slope45 extends StaticCollider {
	override collisionGroup = "world";

	override build() {
		return (
			<CollisionShape
				shape={Shape.polygon([new Vec2(-32, 32), new Vec2(32, -32), new Vec2(32, 32)])}
			/>
		);
	}
}

/** Left-ascending 45° slope (flipped horizontally). */
class Slope45Flipped extends StaticCollider {
	override collisionGroup = "world";

	override build() {
		return (
			<CollisionShape
				shape={Shape.polygon([new Vec2(-32, 32), new Vec2(-32, -32), new Vec2(32, 32)])}
			/>
		);
	}
}

/** Long slope segment A (leftmost) — triangle, rises bottom third. */
class LongSlopeA extends StaticCollider {
	override collisionGroup = "world";

	override build() {
		return (
			<CollisionShape
				shape={Shape.polygon([new Vec2(-32, 32), new Vec2(32, 11), new Vec2(32, 32)])}
			/>
		);
	}
}

/** Long slope segment B (middle) — quad, rises middle third. */
class LongSlopeB extends StaticCollider {
	override collisionGroup = "world";

	override build() {
		return (
			<CollisionShape
				shape={Shape.polygon([
					new Vec2(-32, 11),
					new Vec2(32, -11),
					new Vec2(32, 32),
					new Vec2(-32, 32),
				])}
			/>
		);
	}
}

/** Long slope segment C (rightmost) — quad, rises top third. */
class LongSlopeC extends StaticCollider {
	override collisionGroup = "world";

	override build() {
		return (
			<CollisionShape
				shape={Shape.polygon([
					new Vec2(-32, -11),
					new Vec2(32, -32),
					new Vec2(32, 32),
					new Vec2(-32, 32),
				])}
			/>
		);
	}
}

/** One-way platform collider. */
class OneWayPlatform extends StaticCollider {
	override collisionGroup = "world";
	override oneWay = true;

	override build() {
		return <CollisionShape shape={Shape.rect(128, 16)} />;
	}
}

/** Narrow floor (left half only). */
export class HalfFloor extends StaticCollider {
	override collisionGroup = "world";

	override build() {
		return <CollisionShape shape={Shape.rect(400, 16)} />;
	}
}

/** Platform at slope top. */
class TopPlatform extends StaticCollider {
	override collisionGroup = "world";

	override build() {
		return <CollisionShape shape={Shape.rect(200, 16)} />;
	}
}

// ── Arena scenes ────────────────────────────────────────────────────

/**
 * SlopeArena: flat floor on left, 45° right-ascending slope, platform at top.
 * Left floor: x=0..400, top at y=300.
 * Slope: (432, 268), surface from (400,300) to (464,236).
 * Top platform: x=464..664, top at y=236.
 * Player starts at (100, 280).
 */
export class SlopeArena extends Scene {
	player!: Player;
	camera!: Camera;

	override build() {
		return (
			<>
				<Player ref="player" />
				<Camera ref="camera" follow="$player" zoom={1} />
				<HalfFloor position={[200, 308]} />
				<Slope45 position={[432, 268]} />
				<TopPlatform position={[564, 244]} />
			</>
		);
	}

	override onReady() {
		this.player.position = new Vec2(100, 280);
	}
}

/**
 * SlopeDescentArena: same geometry as SlopeArena, but player starts on the top platform.
 * Player at (540, 216), walks left to descend the slope.
 */
export class SlopeDescentArena extends Scene {
	player!: Player;
	camera!: Camera;

	override build() {
		return (
			<>
				<Player ref="player" />
				<Camera ref="camera" follow="$player" zoom={1} />
				<HalfFloor position={[200, 308]} />
				<Slope45 position={[432, 268]} />
				<TopPlatform position={[564, 244]} />
			</>
		);
	}

	override onReady() {
		this.player.position = new Vec2(540, 216);
	}
}

/**
 * FlippedSlopeArena: flat floor on right, left-ascending slope, platform at top-left.
 * Right floor: x=240..640, top at y=300.
 * Slope: (208, 268), surface from (240,300) up-left to (176,236).
 * Top platform: x=-24..176, top at y=236.
 * Player starts at (540, 280), walks left to ascend.
 */
export class FlippedSlopeArena extends Scene {
	player!: Player;
	camera!: Camera;

	override build() {
		return (
			<>
				<Player ref="player" />
				<Camera ref="camera" follow="$player" zoom={1} />
				<HalfFloor position={[440, 308]} />
				<Slope45Flipped position={[208, 268]} />
				<TopPlatform position={[76, 244]} />
			</>
		);
	}

	override onReady() {
		this.player.position = new Vec2(540, 280);
	}
}

/**
 * LongSlopeArena: flat floor, 3-tile shallow slope (~18°), platform at top.
 * Left floor: x=0..300, top at y=300.
 * Slope A: (332, 268), slope B: (396, 268), slope C: (460, 268).
 * Surface rises from (300,300) to (492,236).
 * Top platform: x=492..692, top at y=236.
 * Player starts at (100, 280).
 */
export class LongSlopeArena extends Scene {
	player!: Player;
	camera!: Camera;

	override build() {
		return (
			<>
				<Player ref="player" />
				<Camera ref="camera" follow="$player" zoom={1} />
				<HalfFloor position={[150, 308]} />
				<LongSlopeA position={[332, 268]} />
				<LongSlopeB position={[396, 268]} />
				<LongSlopeC position={[460, 268]} />
				<TopPlatform position={[592, 244]} />
			</>
		);
	}

	override onReady() {
		this.player.position = new Vec2(100, 280);
	}
}

/**
 * OneWayArena: flat floor + one-way platform above.
 * Floor: x=0..640, top at y=300.
 * One-way platform: x=256..384, top at y=192.
 * Player starts at (320, 280) on the floor.
 */
export class OneWayArena extends Scene {
	player!: Player;
	camera!: Camera;

	override build() {
		return (
			<>
				<Player ref="player" />
				<Camera ref="camera" follow="$player" zoom={1} />
				<Floor position={[320, 308]} />
				<OneWayPlatform position={[320, 200]} />
			</>
		);
	}

	override onReady() {
		this.player.position = new Vec2(320, 280);
	}
}

// ── Interactive tile arenas ─────────────────────────────────────────

/**
 * BreakableBlockArena: Floor + BrickBlock above player + CoinBlock + ExclamationBlock.
 * Floor top at y=300. Blocks at y=200 (100px above floor surface).
 * Player starts at (320, 280) on the floor, can jump up into blocks.
 */
export class BreakableBlockArena extends Scene {
	player!: Player;
	camera!: Camera;

	override build() {
		return (
			<>
				<Player ref="player" />
				<Camera ref="camera" follow="$player" zoom={1} />
				<Floor position={[320, 308]} />
				<BrickBlock position={[260, 200]} />
				<CoinBlock position={[320, 200]} />
				<ExclamationBlock position={[380, 200]} />
			</>
		);
	}

	override onReady() {
		this.player.position = new Vec2(320, 280);

		// Wire contact callbacks for breakable blocks
		this.game.physics.onContact("player", "world", (player, other, info) => {
			if (
				info.normal.y > 0 &&
				(other instanceof BrickBlock ||
					other instanceof CoinBlock ||
					other instanceof ExclamationBlock)
			) {
				(other as BrickBlock | CoinBlock | ExclamationBlock).hitFromBelow(player as Player);
			}
		});
	}
}

/**
 * SpringArena: Floor + Spring on the floor surface.
 * Floor top at y=300, spring at (400, 268) — sitting on the floor.
 * Player starts at (200, 280) and walks right onto the spring.
 */
export class SpringArena extends Scene {
	player!: Player;
	camera!: Camera;

	override build() {
		return (
			<>
				<Player ref="player" />
				<Camera ref="camera" follow="$player" zoom={1} />
				<Floor position={[320, 308]} />
				<Spring position={[400, 268]} />
			</>
		);
	}

	override onReady() {
		this.player.position = new Vec2(200, 280);

		this.game.physics.onContact("player", "world", (player, other, info) => {
			if (info.normal.y < 0 && other instanceof Spring) {
				other.bounce(player as Player);
			}
		});
	}
}

/**
 * FallAwayArena: FallAwayPlatform above the floor.
 * Floor at y=308 (top at y=300). FallAway platform at y=244 (top at y=212).
 * Player starts on the fall-away platform.
 */
export class FallAwayArena extends Scene {
	player!: Player;
	camera!: Camera;

	override build() {
		return (
			<>
				<Player ref="player" />
				<Camera ref="camera" follow="$player" zoom={1} />
				<Floor position={[320, 308]} />
				<FallAwayPlatform position={[320, 244]} />
			</>
		);
	}

	override onReady() {
		this.player.position = new Vec2(320, 216);

		this.game.physics.onContact("player", "world", (_player, other, info) => {
			if (info.normal.y < 0 && other instanceof FallAwayPlatform) {
				other.trigger();
			}
		});
	}
}

/** Small platform for ladder test. */
class SmallPlatform extends StaticCollider {
	override collisionGroup = "world";

	override build() {
		return <CollisionShape shape={Shape.rect(200, 16)} />;
	}
}

/**
 * LadderArena: Floor + ladder zone sensor (manually placed, not from tilemap).
 * Floor top at y=300. Ladder from y=150 to y=300.
 * Player starts at (320, 280) on the floor near the ladder.
 * Small platform at top of ladder so player can climb to it.
 */
export class LadderArena extends Scene {
	player!: Player;
	camera!: Camera;
	ladder!: LadderZone;

	override build() {
		return (
			<>
				<Player ref="player" />
				<Camera ref="camera" follow="$player" zoom={1} />
				<Floor position={[320, 308]} />
				<SmallPlatform position={[320, 158]} />
				<LadderZone ref="ladder" position={[320, 225]} />
			</>
		);
	}

	override onReady() {
		this.player.position = new Vec2(320, 280);
		this.ladder.ladderTop = 150;
		this.ladder.ladderBottom = 300;
		this.ladder.add(CollisionShape, { shape: Shape.rect(40, 150) });
	}
}

// ── Enemy arena ─────────────────────────────────────────────────

/**
 * EnemyArena: Floor + walls on both sides + player.
 * Player at (320, 280), floor top at y=300, walls at x=8 and x=632.
 * Wire stomp/damage contact in onReady().
 */
export class EnemyArena extends Scene {
	player!: Player;
	camera!: Camera;

	override build() {
		return (
			<>
				<Player ref="player" />
				<Camera ref="camera" follow="$player" zoom={1} />
				<Floor position={[320, 308]} />
				<Wall position={[8, 180]} />
				<Wall position={[632, 180]} />
			</>
		);
	}

	override onReady() {
		this.player.position = new Vec2(320, 280);
		this._wireEnemyContact();
	}

	private _wireEnemyContact(): void {
		this.game.physics.onContact("player", "enemies", (player, enemy, info) => {
			const p = player as Player;
			const e = enemy as BaseEnemy;

			// Star power: destroy any enemy on contact
			if (p.hasStarPower) {
				e.stomp();
				return;
			}

			// Stomp: player above and falling
			if (info.normal.y < 0 && p.velocity.y > 0) {
				// For snails, set kick direction based on relative position
				if (e instanceof Snail) {
					e.direction = Math.sign(e.position.x - p.position.x) || 1;
				}
				e.stomp();
				p.velocity.y = -250; // bounce
			} else {
				// Side/below contact → damage player
				p.takeDamage(1);
			}
		});

		// Hazard overlap (saw blades, etc.) — always damages player
		this.game.physics.onOverlap("player", "hazards", (player) => {
			(player as Player).takeDamage(1);
		});
	}
}

/**
 * HalfFloorEnemyArena: Half-width floor for testing edge detection.
 * Floor spans x=0..300 (center at 150), top at y=300.
 * Player at (100, 280).
 */
export class HalfFloorEnemyArena extends Scene {
	player!: Player;
	camera!: Camera;

	override build() {
		return (
			<>
				<Player ref="player" />
				<Camera ref="camera" follow="$player" zoom={1} />
				<HalfFloor position={[150, 308]} />
			</>
		);
	}

	override onReady() {
		this.player.position = new Vec2(100, 280);
	}
}

/** Run the EnemyArena scene for enemy testing. */
export function runEnemyArena(input?: InputScript, duration?: number, afterReset?: () => void) {
	return runScene(EnemyArena, input, duration, afterReset);
}

// ── Moving platform arena ───────────────────────────────────────────

import { MovingPlatform } from "../entities/moving-platform.js";

/**
 * MovingPlatformArena: Floor with a gap, horizontal moving platform above the gap.
 * Floor: two halves with a 200px gap in the middle.
 * Platform oscillates horizontally above the gap.
 * Player starts at (200, 280) on the left floor.
 */
export class MovingPlatformArena extends Scene {
	player!: Player;
	camera!: Camera;
	platform!: MovingPlatform;

	override build() {
		return (
			<>
				<Player ref="player" />
				<Camera ref="camera" follow="$player" zoom={1} />
				<Floor position={[320, 308]} />
				<MovingPlatform ref="platform" position={[320, 200]} />
			</>
		);
	}

	override onReady() {
		this.player.position = new Vec2(200, 280);
		this.platform.direction = "horizontal";
		this.platform.distance = 200;
		this.platform.speed = 100;
		this.platform.waitTime = 0;
	}
}

// ── Spike arena ─────────────────────────────────────────────────────

import { Spike } from "../entities/spike.js";

/**
 * SpikeArena: Floor with a spike sensor on the ground surface.
 * Floor top at y=300. Spike at (400, 268) — surface-level hazard.
 * Player starts at (200, 280) on the floor.
 */
export class SpikeArena extends Scene {
	player!: Player;
	camera!: Camera;

	override build() {
		return (
			<>
				<Player ref="player" />
				<Camera ref="camera" follow="$player" zoom={1} />
				<Floor position={[320, 308]} />
				<Spike position={[400, 268]} />
			</>
		);
	}

	override onReady() {
		this.player.position = new Vec2(200, 280);

		this.game.physics.onOverlap("player", "hazards", (player) => {
			(player as Player).takeDamage(1);
		});
	}
}

// ── Water zone arena ────────────────────────────────────────────────

import { Coin } from "../entities/coin.js";
import { DoorExit } from "../entities/door-exit.js";
import { Flag } from "../entities/flag.js";
import { Gem } from "../entities/gem.js";
import { HeartPickup } from "../entities/heart-pickup.js";
import { KeyPickup } from "../entities/key-pickup.js";
import { LockedDoor } from "../entities/locked-door.js";
import { PowerUp } from "../entities/power-up.js";
import { WaterZone } from "../entities/water-zone.js";

/**
 * WaterZoneArena: Half floor on left, water zone below on the right.
 * Player starts on the left floor and can walk off into the water.
 */
export class WaterZoneArena extends Scene {
	player!: Player;
	camera!: Camera;
	water!: WaterZone;

	override build() {
		return (
			<>
				<Player ref="player" />
				<Camera ref="camera" follow="$player" zoom={1} />
				<HalfFloor position={[150, 308]} />
				<WaterZone ref="water" position={[450, 340]} />
			</>
		);
	}

	override onReady() {
		this.player.position = new Vec2(100, 280);
		this.water.add(CollisionShape, { shape: Shape.rect(200, 40) });

		this.game.physics.onOverlap("player", "hazards", (player, hazard) => {
			const p = player as Player;
			if (hazard.hasTag("water")) {
				p.takeDamage(p.health);
			} else {
				p.takeDamage(1);
			}
		});
	}
}

// ── Collectible arenas ──────────────────────────────────────────────

/**
 * CoinArena: Floor + a coin to the right of the player.
 * Floor top at y=300. Coin at (400, 280).
 * Player starts at (200, 280) on the floor.
 */
export class CoinArena extends Scene {
	player!: Player;
	camera!: Camera;
	coin!: Coin;

	override build() {
		return (
			<>
				<Player ref="player" />
				<Camera ref="camera" follow="$player" zoom={1} />
				<Floor position={[320, 308]} />
				<Coin ref="coin" position={[400, 280]} />
			</>
		);
	}

	override onReady() {
		this.player.position = new Vec2(200, 280);
	}
}

/**
 * GemArena: Floor + a gem to the right of the player.
 */
export class GemArena extends Scene {
	player!: Player;
	camera!: Camera;
	gem!: Gem;

	override build() {
		return (
			<>
				<Player ref="player" />
				<Camera ref="camera" follow="$player" zoom={1} />
				<Floor position={[320, 308]} />
				<Gem ref="gem" position={[400, 280]} />
			</>
		);
	}

	override onReady() {
		this.player.position = new Vec2(200, 280);
	}
}

/**
 * HeartArena: Floor + heart pickup to the right.
 */
export class HeartArena extends Scene {
	player!: Player;
	camera!: Camera;
	heart!: HeartPickup;

	override build() {
		return (
			<>
				<Player ref="player" />
				<Camera ref="camera" follow="$player" zoom={1} />
				<Floor position={[320, 308]} />
				<HeartPickup ref="heart" position={[400, 280]} />
			</>
		);
	}

	override onReady() {
		this.player.position = new Vec2(200, 280);
	}
}

/**
 * PowerUpArena: Floor + star power-up to the right.
 */
export class PowerUpArena extends Scene {
	player!: Player;
	camera!: Camera;
	powerUp!: PowerUp;

	override build() {
		return (
			<>
				<Player ref="player" />
				<Camera ref="camera" follow="$player" zoom={1} />
				<Floor position={[320, 308]} />
				<PowerUp ref="powerUp" position={[400, 280]} />
			</>
		);
	}

	override onReady() {
		this.player.position = new Vec2(200, 280);
	}
}

/**
 * KeyLockArena: Floor + key + locked door blocking path.
 * Key at (300, 280), locked door at (500, 276).
 * Player starts at (100, 280).
 */
export class KeyLockArena extends Scene {
	player!: Player;
	camera!: Camera;
	key!: KeyPickup;
	door!: LockedDoor;

	override build() {
		return (
			<>
				<Player ref="player" />
				<Camera ref="camera" follow="$player" zoom={1} />
				<Floor position={[320, 308]} />
				<KeyPickup ref="key" position={[300, 280]} />
				<LockedDoor ref="door" position={[500, 276]} />
			</>
		);
	}

	override onReady() {
		this.player.position = new Vec2(100, 280);
		this.key.color = "red";
		this.door.color = "red";

		this.game.physics.onContact("player", "world", (_player, other) => {
			if (other instanceof LockedDoor && gameState.keys[other.color]) {
				other.open();
			}
		});
	}
}

/**
 * CheckpointArena: Floor + checkpoint flag to the right.
 * Flag at (400, 276). Player starts at (200, 280).
 */
export class CheckpointArena extends Scene {
	player!: Player;
	camera!: Camera;
	flag!: Flag;

	override build() {
		return (
			<>
				<Player ref="player" />
				<Camera ref="camera" follow="$player" zoom={1} />
				<Floor position={[320, 308]} />
				<Flag ref="flag" position={[400, 276]} />
			</>
		);
	}

	override onReady() {
		this.player.position = new Vec2(200, 280);
	}
}

/**
 * DoorExitArena: Floor + exit door to the right.
 * Door at (400, 276). Player starts at (200, 280).
 */
export class DoorExitArena extends Scene {
	player!: Player;
	camera!: Camera;
	door!: DoorExit;

	override build() {
		return (
			<>
				<Player ref="player" />
				<Camera ref="camera" follow="$player" zoom={1} />
				<Floor position={[320, 308]} />
				<DoorExit ref="door" position={[400, 276]} />
			</>
		);
	}

	override onReady() {
		this.player.position = new Vec2(200, 280);
	}
}
