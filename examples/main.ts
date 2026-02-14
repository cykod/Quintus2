import type { DrawContext } from "@quintus/core";
import { Game, Node2D } from "@quintus/core";
import { Color, Vec2 } from "@quintus/math";

class Ball extends Node2D {
	velocity = new Vec2(200, 150);
	radius = 10;
	color = Color.RED;

	onFixedUpdate(dt: number): void {
		// Move
		this.position = this.position.add(this.velocity.scale(dt));

		// Bounce off walls
		const game = this.scene?.game;
		if (!game) return;
		if (this.position.x - this.radius < 0 || this.position.x + this.radius > game.width) {
			this.velocity = new Vec2(-this.velocity.x, this.velocity.y);
			// Clamp inside bounds
			this.position = new Vec2(
				Math.max(this.radius, Math.min(game.width - this.radius, this.position.x)),
				this.position.y,
			);
		}
		if (this.position.y - this.radius < 0 || this.position.y + this.radius > game.height) {
			this.velocity = new Vec2(this.velocity.x, -this.velocity.y);
			this.position = new Vec2(
				this.position.x,
				Math.max(this.radius, Math.min(game.height - this.radius, this.position.y)),
			);
		}
	}

	onDraw(ctx: DrawContext): void {
		ctx.circle(Vec2.ZERO, this.radius, { fill: this.color });
	}
}

class FPSDisplay extends Node2D {
	private frames = 0;
	private timer = 0;
	private fps = 0;

	onUpdate(dt: number): void {
		this.frames++;
		this.timer += dt;
		if (this.timer >= 1) {
			this.fps = this.frames;
			this.frames = 0;
			this.timer -= 1;
		}
	}

	onDraw(ctx: DrawContext): void {
		ctx.text(`FPS: ${this.fps}`, Vec2.ZERO, {
			size: 14,
			color: Color.WHITE,
		});
	}
}

// Create game
const game = new Game({
	width: 800,
	height: 600,
	canvas: "game",
	backgroundColor: "#1a1a2e",
	seed: 42,
});

// Define scene
game.scene("main", (scene) => {
	// Spawn multiple balls with random velocities
	for (let i = 0; i < 20; i++) {
		const ball = scene.add(Ball);
		ball.position = new Vec2(game.random.float(50, 750), game.random.float(50, 550));
		ball.velocity = game.random.direction().scale(game.random.float(100, 300));
		ball.radius = game.random.float(5, 15);
		ball.color = game.random.color();
	}

	// FPS counter in corner
	const fps = scene.add(FPSDisplay);
	fps.position = new Vec2(10, 10);
});

// Start
game.start("main");
