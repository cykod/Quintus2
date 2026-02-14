# Phase 2, Subphase 5: Integration Tests & Demo

> **Step 9** | **Duration:** ~1 day
> **Depends on:** Subphases 1–4 (all physics classes implemented)
> **Produces:** Multi-body integration tests, determinism validation, platformer demo running in browser.

**Reference:** [PHASE_2_DESIGN_CORE.md](./PHASE_2_DESIGN_CORE.md) for definition of done and architecture overview.

---

## Integration Tests

**File:** `packages/physics/src/integration.test.ts`

These tests exercise multiple physics classes together in realistic scenarios. Each test creates a Game, installs PhysicsPlugin, builds a scene with physics bodies, and steps the game loop manually to validate behavior.

### Test Scenarios

**Platformer scenario:** Actor falls onto StaticCollider floor, stops, `isOnFloor()` true
```
Setup: Actor at (200, 0), StaticCollider floor at (200, 500)
Step game N times until actor reaches floor
Assert: actor.isOnFloor() === true
Assert: actor.position.y ≈ floor.y - actorHalfHeight - floorHalfHeight
```

**Wall slide:** Actor runs into wall, slides along it
```
Setup: Actor with velocity.x = 200 and velocity.y = 100, wall to the right
Step game
Assert: actor.position.x stopped at wall, actor.position.y advanced (slid down)
Assert: actor.isOnWall() === true
```

**Corner:** Actor hits corner between floor and wall, resolves correctly
```
Setup: Actor falls diagonally into a floor/wall corner
Step game
Assert: position resolves to the corner, no jittering, both isOnFloor and isOnWall
```

**Stack of boxes:** Multiple actors stacked, stable (no jittering)
```
Setup: 3 actors stacked vertically on a floor
Step game 100 times
Assert: all actors remain at their resting positions (within epsilon)
```

**Moving platform:** Actor rides moving StaticCollider horizontally
```
Setup: StaticCollider with constantVelocity = (100, 0), Actor standing on it
Step game N times
Assert: actor.position.x increases by platform velocity × total time
```

**Sensor pickup:** Actor walks over Sensor, signals fire, Sensor self-destructs
```
Setup: Actor moving right, Sensor (coin) in its path
Step game until actor overlaps coin
Assert: bodyEntered signal fired
Assert: coin is destroyed
Assert: bodyExited signal fired (due to destroy)
```

**Tunneling prevention:** Fast actor does not pass through thin StaticCollider
```
Setup: Actor with velocity.x = 1000, thin wall (4px wide) in its path
Step game
Assert: actor stops at wall, doesn't pass through
```

**Slope walk:** Actor walks up 30° slope smoothly
```
Setup: Polygon StaticCollider forming a 30° slope, Actor walking into it
Step game
Assert: actor.isOnFloor() === true
Assert: actor.position.y decreases (climbed up)
Assert: movement is smooth (no stuttering)
```

**One-way platform:** Actor jumps through from below, lands on top
```
Setup: StaticCollider with oneWay = true, Actor below it
Give actor upward velocity (jump)
Step game until actor passes through platform
Assert: actor passed through from below
Step game as actor falls back down
Assert: actor lands on top of platform, isOnFloor() true
```

**Collision groups:** Player collides with world but not items
```
Setup: Player (group "player"), wall (group "world"), item (group "items")
Player group collidesWith: ["world"] (not "items")
Move player into both
Assert: player stops at wall
Assert: player passes through item
```

**Rotated StaticCollider platform:** Actor lands on a 45° rotated rect platform, slides correctly along the angled surface
```
Setup: StaticCollider with rotation = π/4, rect collision shape, Actor above it
Step game until actor reaches the rotated surface
Assert: actor.isOnFloor() === true
Assert: actor slides along the angled surface (position changes diagonally)
Assert: collision normal is perpendicular to the rotated surface
```

**Rotated capsule Actor:** Player with a capsule shape rotated 90° (horizontal capsule) collides correctly with floor
```
Setup: Actor with CollisionShape rotation = π/2, capsule shape (now horizontal)
StaticCollider floor below
Step game until actor reaches floor
Assert: actor.isOnFloor() === true
Assert: actor's AABB reflects the horizontal capsule dimensions
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
Run 1: step game 200 times, record all positions
Run 2: step game 200 times with identical inputs
Assert: all positions match exactly (bitwise equal)
```

**Determinism:** Run same scenario twice with same inputs → identical final positions
```
Setup: Complex scene with actors, platforms, sensors
Run 1: step game 200 times, record all positions
Run 2: step game 200 times with identical inputs
Assert: all positions match exactly (not approximately — bitwise equal)
```

---

## Demo: Simple Platformer Movement

After all subphases are complete, this demo runs in the browser.

**File:** `examples/platformer-demo.ts` (or `examples/phase2/index.ts`)

```typescript
import { Game, defineScene, signal } from "@quintus/core";
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
  readonly collected = signal<void>();
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
game.start(defineScene("demo", (scene) => {
  // Floor
  const floor = scene.add(StaticCollider);
  floor.position = new Vec2(200, 280);
  floor.addChild(CollisionShape).shape = Shape.rect(400, 20);
  floor.collisionGroup = "world";

  // Platforms
  for (const [x, y] of [[100, 220], [250, 180], [150, 120]] as const) {
    const plat = scene.add(StaticCollider);
    plat.position = new Vec2(x, y);
    plat.addChild(CollisionShape).shape = Shape.rect(80, 12);
    plat.collisionGroup = "world";
  }

  // Wall
  const wall = scene.add(StaticCollider);
  wall.position = new Vec2(10, 200);
  wall.addChild(CollisionShape).shape = Shape.rect(20, 160);
  wall.collisionGroup = "world";

  // Coins
  for (const [x, y] of [[100, 200], [250, 160], [150, 100]] as const) {
    const coin = scene.add(Coin);
    coin.position = new Vec2(x, y);
    coin.collected.connect(() => {
      score++;
      console.log(`Score: ${score}`);
    });
  }
  let score = 0;

  // Player
  const player = scene.add(Player);
  player.position = new Vec2(200, 100);

  // Temporary keyboard input (replaced by @quintus/input in Phase 3)
  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") player._leftPressed = true;
    if (e.key === "ArrowRight") player._rightPressed = true;
    if (e.key === "ArrowUp" || e.key === " ") player._jumpPressed = true;
  });
  document.addEventListener("keyup", (e) => {
    if (e.key === "ArrowLeft") player._leftPressed = false;
    if (e.key === "ArrowRight") player._rightPressed = false;
    if (e.key === "ArrowUp" || e.key === " ") player._jumpPressed = false;
  });
}));
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
