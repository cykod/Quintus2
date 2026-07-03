# quintus2

A modern, TypeScript-first HTML5 game engine with a Godot-inspired Node/Scene Tree. The whole engine ships as **one** package — physics, sprites, input, audio, UI, tweens, camera, tilemaps, an optional JSX `build()` runtime, deterministic headless testing, and an optional Three.js 3D layer.

## Install

```bash
npm install quintus2
# for 3D, also install the peer:
npm install quintus2 three
```

The fastest way to start a project is the scaffolder:

```bash
npm create quintus2@latest my-game
```

## Usage

```ts
import { Game, Actor, PhysicsPlugin, InputPlugin, Vec2 } from "quintus2";

class Player extends Actor {
	speed = 200;
	jumpForce = -400;

	onFixedUpdate(dt: number) {
		if (this.game.input.isPressed("right")) this.velocity.x = this.speed;
		if (this.game.input.isJustPressed("jump") && this.isOnFloor()) {
			this.velocity.y = this.jumpForce;
		}
		this.move(dt);
	}
}

const game = new Game({ width: 320, height: 240, canvas: "game", seed: 42 });
game.use(PhysicsPlugin());
game.use(InputPlugin({ actions: { right: ["ArrowRight"], jump: ["Space"] } }));
game.start(/* your Scene */);
```

## Entry points

| Import | What |
|--------|------|
| `quintus2` | Core engine: Node/Node2D/Actor, physics, sprites, input, audio, UI, tween, camera, tilemap, prefabs, math |
| `quintus2/jsx-runtime` | JSX runtime for `jsxImportSource: "quintus2"` (declarative `build()` composition) |
| `quintus2/three` | Optional Three.js 3D layer (requires the `three` peer dependency) |
| `quintus2/testing` | Headless runtime + deterministic test helpers for game test suites |

## Docs

Full documentation: https://github.com/cykod/quintus2#readme

## License

MIT © Cykod LLC
