import { Camera } from "@quintus/camera";
import type { DrawContext } from "@quintus/core";
import { Game, Scene, type Signal, signal } from "@quintus/core";
import { InputPlugin } from "@quintus/input";
import { Color, Vec2 } from "@quintus/math";
import {
	Actor,
	CollisionShape,
	PhysicsPlugin,
	Sensor,
	Shape,
	StaticCollider,
} from "@quintus/physics";
import { TileMap } from "@quintus/tilemap";

// Register physics factories for tilemap collision generation
TileMap.registerPhysics({
	StaticCollider: StaticCollider as never,
	CollisionShape: CollisionShape as never,
	shapeRect: Shape.rect,
});

// === Game Setup ===
const game = new Game({
	width: 320,
	height: 240,
	canvas: "game",
	backgroundColor: "#2a1a3e",
	pixelArt: true,
});

game.use(
	PhysicsPlugin({
		gravity: new Vec2(0, 600),
		collisionGroups: {
			player: { collidesWith: ["world", "coins"] },
			world: { collidesWith: ["player"] },
			coins: { collidesWith: ["player"] },
		},
	}),
);

game.use(
	InputPlugin({
		actions: {
			move_left: ["ArrowLeft", "KeyA"],
			move_right: ["ArrowRight", "KeyD"],
			jump: ["ArrowUp", "Space", "KeyW"],
		},
	}),
);

// === Player ===
class Player extends Actor {
	speed = 120;
	jumpForce = -300;
	collisionGroup = "player";

	onReady() {
		super.onReady();
		this.addChild(CollisionShape).shape = Shape.rect(12, 14);
		this.tag("player");
	}

	onFixedUpdate(dt: number) {
		const input = this.game?.input;
		if (!input) return;
		this.velocity.x = 0;
		if (input.isPressed("move_left")) this.velocity.x = -this.speed;
		if (input.isPressed("move_right")) this.velocity.x = this.speed;
		if (input.isJustPressed("jump") && this.isOnFloor()) {
			this.velocity.y = this.jumpForce;
		}
		this.move(dt);
	}

	onDraw(ctx: DrawContext) {
		// Body
		ctx.rect(new Vec2(-6, -7), new Vec2(12, 14), {
			fill: Color.fromHex("#4fc3f7"),
		});
		// Eyes
		ctx.rect(new Vec2(-3, -5), new Vec2(2, 2), {
			fill: Color.fromHex("#1a1a2e"),
		});
		ctx.rect(new Vec2(1, -5), new Vec2(2, 2), {
			fill: Color.fromHex("#1a1a2e"),
		});
	}
}

// === Coin ===
class Coin extends Sensor {
	readonly collected: Signal<void> = signal<void>();
	collisionGroup = "coins";

	onReady() {
		super.onReady();
		this.addChild(CollisionShape).shape = Shape.circle(6);
		this.bodyEntered.connect((body) => {
			if (body.hasTag("player")) {
				this.collected.emit();
				this.destroy();
			}
		});
	}

	private _time = 0;
	private _baseY: number | null = null;
	onUpdate(dt: number) {
		if (this._baseY === null) this._baseY = this.position.y;
		this._time += dt;
		this.position.y = this._baseY + Math.sin(this._time * 4) * 3;
	}

	onDraw(ctx: DrawContext) {
		ctx.circle(Vec2.ZERO, 6, { fill: Color.fromHex("#ffd54f") });
		// Inner shine
		ctx.circle(new Vec2(-1, -1), 2, { fill: Color.fromHex("#fff9c4") });
	}
}

// === Score Display (drawn as HUD, not in world space) ===
let score = 0;
const totalCoins = 5;

function updateScoreDisplay() {
	const el = document.getElementById("score");
	if (el) el.textContent = `Coins: ${score} / ${totalCoins}`;
}

// === Scene ===
class TilemapScene extends Scene {
	onReady() {
		// Load the tilemap
		const map = this.add(TileMap);
		map.asset = "level1";

		// Generate collision for the ground layer
		map.generateCollision({
			layer: "ground",
			allSolid: true,
			collisionGroup: "world",
		});

		// Get player spawn point
		const playerStart = map.getSpawnPoint("player_start");

		// Spawn the player
		const player = this.add(Player);
		player.position.x = playerStart.x;
		player.position.y = playerStart.y;

		// Spawn coins from the entities layer
		const coinObjects = map.getObjects("entities").filter((o) => o.type === "Coin");
		for (const obj of coinObjects) {
			const coin = this.add(Coin);
			coin.position.x = obj.x + 8; // Center the coin (Tiled uses top-left)
			coin.position.y = obj.y + 8;
			coin.collected.connect(() => {
				score++;
				updateScoreDisplay();
				if (score >= totalCoins) {
					console.log("All coins collected!");
				}
			});
		}

		// Set up the camera
		const camera = this.add(Camera);
		camera.follow = player;
		camera.smoothing = 0.15;
		camera.zoom = 2;
		camera.bounds = map.bounds;
	}
}

// === Load Assets and Start ===
async function main() {
	await game.assets.load({
		images: ["assets/tiles.png"],
		json: ["assets/level1.json"],
	});
	game.start(TilemapScene);
}

main().catch(console.error);
