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

// === Physics Plugin ===
const game = new Game({
	width: 400,
	height: 300,
	canvas: "game",
	backgroundColor: "#1a1a2e",
});
game.use(
	PhysicsPlugin({
		gravity: new Vec2(0, 800),
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
	speed = 150;
	jumpForce = -350;
	collisionGroup = "player";

	onReady() {
		super.onReady();
		this.addChild(CollisionShape).shape = Shape.rect(14, 24);
		this.tag("player");
	}

	onFixedUpdate(dt: number) {
		const input = this.game.input;
		this.velocity.x = 0;
		if (input.isPressed("move_left")) this.velocity.x = -this.speed;
		if (input.isPressed("move_right")) this.velocity.x = this.speed;
		if (input.isJustPressed("jump") && this.isOnFloor()) {
			this.velocity.y = this.jumpForce;
		}
		this.move(dt);
	}

	onDraw(ctx: DrawContext) {
		ctx.rect(new Vec2(-7, -12), new Vec2(14, 24), {
			fill: Color.fromHex("#4fc3f7"),
		});
	}
}

// === Coin ===
class Coin extends Sensor {
	readonly collected: Signal<void> = signal<void>();
	collisionGroup = "coins";

	onReady() {
		super.onReady();
		this.addChild(CollisionShape).shape = Shape.circle(8);
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
		this.position.y = this._baseY + Math.sin(this._time * 3) * 4;
	}

	onDraw(ctx: DrawContext) {
		ctx.circle(Vec2.ZERO, 8, { fill: Color.fromHex("#ffd54f") });
	}
}

// === Helper: Drawable StaticCollider ===
function addPlatform(
	scene: Scene,
	x: number,
	y: number,
	w: number,
	h: number,
	color: string,
): StaticCollider {
	const plat = new DrawableStatic(w, h, Color.fromHex(color));
	plat.position = new Vec2(x, y);
	plat.collisionGroup = "world";
	scene.addChild(plat);
	return plat;
}

class DrawableStatic extends StaticCollider {
	constructor(
		private w: number,
		private h: number,
		private color: Color,
	) {
		super();
	}

	onReady() {
		super.onReady();
		this.addChild(CollisionShape).shape = Shape.rect(this.w, this.h);
	}

	onDraw(ctx: DrawContext) {
		ctx.rect(new Vec2(-this.w / 2, -this.h / 2), new Vec2(this.w, this.h), { fill: this.color });
	}
}

// === Scene ===
class DemoScene extends Scene {
	onReady() {
		// Floor
		addPlatform(this, 200, 280, 400, 20, "#555555");

		// Platforms
		addPlatform(this, 100, 220, 80, 12, "#666666");
		addPlatform(this, 250, 180, 80, 12, "#666666");
		addPlatform(this, 150, 120, 80, 12, "#666666");

		// Walls
		addPlatform(this, 10, 200, 20, 160, "#777777");
		addPlatform(this, 390, 200, 20, 160, "#777777");

		// Coins
		let score = 0;
		for (const [x, y] of [
			[100, 200],
			[250, 160],
			[150, 100],
		] as const) {
			const coin = this.add(Coin);
			coin.position = new Vec2(x, y);
			coin.collected.connect(() => {
				score++;
				console.log(`Score: ${score}`);
			});
		}

		// Player
		const player = this.add(Player);
		player.position = new Vec2(200, 100);
	}
}

game.start(DemoScene);
