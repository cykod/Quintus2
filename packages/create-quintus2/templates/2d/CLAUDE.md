# Quintus 2 — 2D Game Starter

This is a starter game built on the **Quintus 2** HTML5 game engine (npm package `quintus2`).
Everything imports from that one package. This file is the engine cheat-sheet — enough to build
the game. For runtime debugging, see **Debugging** at the bottom and the `debug-game` skill in
`.claude/skills/`.

## Project Layout

```
index.html            <canvas id="game"> + module entry
src/
  main.ts             Game bootstrap: plugins, registerScenes, assets.load → start
  config.ts           COLLISION_GROUPS + INPUT_BINDINGS
  state.ts            reactiveState({ score, lives }) — the HUD listens to this
  sprites.ts          SpriteSheet (frames + animations) sliced from a tileset
  entities/player.tsx Actor — code-controlled movement + collision
  entities/coin.tsx   Sensor — overlap pickup
  scenes/level1.tsx   Scene — composes the floor, player, coin, HUD
  hud/hud.tsx         Layer — screen-fixed labels bound to reactiveState
  __tests__/          Headless Vitest smoke tests
public/assets/        Images + audio (fetched at runtime by relative path)
```

## Node / Scene Tree

Quintus is a **Node/Scene tree** (Godot-inspired), not an ECS. The core chain:

```
Node → Node2D → Actor | StaticCollider | Sensor
```

- **`Node`** — base class: parent/child tree, `build()`/`onReady()`/`onUpdate()`/`onFixedUpdate()` lifecycle.
- **`Node2D`** — adds a 2D transform (`position`, `rotation`, `scale`) that cascades to children.
- **`Actor`** — code-controlled movement + collision response via `this.move(dt)`. Has `velocity`,
  `isOnFloor()`, `isOnWall()`, and query helpers. Player, enemies, projectiles.
- **`StaticCollider`** — immovable collision (floors, walls, platforms). Supports one-way platforms.
- **`Sensor`** — overlap detection only (no physical blocking). Pickups, triggers. Emits `bodyEntered`.
- **`Scene`** — the root of a screen; register scenes by name and `game.start("name")`.
- **`Signal<T>`** — typed observer pattern (`sig.connect(fn)` / `sig.emit(value)`) for decoupled events.

## JSX `build()` Pattern

Nodes declare their children with JSX from a `build()` method — it runs when the node enters the
tree, before `onReady()`. Enabled via `tsconfig.json`: `"jsx": "react-jsx"`,
`"jsxImportSource": "quintus2"`. Files that use JSX are `.tsx`.

```tsx
class Player extends Actor {
	speed = 120;
	override collisionGroup = "player";
	override solid = true;
	sprite!: AnimatedSprite; // assigned by the string ref below

	override build() {
		return (
			<>
				<CollisionShape shape={Shape.rect(6, 7)} />
				<AnimatedSprite ref="sprite" spriteSheet={entitySheet} animation="player_idle" />
			</>
		);
	}
}
```

- **String refs** (`ref="sprite"`) assign the child to `this.sprite` on the build owner
  (declare it with definite assignment: `sprite!: AnimatedSprite`).
- **Callback refs** (`ref={node => ...}`) run custom logic.
- **Prop coercion**: tuples → `Vec2` (`position={[80, 100]}`), hex strings → `Color`
  (`color="#ffffff"`), a lone number → uniform scale, a function on a signal-named prop → a `connect`.

## Game Bootstrap (`main.ts`)

```ts
const game = new Game({ width: 320, height: 240, canvas: "game", scale: "fit", pixelArt: true, seed: 42 });

game.use(PhysicsPlugin({ gravity: new Vec2(0, 800), collisionGroups: COLLISION_GROUPS }));
game.use(InputPlugin({ actions: INPUT_BINDINGS }));
game.use(AudioPlugin());

game.registerScenes({ level1: Level1 });

game.assets
	.load({ images: ["assets/tiles.png"], audio: ["assets/coin.ogg"] })
	.then(() => game.start("level1"));
```

- **`new Game(...)`** — the `Game` class (constructed with `new`, not a factory). `seed` makes the
  sim deterministic. `scale: "fit"` keeps the canvas responsive.
- **Plugins** (`game.use(...)`) add capabilities and accessors: `PhysicsPlugin` → gravity + collision,
  `InputPlugin` → `game.input`, `AudioPlugin` → `game.audio`.
- **`registerScenes({ name: SceneClass })`** avoids circular imports; start with `game.start("name")`.
- **`assets.load({ images, audio })`** fetches by relative path; call `game.start` in `.then(...)`.

## Input

Named actions map to keys/gamepad in `config.ts` (`INPUT_BINDINGS`), read via `game.input`:

```ts
if (this.game.input.isPressed("right")) this.velocity.x = this.speed;
if (this.game.input.isJustPressed("jump") && this.isOnFloor()) this.velocity.y = this.jumpForce;
this.move(dt); // Actor: apply velocity + resolve collisions
```

`isPressed` = held; `isJustPressed` = fired this frame only (use it for jumps).

## Collision Groups

`config.ts` declares which groups interact. An entity sets `override collisionGroup = "player"`.
`Actor.solid` (bool) decides whether it physically blocks. `Sensor`s never block — they emit
`bodyEntered` when another body overlaps:

```ts
this.bodyEntered.connect((body) => {
	if (body.hasTag("player")) { gameState.score += 10; this.destroy(); }
});
```

Tag nodes in `onReady()` with `this.tag("player")` and test with `body.hasTag("player")`.
**Always call `super.onReady()`** in an override — `Actor`/`Sensor` register their body and init
gravity there; skipping it means the node never falls or never detects overlap.

## Reactive State + HUD

`reactiveState({...})` returns a proxy whose writes emit per-key signals. The HUD subscribes so
labels update without polling:

```ts
export const gameState = reactiveState({ score: 0, lives: 3 });

// In the HUD (a Layer with `this.fixed = true` so it ignores the camera):
gameState.on("score").connect(({ value }) => { this.scoreLabel.text = `Score: ${value}`; });
```

Mutate anywhere (`gameState.score += 10`) and every subscribed Label updates.

## Testing (headless)

Tests run in Vitest via `quintus2/testing`'s `TestRunner`, no browser:

```ts
const result = await TestRunner.run({ scene: Level1, seed: 42, width: 320, height: 240,
	plugins: [PhysicsPlugin({ ... }), InputPlugin({ ... }), AudioPlugin()], duration: 1 });
const player = result.game.currentScene?.findByType(Player);
expect(player!.isOnFloor()).toBe(true);
result.game.stop(); // always stop — a lingering loop leaks across tests
```

Run with `npm test`. Deterministic: same `seed` → same result.

## Debugging

Use the **`debug-game` skill** (`.claude/skills/debug-game/`) — it drives the game through the
engine's debug bridge with the `qdbg` CLI. `qdbg` needs Claude Code's bundled `playwright-cli`.

```bash
npm run dev            # start the Vite dev server on http://localhost:3050
pnpm qdbg connect      # opens the game at ./.qdbg.json's url + ?debug, paused at frame 0
pnpm qdbg tree         # print the scene tree
pnpm qdbg step 30      # advance 30 frames
pnpm qdbg tap jump 1   # press "jump" for one frame
pnpm qdbg physics Player   # inspect position / velocity / onFloor / contacts
pnpm qdbg disconnect
```

`pnpm qdbg connect` with no argument reads `./.qdbg.json` (`{ "url": "http://localhost:3050" }`)
and appends `?debug`, which auto-installs the debug bridge — no code change needed. See
`.claude/skills/debug-game/SKILL.md` for the full command reference and recipes.
