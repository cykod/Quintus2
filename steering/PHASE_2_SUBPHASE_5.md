# Phase 2, Subphase 5: Integration Tests & Demo

> **Step 9** | **Duration:** ~1 day
> **Depends on:** Subphases 1–4 (all physics classes implemented)
> **Produces:** Multi-body integration tests, determinism validation, platformer demo running in browser.

**Reference:** [PHASE_2_DESIGN_CORE.md](./PHASE_2_DESIGN_CORE.md) for definition of done and architecture overview.

---

## Integration Tests

**File:** `packages/physics/src/integration.test.ts`

These tests exercise multiple physics classes together in realistic scenarios. Each test creates a Game, installs PhysicsPlugin, builds a scene with physics bodies, and steps the game loop via `game.step()` to validate behavior through the full loop (including `onFixedUpdate` → `move()` → `stepSensors()`).

> **Note on scope:** Existing unit tests in `actor.test.ts`, `sensor.test.ts`, etc. already cover direct `move()` calls. Integration tests add value by running through the full `game.step()` pipeline with Actor subclasses whose `onFixedUpdate` calls `move(dt)`. Focus on multi-body interactions, frame sequencing, and full-loop behavior.

### Test Helper Pattern

Each integration test should:
1. Create a `Game` with `game.use(PhysicsPlugin(...))` before `game.start()`
2. Define Actor subclasses with `onFixedUpdate(dt)` that call `this.move(dt)` (to exercise the full loop)
3. Call `game.step(dt)` to advance the simulation (NOT `actor.move(dt)` directly)
4. Reset `nextNodeId` (exported from `@quintus/core`) before each determinism test to ensure consistent node IDs

### Test Scenarios

**Platformer scenario:** Actor falls onto StaticCollider floor, stops, `isOnFloor()` true
```
Setup: Actor at (200, 0), StaticCollider floor at (200, 500)
Actor subclass: onFixedUpdate calls this.move(dt)
Step game.step(1/60) N times until actor reaches floor
Assert: actor.isOnFloor() === true
Assert: actor.position.y ≈ floor.y - actorHalfHeight - floorHalfHeight
```

**Wall slide:** Actor runs into wall, slides along it
```
Setup: Actor with velocity.x = 200 and velocity.y = 100, wall to the right
Actor subclass: onFixedUpdate sets velocity then calls this.move(dt)
Step game.step(1/60)
Assert: actor.position.x stopped at wall, actor.position.y advanced (slid down)
Assert: actor.isOnWall() === true
```

**Corner:** Actor hits corner between floor and wall, resolves correctly
```
Setup:
  Floor: StaticCollider at (50, 200), Shape.rect(100, 20) → spans x=0..100, y=190..210
  Wall:  StaticCollider at (100, 100), Shape.rect(20, 200) → spans x=90..110, y=0..200
  Actor at (85, 170) with velocity = (150, 250), Shape.rect(10, 10)
Actor subclass: onFixedUpdate sets velocity then calls this.move(dt)
Step game.step(1/60) multiple times
Assert: position resolves to the corner, no jittering
Assert: actor.isOnFloor() === true AND actor.isOnWall() === true
```

**Moving platform:** Actor rides a moving StaticCollider horizontally
```
Setup:
  MovingPlatform subclass of StaticCollider:
    constantVelocity = (100, 0)
    onFixedUpdate(dt):
      this.position.x += this.constantVelocity.x * dt
      this.world.updatePosition(this)   // update spatial hash
  Actor standing on the platform
  Actor subclass: onFixedUpdate calls this.move(dt)
Step game.step(1/60) N times
Assert: platform.position.x increased by constantVelocity.x × N × dt
Assert: actor.position.x tracks platform (increased by same amount via carry + platform movement)
```

**Sensor pickup:** Actor walks over Sensor, signals fire, Sensor self-destructs
```
Setup: Actor moving right, Sensor (coin) in its path
Actor subclass: onFixedUpdate sets velocity.x = 200 then calls this.move(dt)
Step game.step(1/60) until actor overlaps coin
Assert: bodyEntered signal fired (detected in stepSensors at end of frame)
  → handler calls coin.destroy() (queues destruction)
Step game.step(1/60) one more time
Assert: coin._isDestroyed === true (destruction processed during cleanup)
Assert: bodyExited signal fired (during unregister in _processDestroy)
```

**Tunneling prevention:** Fast actor does not pass through thin StaticCollider
```
Setup:
  Actor with velocity.x = 1000, Shape.rect(10, 10) (rect for analytical sweptAABB path)
  Thin wall: StaticCollider with Shape.rect(4, 100) (rect shape, 4px wide)
Actor subclass: onFixedUpdate sets velocity then calls this.move(dt)
Step game.step(1/60)
Assert: actor stops at wall, doesn't pass through
Note: rect-vs-rect uses analytical sweptAABB. Non-rect shapes use binary-search TOI
  (8 iterations) which may need increased maxIterations for very thin geometry.
```

**Slope walk:** Actor walks up 30° slope smoothly
```
Setup:
  Polygon StaticCollider forming a 30° slope:
    Shape.polygon([new Vec2(-100, 0), new Vec2(100, 0), new Vec2(100, -115.5)])
    (height = 200 * tan(30°) ≈ 115.5)
  Actor walking into it with velocity.x = 100
  Actor subclass: onFixedUpdate sets velocity then calls this.move(dt)
Step game.step(1/60) multiple times
Assert: actor.isOnFloor() === true (30° < floorMaxAngle of 45°)
Assert: actor.position.y decreases (climbed up)
Assert: movement is smooth (no stuttering between frames)
Note: Polygon shapes use general SAT with binary-search TOI (not analytical sweptAABB).
  Float precision tolerance may be needed for position assertions.
```

**One-way platform:** Actor jumps through from below, lands on top
```
Setup:
  StaticCollider with oneWay = true, Shape.rect(80, 4) at y=200 (thin: 4px)
  Actor below it at y=250, Shape.rect(10, 10)
  Give actor velocity.y = -400 (strong upward jump, clears 4px in one frame)
Actor subclass: onFixedUpdate sets velocity then calls this.move(dt)
Step game.step(1/60) until actor.position.y < 200 (above platform)
Assert: actor passed through from below (oneWay skipped collision, normal=(0,1) dot (0,-1) = -1 < 0.707)
Let actor's gravity pull it back down
Step game.step(1/60) until actor falls back to platform
Assert: actor lands on top of platform, isOnFloor() === true (normal=(0,-1) dot (0,-1) = 1 > 0.707)
```

**Collision groups:** Player collides with world but not obstacles in "items" group
```
Setup:
  Collision groups config:
    player: { collidesWith: ["world"] }        // NOT "items"
    world:  { collidesWith: ["player"] }
    items:  { collidesWith: [] }               // items don't collide with anything
  Player Actor (group "player") moving right
  Wall: StaticCollider (group "world") in player's path
  Item: StaticCollider (group "items") also in player's path
  Note: Item must be StaticCollider (not Sensor) to test collision group filtering,
    since castMotion skips sensors entirely regardless of collision groups.
Actor subclass: onFixedUpdate sets velocity then calls this.move(dt)
Step game.step(1/60)
Assert: player stops at wall (shouldCollide("player","world") → true)
Assert: player passes through item (shouldCollide("player","items") → false)
```

**Collision group validation:** Invalid group throws on registration
```
Setup: PhysicsPlugin installed with groups { player: { collidesWith: ["world"] } }
Create Actor with collisionGroup = "nonexistent"
Add to scene
Assert: throws error during world.register() → groups.validate("nonexistent")
```

**Rotated StaticCollider platform:** Actor lands on a 45° rotated rect platform, slides correctly along the angled surface
```
Setup: StaticCollider with rotation = π/4, rect collision shape, Actor above it
Actor subclass: onFixedUpdate calls this.move(dt)
Step game.step(1/60) until actor reaches the rotated surface
Assert: actor.isOnFloor() === true
Assert: actor slides along the angled surface (position changes diagonally)
Assert: collision normal is perpendicular to the rotated surface
Note: Rotated shapes use general SAT path (not fast rect-vs-rect sweptAABB).
  TOI is found via binary search with limited precision (8 iterations).
```

**Rotated capsule Actor:** Player with a capsule shape rotated 90° (horizontal capsule) collides correctly with floor
```
Setup: Actor with CollisionShape rotation = π/2, capsule shape (now horizontal)
StaticCollider floor below
Actor subclass: onFixedUpdate calls this.move(dt)
Step game.step(1/60) until actor reaches floor
Assert: actor.isOnFloor() === true
Assert: actor's AABB reflects the horizontal capsule dimensions
Note: Exercises general SAT path with rotated capsule projection.
```

**Capsule Actor on rect floor:** Capsule-shaped Actor lands on and walks along a rect floor
```
Setup: Actor with Shape.capsule(8, 24), StaticCollider floor with Shape.rect(400, 20)
Actor subclass: onFixedUpdate sets velocity.x = 100 then calls this.move(dt)
Step game.step(1/60) until actor lands on floor
Assert: actor.isOnFloor() === true
Step several more times with horizontal velocity
Assert: actor walks smoothly along floor (exercises general SAT TOI through full move() pipeline)
Note: Capsule-on-rect is a common real-world case (rounded feet for smooth slope navigation).
```

**Rotated sensor:** Sensor with rotated rect shape detects overlaps using rotated geometry
```
Setup: Sensor with rotation = π/4, rect collision shape
Actor passes through the rotated sensor's actual geometry (not its AABB)
Assert: bodyEntered fires when actor overlaps the rotated rect, not just the AABB
```

**Rotation determinism:** Same test with rotated shapes produces bitwise-identical results across runs
```
Setup: Complex scene with rotated platforms, rotated actors, rotated sensors
Reset nextNodeId counter before each run to ensure consistent node IDs
Run 1: step game.step(1/60) 200 times, record all positions
Run 2: fresh game, reset nextNodeId, step game.step(1/60) 200 times with identical inputs
Assert: all positions match exactly (bitwise equal)
```

**Determinism:** Run same scenario twice with same inputs → identical final positions
```
Setup: Complex scene with actors, platforms, sensors
Reset nextNodeId counter before each run to ensure consistent node IDs
Run 1: step game.step(1/60) 200 times, record all positions
Run 2: fresh game, reset nextNodeId, step game.step(1/60) 200 times with identical inputs
Assert: all positions match exactly (not approximately — bitwise equal)
Note: nextNodeId must be reset because Map/Set iteration order in SpatialHash and
  sensor overlap tracking depends on insertion order, which depends on node IDs.
```

**Plugin ordering:** PhysicsPlugin installed after game.start() auto-installs with warning
```
Setup: Game without PhysicsPlugin installed
game.start(SceneWithPhysicsBodies)
Assert: PhysicsPlugin auto-installs with default config
Assert: console warning is produced about missing plugin
Assert: physics still functions (fallback behavior works)
```

---

## Demo: Simple Platformer Movement

After all subphases are complete, this demo runs in the browser.

**File:** `examples/platformer-demo.ts` (or `examples/phase2/index.ts`)

```typescript
import { Game, Scene, Signal, signal } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import {
  Actor, StaticCollider, Sensor, CollisionShape, Shape, PhysicsPlugin,
} from "@quintus/physics";

// === Physics Plugin ===
const game = new Game({ width: 400, height: 300 });
game.use(PhysicsPlugin({
  gravity: new Vec2(0, 800),
  collisionGroups: {
    player: { collidesWith: ["world", "coins"] },
    world:  { collidesWith: ["player"] },
    // Collision groups for sensors only affect bodyEntered/bodyExited event filtering,
    // not physical collision response (castMotion skips sensors entirely).
    coins:  { collidesWith: ["player"] },
  },
}));

// === Player ===
class Player extends Actor {
  speed = 150;
  jumpForce = -350;
  collisionGroup = "player";

  onReady() {
    this.addChild(CollisionShape).shape = Shape.rect(14, 24);
    this.tag("player");
  }

  // Use onFixedUpdate for physics
  onFixedUpdate(dt: number) {
    this.velocity.x = 0;

    // Horizontal movement (placeholder: arrow keys via raw input)
    // (Full input system comes in Phase 3)
    if (this._leftPressed) this.velocity.x = -this.speed;
    if (this._rightPressed) this.velocity.x = this.speed;

    // Jump
    if (this._jumpPressed && this.isOnFloor()) {
      this.velocity.y = this.jumpForce;
    }

    this.move(dt);
  }

  // Temporary raw input (replaced by @quintus/input in Phase 3)
  _leftPressed = false;
  _rightPressed = false;
  _jumpPressed = false;
}

// === Coin ===
class Coin extends Sensor {
  readonly collected: Signal<void> = signal<void>();
  collisionGroup = "coins";

  onReady() {
    this.addChild(CollisionShape).shape = Shape.circle(8);
    this.bodyEntered.connect((body) => {
      if (body.hasTag("player")) {
        this.collected.emit();
        this.destroy();
      }
    });
  }

  // Simple bob animation
  private _time = 0;
  private _baseY = 0;
  onEnterTree() {
    super.onEnterTree();
    this._baseY = this.position.y;
  }
  onUpdate(dt: number) {
    this._time += dt;
    this.position.y = this._baseY + Math.sin(this._time * 3) * 4;
  }
}

// === Scene ===
class DemoScene extends Scene {
  onReady() {
    // Floor
    const floor = this.add(StaticCollider);
    floor.position = new Vec2(200, 280);
    floor.addChild(CollisionShape).shape = Shape.rect(400, 20);
    floor.collisionGroup = "world";

    // Platforms
    for (const [x, y] of [[100, 220], [250, 180], [150, 120]] as const) {
      const plat = this.add(StaticCollider);
      plat.position = new Vec2(x, y);
      plat.addChild(CollisionShape).shape = Shape.rect(80, 12);
      plat.collisionGroup = "world";
    }

    // Wall
    const wall = this.add(StaticCollider);
    wall.position = new Vec2(10, 200);
    wall.addChild(CollisionShape).shape = Shape.rect(20, 160);
    wall.collisionGroup = "world";

    // Coins
    let score = 0;
    for (const [x, y] of [[100, 200], [250, 160], [150, 100]] as const) {
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

    // Temporary keyboard input (replaced by @quintus/input in Phase 3)
    // Store references so we can remove them on cleanup
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") player._leftPressed = true;
      if (e.key === "ArrowRight") player._rightPressed = true;
      if (e.key === "ArrowUp" || e.key === " ") player._jumpPressed = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") player._leftPressed = false;
      if (e.key === "ArrowRight") player._rightPressed = false;
      if (e.key === "ArrowUp" || e.key === " ") player._jumpPressed = false;
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);

    // Clean up event listeners when scene is destroyed
    this.sceneDestroyed.connect(() => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
    });
  }
}

game.start(DemoScene);
```

### What This Demo Validates

- Actor falls with gravity and lands on floor
- Actor runs left/right and jumps
- Actor slides along walls (doesn't stick)
- Actor lands on platforms at various heights
- Sensor (coin) detects player overlap, fires signal, self-destructs
- Collision groups work (player collides with world and coins)
- No tunneling through floor at normal velocities
- Deterministic: stepping manually produces identical results each time

---

## Final Verification

Before marking Phase 2 complete:

1. **All tests pass:** `pnpm test --filter=@quintus/physics`
2. **Build succeeds:** `pnpm build` (all packages)
3. **Biome lint clean:** `pnpm lint`
4. **Demo runs in browser:** `pnpm dev` → navigate to platformer demo
5. **Visual verification:** Player runs, jumps, lands, slides, collects coins
6. **Determinism check:** Run integration determinism test — bitwise equal positions

---

## Completion Checklist

- [ ] All integration test scenarios pass
- [ ] Determinism test passes (identical results across runs)
- [ ] Tunneling prevention works at ≤1000 px/s
- [ ] Demo runs in browser via `pnpm dev`
- [ ] Visual verification: player runs, jumps, lands, slides, collects coins
- [ ] `pnpm build` succeeds for all packages
- [ ] `pnpm lint` passes (Biome clean)
- [ ] `pnpm test` passes (all packages, all tests)
